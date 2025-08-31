# Makefile for Task Manager Microservices

.PHONY: help build start stop clean k8s-deploy k8s-delete docker-build

# Default target
help:
	@echo "Available commands:"
	@echo "  build        - Build all Docker images"
	@echo "  start        - Start services with docker-compose"
	@echo "  stop         - Stop all services"
	@echo "  clean        - Clean up containers and images"
	@echo "  k8s-deploy   - Deploy to Kubernetes"
	@echo "  k8s-delete   - Delete from Kubernetes"
	@echo "  docker-build - Build individual Docker images"
	@echo "  test         - Run tests for all services"

# Docker Compose commands
start:
	docker-compose up -d
	@echo "Services starting... Check with: docker-compose ps"
	@echo "Frontend: http://localhost:8080"
	@echo "API Gateway: http://localhost:3000"

stop:
	docker-compose down

logs:
	docker-compose logs -f

# Build all Docker images
build: docker-build

docker-build:
	@echo "Building API Gateway..."
	docker build -t api-gateway:latest ./api-gateway

	@echo "Building User Service..."
	docker build -t user-service:latest ./user-service

	@echo "Building Task Service..."
	docker build -t task-service:latest ./task-service

	@echo "Building Notification Service..."
	docker build -t notification-service:latest ./notification-service

	@echo "Building Frontend..."
	docker build -t frontend:latest ./frontend

	@echo "All images built successfully!"

# Kubernetes commands
k8s-deploy:
	@echo "Deploying to Kubernetes..."
	kubectl apply -f k8s/
	@echo "Waiting for deployments to be ready..."
	kubectl wait --for=condition=available --timeout=300s deployment --all -n task-manager
	@echo "Getting service info..."
	kubectl get all -n task-manager

k8s-delete:
	kubectl delete namespace task-manager

k8s-status:
	kubectl get all -n task-manager

k8s-logs:
	kubectl logs -f deployment/api-gateway -n task-manager

# Development commands
dev-user:
	cd user-service && python -m uvicorn main:app --reload --host 0.0.0.0 --port 4000

dev-task:
	cd task-service && go run main.go

dev-notification:
	cd notification-service && npm run dev

dev-gateway:
	cd api-gateway && npm run dev

dev-frontend:
	cd frontend && npm start

# Testing
test:
	@echo "Running tests..."
	cd user-service && python -m pytest tests/ || true
	cd task-service && go test ./... || true
	cd api-gateway && npm test || true
	cd notification-service && npm test || true

# Cleanup
clean:
	docker-compose down -v
	docker system prune -f
	docker volume prune -f

clean-all: clean
	docker rmi api-gateway:latest user-service:latest task-service:latest notification-service:latest frontend:latest || true

# Database operations
db-reset:
	docker-compose down postgres
	docker volume rm $(shell docker-compose config --volumes | grep postgres) || true
	docker-compose up -d postgres

# Monitoring
monitor:
	@echo "=== Service Status ==="
	docker-compose ps
	@echo ""
	@echo "=== API Gateway Logs ==="
	docker-compose logs --tail=10 api-gateway
	@echo ""
	@echo "=== Database Status ==="
	docker-compose logs --tail=5 postgres

# Setup for different environments
setup-minikube:
	@echo "Setting up for Minikube..."
	minikube start --driver=docker
	eval $(minikube docker-env)
	make build
	@echo "Add to /etc/hosts: $(minikube ip) taskmanager.local"

setup-local:
	@echo "Setting up for local development..."
	make build
	make start
	@echo "Services will be available at:"
	@echo "Frontend: http://localhost:8080"
	@echo "API: http://localhost:3000"
