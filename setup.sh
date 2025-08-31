#!/bin/bash

# Task Manager Microservices Setup Script
# This script helps you get started with the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Task Manager Microservices Setup${NC}"
echo "========================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1${NC}"
        exit 1
    fi
}

# Check prerequisites
echo -e "\n${YELLOW}📋 Checking prerequisites...${NC}"

if command_exists docker; then
    echo -e "${GREEN}✅ Docker found${NC}"
else
    echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if command_exists docker-compose; then
    echo -e "${GREEN}✅ Docker Compose found${NC}"
else
    echo -e "${RED}❌ Docker Compose not found. Please install Docker Compose.${NC}"
    exit 1
fi

# Check if Docker is running
docker info >/dev/null 2>&1
print_status "Docker daemon is running"

# Ask user for deployment type
echo -e "\n${YELLOW}🎯 Choose deployment option:${NC}"
echo "1) Docker Compose (Recommended for beginners)"
echo "2) Kubernetes (Minikube)"
echo "3) Development mode (Individual services)"
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo -e "\n${BLUE}🐳 Setting up with Docker Compose...${NC}"

        # Build images
        echo -e "\n${YELLOW}🔨 Building Docker images...${NC}"
        make build
        print_status "Docker images built"

        # Start services
        echo -e "\n${YELLOW}🚀 Starting services...${NC}"
        make start
        print_status "Services started"

        # Wait for services to be ready
        echo -e "\n${YELLOW}⏳ Waiting for services to be ready...${NC}"
        sleep 30

        # Check service health
        echo -e "\n${YELLOW}🏥 Checking service health...${NC}"

        services=("api-gateway:3000" "user-service:4000" "task-service:5000" "notification-service:6000")
        for service in "${services[@]}"; do
            service_name=$(echo $service | cut -d':' -f1)
            port=$(echo $service | cut -d':' -f2)

            if curl -f http://localhost:$port/health >/dev/null 2>&1; then
                echo -e "${GREEN}✅ $service_name is healthy${NC}"
            else
                echo -e "${YELLOW}⚠️  $service_name may still be starting...${NC}"
            fi
        done

        echo -e "\n${GREEN}🎉 Setup complete!${NC}"
        echo -e "${BLUE}📱 Access your application:${NC}"
        echo "   Frontend: http://localhost:8080"
        echo "   API Gateway: http://localhost:3000"
        echo ""
        echo -e "${YELLOW}📝 Next steps:${NC}"
        echo "   1. Open http://localhost:8080 in your browser"
        echo "   2. Register a new account"
        echo "   3. Create some tasks to test the system"
        echo "   4. Check logs with: make logs"
        echo "   5. Stop services with: make stop"
        ;;

    2)
        echo -e "\n${BLUE}☸️  Setting up with Kubernetes (Minikube)...${NC}"

        if ! command_exists kubectl; then
            echo -e "${RED}❌ kubectl not found. Please install kubectl first.${NC}"
            exit 1
        fi

        if ! command_exists minikube; then
            echo -e "${RED}❌ Minikube not found. Please install Minikube first.${NC}"
            exit 1
        fi

        # Start Minikube
        echo -e "\n${YELLOW}🚀 Starting Minikube...${NC}"
        minikube start --driver=docker
        print_status "Minikube started"

        # Enable ingress addon
        minikube addons enable ingress
        print_status "Ingress addon enabled"

        # Use Minikube's Docker daemon
        eval $(minikube docker-env)

        # Build images
        echo -e "\n${YELLOW}🔨 Building Docker images...${NC}"
        make build
        print_status "Docker images built in Minikube"

        # Deploy to Kubernetes
        echo -e "\n${YELLOW}☸️  Deploying to Kubernetes...${NC}"
        make k8s-deploy
        print_status "Deployed to Kubernetes"

        # Get Minikube IP
        MINIKUBE_IP=$(minikube ip)

        # Add to hosts file (requires sudo)
        echo -e "\n${YELLOW}🌐 Adding host entry...${NC}"
        echo "You may be prompted for sudo password to update /etc/hosts"

        if grep -q "taskmanager.local" /etc/hosts; then
            sudo sed -i "/taskmanager.local/d" /etc/hosts
        fi
        echo "$MINIKUBE_IP taskmanager.local" | sudo tee -a /etc/hosts
        print_status "Host entry added"

        echo -e "\n${GREEN}🎉 Kubernetes setup complete!${NC}"
        echo -e "${BLUE}📱 Access your application:${NC}"
        echo "   Frontend: http://taskmanager.local"
        echo "   Minikube Dashboard: minikube dashboard"
        echo ""
        echo -e "${YELLOW}📝 Useful commands:${NC}"
        echo "   kubectl get pods -n task-manager"
        echo "   kubectl logs deployment/api-gateway -n task-manager"
        echo "   make k8s-status"
        echo "   make k8s-delete (to cleanup)"
        ;;

    3)
        echo -e "\n${BLUE}💻 Setting up development mode...${NC}"

        # Check development prerequisites
        if ! command_exists node; then
            echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
            exit 1
        fi

        if ! command_exists python3; then
            echo -e "${RED}❌ Python3 not found. Please install Python 3.11+${NC}"
            exit 1
        fi

        if ! command_exists go; then
            echo -e "${RED}❌ Go not found. Please install Go 1.21+${NC}"
            exit 1
        fi

        # Start supporting services
        echo -e "\n${YELLOW}🗄️  Starting database and cache...${NC}"
        docker-compose up -d postgres redis
        print_status "Database and Redis started"

        # Install dependencies
        echo -e "\n${YELLOW}📦 Installing dependencies...${NC}"

        cd api-gateway && npm install && cd ..
        print_status "API Gateway dependencies installed"

        cd user-service && pip install -r requirements.txt && cd ..
        print_status "User Service dependencies installed"

        cd task-service && go mod tidy && cd ..
        print_status "Task Service dependencies installed"

        cd notification-service && npm install && cd ..
        print_status "Notification Service dependencies installed"

        cd frontend && npm install && cd ..
        print_status "Frontend dependencies installed"

        echo -e "\n${GREEN}🎉 Development setup complete!${NC}"
        echo -e "${BLUE}📱 To start development servers:${NC}"
        echo "   make dev-user      # User Service (Python)"
        echo "   make dev-task      # Task Service (Go)"
        echo "   make dev-notification  # Notification Service"
        echo "   make dev-gateway   # API Gateway"
        echo "   make dev-frontend  # React Frontend"
        echo ""
        echo -e "${YELLOW}📝 Run each in a separate terminal window${NC}"
        ;;

    *)
        echo -e "${RED}❌ Invalid choice. Please run the script again.${NC}"
        exit 1
        ;;
esac

# Create useful aliases
echo -e "\n${YELLOW}🔧 Creating useful aliases...${NC}"
cat > ~/.task-manager-aliases << 'EOF'
# Task Manager Aliases
alias tm-start='make start'
alias tm-stop='make stop'
alias tm-logs='make logs'
alias tm-status='docker-compose ps'
alias tm-build='make build'
alias tm-clean='make clean'
alias tm-k8s-deploy='make k8s-deploy'
alias tm-k8s-status='make k8s-status'
alias tm-k8s-delete='make k8s-delete'
EOF

echo -e "${GREEN}✅ Aliases created in ~/.task-manager-aliases${NC}"
echo -e "${YELLOW}💡 Add 'source ~/.task-manager-aliases' to your shell profile to use them${NC}"

# Final instructions
echo -e "\n${BLUE}🎓 Learning Resources:${NC}"
echo "   • Docker: https://docs.docker.com/"
echo "   • Kubernetes: https://kubernetes.io/docs/"
echo "   • Microservices: https://microservices.io/"
echo "   • DevOps: https://roadmap.sh/devops"

echo -e "\n${GREEN}✨ Happy learning! ✨${NC}"
