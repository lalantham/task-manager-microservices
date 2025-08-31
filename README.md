# Task Manager Microservices Application

A complete microservices application designed for learning DevOps, Kubernetes, and containerization. This application demonstrates modern microservice architecture patterns with different programming languages and technologies.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                   API Gateway (Node.js)                     │
└─────┬─────────────┬─────────────┬───────────────────────────┘
      │             │             │
┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
│User Service│ │Task Service│ │Notification│
│(Python)    │ │   (Go)     │ │Service(JS) │
└─────┬─────┘ └─────┬─────┘ └─────┬─────┘
      │             │             │
      └─────────────┼─────────────┘
                    │
      ┌─────────────▼─────────────┐
      │     PostgreSQL + Redis    │
      └───────────────────────────┘
```

## 🛠️ Technologies Used

- **API Gateway**: Node.js + Express + Redis (Rate limiting, caching)
- **User Service**: Python + FastAPI + JWT Authentication
- **Task Service**: Go + Gin Framework
- **Notification Service**: Node.js + BullMQ + Email
- **Frontend**: React + Axios
- **Database**: PostgreSQL
- **Cache/Queue**: Redis
- **Containerization**: Docker + Docker Compose
- **Orchestration**: Kubernetes

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)
- Go 1.21+ (for local development)
- kubectl (for Kubernetes)
- Minikube (for local Kubernetes)

### Option 1: Docker Compose (Recommended for beginners)

1. **Clone and navigate to the project**
   ```bash
   git clone <your-repo>
   cd task-manager-microservices
   ```

2. **Build and start all services**
   ```bash
   make build
   make start
   ```

3. **Access the application**
   - Frontend: http://localhost:8080
   - API Gateway: http://localhost:3000
   - Individual services: 4000, 5000, 6000

4. **Test the application**
   - Register a new account
   - Create some tasks
   - Check notifications

### Option 2: Kubernetes (Minikube)

1. **Start Minikube**
   ```bash
   minikube start --driver=docker
   eval $(minikube docker-env)
   ```

2. **Build images in Minikube's Docker daemon**
   ```bash
   make build
   ```

3. **Deploy to Kubernetes**
   ```bash
   make k8s-deploy
   ```

4. **Add host entry** (Linux/Mac)
   ```bash
   echo "$(minikube ip) taskmanager.local" | sudo tee -a /etc/hosts
   ```

5. **Access the application**
   ```bash
   minikube service frontend -n task-manager
   ```

## 📁 Project Structure

```
task-manager-microservices/
├── api-gateway/              # Node.js API Gateway
│   ├── server.js
│   ├── package.json
│   └── Dockerfile
├── user-service/             # Python FastAPI User Service
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── task-service/             # Go Task Service
│   ├── main.go
│   ├── go.mod
│   └── Dockerfile
├── notification-service/     # Node.js Notification Service
│   ├── server.js
│   ├── package.json
│   └── Dockerfile
├── frontend/                 # React Frontend
│   ├── src/App.js
│   ├── src/App.css
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── k8s/                     # Kubernetes manifests
│   ├── 00-namespace.yaml
│   ├── 01-configmap.yaml
│   ├── 02-postgres.yaml
│   ├── 03-redis.yaml
│   ├── 04-services.yaml
│   └── 05-gateway-frontend.yaml
├── docker-compose.yml       # Local development
├── init-db.sql             # Database schema
├── Makefile                # Build/deploy scripts
└── README.md              # This file
```

## 🔧 Development Workflow

### Local Development (Individual Services)

Each service can be run independently for development:

```bash
# User Service (Python)
cd user-service
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 4000

# Task Service (Go)
cd task-service
go mod tidy
go run main.go

# Notification Service (Node.js)
cd notification-service
npm install
npm run dev

# API Gateway (Node.js)
cd api-gateway
npm install
npm run dev

# Frontend (React)
cd frontend
npm install
npm start
```

### Testing Individual Components

```bash
# Test User Service
curl -X POST http://localhost:4000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "email": "test@example.com", "password": "password123"}'

# Test API Gateway
curl http://localhost:3000/health

# Check all services
make monitor
```

## 🎯 Learning Objectives

This project teaches:

### Docker Concepts
- Multi-stage builds
- Health checks
- Environment variables
- Volume management
- Networking between containers
- Security best practices (non-root users)

### Kubernetes Concepts
- Deployments and ReplicaSets
- Services (ClusterIP, NodePort, LoadBalancer)
- ConfigMaps and Secrets
- Persistent Volumes
- Ingress controllers
- Namespaces
- Resource limits and requests
- Health probes (liveness/readiness)

### Microservices Patterns
- Service decomposition
- API Gateway pattern
- Database per service
- Asynchronous messaging
- Circuit breaker (basic implementation)
- Service discovery
- Load balancing

### DevOps Practices
- Infrastructure as Code
- Container orchestration
- CI/CD pipeline foundations
- Monitoring and health checks
- Environment management
- Security configurations

## 🐳 Container Images

All services are containerized with:
- Multi-stage builds (where applicable)
- Non-root users for security
- Health checks
- Proper signal handling
- Minimal base images (Alpine Linux)

## 🔍 Monitoring & Debugging

### Check service health
```bash
# Docker Compose
docker-compose ps
docker-compose logs service-name

# Kubernetes
kubectl get pods -n task-manager
kubectl logs deployment/api-gateway -n task-manager
kubectl describe pod pod-name -n task-manager
```

### Common troubleshooting
```bash
# Reset database
make db-reset

# Rebuild specific service
docker-compose build service-name

# Check service connectivity
kubectl exec -it deployment/api-gateway -n task-manager -- curl http://user-service:4000/health
```

## 🌐 Cloud Deployment

### Oracle Cloud (OKE)
1. Create OKE cluster
2. Configure kubectl context
3. Update image references to your container registry
4. Deploy: `kubectl apply -f k8s/`

### Azure (AKS)
1. Create AKS cluster
2. Configure kubectl context
3. Update image references to ACR
4. Deploy: `kubectl apply -f k8s/`

### Google Cloud (GKE)
1. Create GKE cluster
2. Configure kubectl context
3. Update image references to GCR/Artifact Registry
4. Deploy: `kubectl apply -f k8s/`

## 🔒 Security Features

- JWT authentication
- Password hashing (bcrypt)
- Rate limiting
- CORS configuration
- Security headers (Helmet.js)
- Non-root container users
- Secret management with Kubernetes secrets

## 📈 Scaling Considerations

- Horizontal Pod Autoscaler ready
- Stateless services (except database)
- Redis for caching and session storage
- Load balancing with multiple replicas
- Health checks for proper traffic routing

## 🚧 Production Readiness Checklist

- [ ] Configure proper secrets (JWT keys, database passwords)
- [ ] Set up SSL/TLS certificates
- [ ] Configure monitoring (Prometheus/Grafana)
- [ ] Set up logging aggregation (ELK stack)
- [ ] Configure backup strategies
- [ ] Implement proper CI/CD pipelines
- [ ] Set up alerting
- [ ] Performance testing
- [ ] Security scanning

## 📚 Next Steps for Learning

1. **Add monitoring**: Implement Prometheus and Grafana
2. **CI/CD**: Set up GitHub Actions or GitLab CI
3. **Service Mesh**: Explore Istio for advanced networking
4. **Message Queues**: Add RabbitMQ or Apache Kafka
5. **Observability**: Add distributed tracing with Jaeger
6. **Testing**: Implement integration and load tests
7. **Security**: Add Vault for secret management

## 🤝 Contributing

This is a learning project! Feel free to:
- Add new services
- Implement additional features
- Improve the Kubernetes manifests
- Add monitoring and logging
- Enhance security

## 📄 License

MIT License - Feel free to use this for learning and development!
