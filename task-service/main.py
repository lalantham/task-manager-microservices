"""
Task Service (FastAPI)
- Stores tasks per user (identified by Redis session 'sid' -> user_id).
- Caches the task list per user in Redis.
- Sends email notifications on create/update if SMTP is configured.

Note: This service trusts the Auth service's session created in Redis.
"""

import os
from typing import Optional, List
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import redis
import smtplib
from email.mime.text import MIMEText

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://taskuser:taskpass@task-db:5432/taskdb")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@example.com")
BASE_URL = os.getenv("BASE_URL", "http://localhost")
PORT = int(os.getenv("PORT", "8000"))

app = FastAPI(title="Task Service", version="1.0.0")

# Allow frontend + proxy origin; cookie needs credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("ORIGIN", "http://localhost")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Redis ---
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)

# --- Database (SQLAlchemy Core) ---
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

def init_db():
    with engine.begin() as conn:
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'done'
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """))
init_db()

# --- Schemas ---
class TaskIn(BaseModel):
    title: str

class TaskOut(BaseModel):
    id: int
    user_id: int
    title: str
    status: str
    created_at: datetime
    updated_at: datetime

# --- Auth dependency (reads 'sid' cookie and resolves user_id from Redis) ---
def get_user_id(request: Request) -> int:
    sid = request.cookies.get("sid")
    if not sid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No session")
    user_id = redis_client.get(f"sid:{sid}")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    try:
        return int(user_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid session")

# --- Email helper ---
def send_email_if_configured(to_email: str, subject: str, body: str) -> None:
    if not SMTP_HOST or not to_email:
        # Silently skip if SMTP is not configured
        return
    msg = MIMEText(body, "html")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
        server.starttls()
        if SMTP_USER:
            server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)

# --- Simple cache helpers ---
def cache_key_tasks(user_id: int) -> str:
    return f"tasks:{user_id}"

def invalidate_tasks_cache(user_id: int) -> None:
    redis_client.delete(cache_key_tasks(user_id))

# --- Fetch user's email from Auth DB via small utility call? ---
# To keep services decoupled, we do not reach into Auth DB directly.
# For notifications, we'll store last known email in Redis on /whoami call (optional).
# For simplicity here, we skip looking up the email and just do not send unless
# the client passes 'X-User-Email' header (optional). This keeps the sample clean.
def resolve_email_from_request(request: Request) -> Optional[str]:
    return request.headers.get("X-User-Email")

@app.get("/healthz")
def healthz():
    return {"ok": True}

@app.get("/api/tasks", response_model=List[TaskOut])
def list_tasks(user_id: int = Depends(get_user_id)):
    # Try cache first
    key = cache_key_tasks(user_id)
    cached = redis_client.get(key)
    if cached:
        # FastAPI will serialize dicts; we pre-store as JSON string
        import json
        return json.loads(cached)

    with engine.begin() as conn:
        result = conn.execute(text("""
            SELECT id, user_id, title, status, created_at, updated_at
            FROM tasks WHERE user_id = :uid ORDER BY created_at DESC
        """), {"uid": user_id})
        rows = [dict(r._mapping) for r in result]
    # Cache the list for 30 seconds
    import json
    redis_client.setex(key, 30, json.dumps(rows, default=str))
    return rows

@app.post("/api/tasks", response_model=TaskOut, status_code=201)
def create_task(data: TaskIn, request: Request, user_id: int = Depends(get_user_id)):
    with engine.begin() as conn:
        result = conn.execute(text("""
            INSERT INTO tasks (user_id, title, status)
            VALUES (:uid, :title, 'open')
            RETURNING id, user_id, title, status, created_at, updated_at
        """), {"uid": user_id, "title": data.title})
        row = dict(result.first()._mapping)

    invalidate_tasks_cache(user_id)

    # Email notify (best-effort)
    user_email = resolve_email_from_request(request)
    try:
        send_email_if_configured(
            to_email=user_email or "",
            subject="Task created",
            body=f"<p>Your task '<b>{row['title']}</b>' was created.</p>",
        )
    except Exception:
        pass

    return row

@app.patch("/api/tasks/{task_id}/done", response_model=TaskOut)
def mark_done(task_id: int, request: Request, user_id: int = Depends(get_user_id)):
    with engine.begin() as conn:
        result = conn.execute(text("""
            UPDATE tasks
            SET status = 'done', updated_at = NOW()
            WHERE id = :tid AND user_id = :uid
            RETURNING id, user_id, title, status, created_at, updated_at
        """), {"tid": task_id, "uid": user_id})
        row = result.first()
        if not row:
            raise HTTPException(404, "Task not found")
        row = dict(row._mapping)

    invalidate_tasks_cache(user_id)

    user_email = resolve_email_from_request(request)
    try:
        send_email_if_configured(
            to_email=user_email or "",
            subject="Task completed",
            body=f"<p>Your task '<b>{row['title']}</b>' was marked done.</p>",
        )
    except Exception:
        pass

    return row

@app.patch("/api/tasks/{task_id}/reactivate", response_model=TaskOut)
def reactivate(task_id: int, request: Request, user_id: int = Depends(get_user_id)):
    with engine.begin() as conn:
        result = conn.execute(text("""
            UPDATE tasks
            SET status = 'open', updated_at = NOW()
            WHERE id = :tid AND user_id = :uid
            RETURNING id, user_id, title, status, created_at, updated_at
        """), {"tid": task_id, "uid": user_id})
        row = result.first()
        if not row:
            raise HTTPException(404, "Task not found")
        row = dict(row._mapping)

    invalidate_tasks_cache(user_id)

    user_email = resolve_email_from_request(request)
    try:
        send_email_if_configured(
            to_email=user_email or "",
            subject="Task reactivated",
            body=f"<p>Your task '<b>{row['title']}</b>' was reactivated.</p>",
        )
    except Exception:
        pass

    return row

@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, user_id: int = Depends(get_user_id)):
    with engine.begin() as conn:
        result = conn.execute(text("""
            DELETE FROM tasks WHERE id = :tid AND user_id = :uid
        """), {"tid": task_id, "uid": user_id})
        # rowcount is available via result.rowcount in 2.x after full execution
    invalidate_tasks_cache(user_id)
    return Response(status_code=204)
