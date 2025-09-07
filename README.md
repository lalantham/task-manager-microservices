# TaskStack — Kubernetes/Docker DevOps Learning App

A production-style **microservices** sample app to learn **Kubernetes, Docker, and DevOps**.  
Features a minimal **Task Manager** with user auth, Redis-backed sessions, email notifications, and a clean React UI.

## Services

- **Auth Service** (Node.js + Express): registration, login, logout, session management in Redis.
- **Task Service** (Python + FastAPI): CRUD tasks per user, Redis caching, SMTP email notifications.
- **Frontend** (React + Vite + Nginx): simple UI talking to the backend via REST.
- **PostgreSQL** x2: isolated DB per microservice.
- **Redis**: session store + caching.
- **Nginx**: serves the frontend and reverse-proxies `/api/auth` and `/api/tasks`.

## Quick Start (Docker Compose)

> Generate Build Lock Files

```bash
cd auth-service
npm install
cd ../frontend
npm install
```

## Quick Start (Docker Compose)

> Requirements: Docker, Docker Compose

1) Copy example envs and fill them:
```bash
cp auth-service/.env.example auth-service/.env
cp task-service/.env.example task-service/.env
cp frontend/.env.example frontend/.env
```
2) Bring everything up:
```bash
docker compose up --build
```
3) Open **http://localhost**

### Useful defaults

- Auth API: `http://localhost/api/auth`
- Task API: `http://localhost/api/tasks`
- Default cookie name: `sid` (HttpOnly)
- Postgres data are persisted via volumes `auth-db-data` and `task-db-data`

## Kubernetes (Kind or Minikube)

> Requirements: kubectl, and one of: [Kind](https://kind.sigs.k8s.io) or [Minikube](https://minikube.sigs.k8s.io).  
> Also install an **Nginx Ingress Controller** (see their docs).

### 1) Build images
From repo root, build and tag images:
```bash
# Auth
docker build -t taskstack/auth:local ./auth-service
# Task
docker build -t taskstack/task:local ./task-service
# Frontend (nginx build-stage)
docker build -t taskstack/web:local ./frontend
```

### 2) Load images into your cluster
- **Kind**:
```bash
kind load docker-image taskstack/auth:local
kind load docker-image taskstack/task:local
kind load docker-image taskstack/web:local
```
- **Minikube**:
```bash
minikube image load taskstack/auth:local
minikube image load taskstack/task:local
minikube image load taskstack/web:local
```

### 3) Create secrets (edit placeholders first)
```bash
kubectl apply -f k8s/namespace.yaml
kubectl -n taskstack apply -f k8s/secrets.example.yaml
```
Then **edit** the secret values (or create your own secret) with your SMTP and DB passwords:
```bash
kubectl -n taskstack edit secret taskstack-secrets
```

### 4) Deploy
```bash
kubectl -n taskstack apply -f k8s/redis.yaml
kubectl -n taskstack apply -f k8s/postgres-auth.yaml
kubectl -n taskstack apply -f k8s/postgres-task.yaml
kubectl -n taskstack apply -f k8s/auth-deployment.yaml
kubectl -n taskstack apply -f k8s/task-deployment.yaml
kubectl -n taskstack apply -f k8s/web-deployment.yaml
kubectl -n taskstack apply -f k8s/ingress.yaml
```

### 5) Browse
Add a hosts entry if your ingress uses a host:
```
127.0.0.1 taskstack.local
```
Now open **http://taskstack.local** (or the Minikube tunnel URL).

### Scale (Kubernetes)
```bash
kubectl -n taskstack scale deploy auth --replicas=3
kubectl -n taskstack scale deploy task --replicas=3
kubectl -n taskstack get pods -o wide
```

---

## Dev Notes / Design Choices

- **Two languages**: Node/Express for Auth and Python/FastAPI for Tasks — great to compare ergonomics and patterns.
- **Sessions over JWT for simplicity**: `sid` stored in **Redis**, shared across services. (You can swap to JWT later.)
- **Per-service database**: microservices **own their data**; Tasks reference `user_id` from Auth but no cross-DB foreign keys.
- **Caching**: Task list per user cached in Redis (key `tasks:{userId}`) and invalidated on writes.
- **Email notifications**: SMTP on create/update. If SMTP envs aren’t set, emails are skipped gracefully.
- **Beginner-friendly**: minimal libraries, clear comments, and simple SQL; no ORM migrations required to get started.

---

## Directory Layout

```
auth-service/          # Node/Express auth API
task-service/          # FastAPI tasks API
frontend/              # React + Vite + Nginx
k8s/                   # Kubernetes manifests
docker-compose.yml
```

Good luck & have fun learning!
