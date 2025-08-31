**Default login credentials:**
- Email: `john@example.com` or `jane@example.com`
- Password: `password123` (or register your own account)

## 🎯 **Next Learning Steps**

Once you have the basic setup running:

1. **Explore the code** - Each service shows different patterns
2. **Modify something** - Add a new field to tasks, change the UI
3. **Break something** - Stop a service and see how it fails gracefully
4. **Scale it** - Increase replicas in Kubernetes
5. **Monitor it** - Add the Prometheus setup from the monitoring files

## 🔧 **Troubleshooting**

**If services fail to start:**
```bash
# Check logs
docker-compose logs service-name

# Restart a specific service
docker-compose restart service-name

# Reset everything
make clean
make build
make start
```

**Common issues:**
- **Port conflicts**: Stop other services using ports 3000-8080
- **Docker memory**: Increase Docker memory to 4GB+
- **Permission issues**: Make sure Docker daemon is running

## 🌐 **Cloud Deployment Tips**

**For OCI (Oracle Kubernetes Engine):**
1. Create an OKE cluster
2. Update image references to OCIR (Oracle Container Registry)
3. Configure `kubectl` with your OCI credentials
4. Run `kubectl apply -f k8s/`

**For Azure (AKS):**
1. Create an AKS cluster
2. Push images to Azure Container Registry (ACR)
3. Update image references in k8s manifests
4. Deploy with `kubectl apply -f k8s/`

This application gives you hands-on experience with:
- **Container orchestration**
- **Service mesh concepts** 
- **Database management in containers**
- **Load balancing and scaling**
- **Secret management**
- **CI/CD pipelines**
- **Monitoring and logging**

The beauty is that you can start simple with Docker Compose and gradually move to more complex Kubernetes deployments as you learn. Each service is intentionally different to expose you to various technologies and patterns used in modern cloud-native applications.

Start with the setup script and let me know if you run into any issues! 🚀
