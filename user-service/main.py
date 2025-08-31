from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import asyncpg
import redis.asyncio as redis
import os
import uvicorn
from typing import Optional

app = FastAPI(title="User Service", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:password123@localhost:5432/taskmanager")

# Redis connection
redis_client = None

# Pydantic models
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str

# Database functions
async def get_db_connection():
    return await asyncpg.connect(DATABASE_URL)

async def get_redis():
    global redis_client
    if not redis_client:
        redis_client = redis.from_url(
            os.getenv("REDIS_URL", "redis://localhost:6379")
        )
    return redis_client

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    conn = await get_db_connection()
    try:
        user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        if user is None:
            raise credentials_exception
        return dict(user)
    finally:
        await conn.close()

# Routes
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "user-service"}

@app.post("/api/register", response_model=Token)
async def register(user: UserCreate):
    conn = await get_db_connection()
    try:
        # Check if user exists
        existing_user = await conn.fetchrow(
            "SELECT id FROM users WHERE email = $1 OR username = $2",
            user.email, user.username
        )
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Email or username already registered"
            )

        # Create user
        hashed_password = get_password_hash(user.password)
        user_id = await conn.fetchval(
            "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
            user.username, user.email, hashed_password
        )

        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user_id}, expires_delta=access_token_expires
        )

        return {"access_token": access_token, "token_type": "bearer"}
    finally:
        await conn.close()

@app.post("/api/login", response_model=Token)
async def login(user: UserLogin):
    conn = await get_db_connection()
    try:
        db_user = await conn.fetchrow("SELECT * FROM users WHERE email = $1", user.email)
        if not db_user or not verify_password(user.password, db_user['password_hash']):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": db_user['id']}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    finally:
        await conn.close()

@app.get("/api/auth/validate")
async def validate_token(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"]
    }

@app.get("/api/profile", response_model=User)
async def get_profile(current_user: dict = Depends(get_current_user)):
    return User(
        id=current_user["id"],
        username=current_user["username"],
        email=current_user["email"],
        created_at=current_user["created_at"]
    )

@app.get("/api/users", response_model=list[User])
async def get_users(current_user: dict = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        users = await conn.fetch("SELECT id, username, email, created_at FROM users")
        return [User(**dict(user)) for user in users]
    finally:
        await conn.close()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=4000)
