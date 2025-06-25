### Prerequisites

- Docker Desktop installed
- For GPU support: NVIDIA Docker runtime (optional)

### Quick Start with Docker

#### 1. Start RabbitMQ Service

```powershell
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 `
  -e RABBITMQ_DEFAULT_USER=admin `
  -e RABBITMQ_DEFAULT_PASS=password `
  rabbitmq:3-management
```

#### 2. Build the Application Image

```powershell
docker build -t image-compression-gpu:latest .
```

#### 3. Run the Image Compression Service

```powershell
# Basic run command
docker run -d --name image-consumer `
  -v "${PWD}\test-images:/app/test-images" `
  -v "${PWD}\output:/app/output" `
  -v "${PWD}\logs:/app/logs" `
  image-compression-gpu:latest
```

#### 4. Run with GPU Support (if available)

```powershell
docker run -d --name image-consumer-gpu `
  --runtime=nvidia `
  -e NVIDIA_VISIBLE_DEVICES=all `
  -v "${PWD}\test-images:/app/test-images" `
  -v "${PWD}\output:/app/output" `
  -v "${PWD}\logs:/app/logs" `
  image-compression-gpu:latest
```

### Docker Management Commands

#### View Container Logs

```powershell
# View consumer logs
docker logs -f image-consumer

# View RabbitMQ logs
docker logs -f rabbitmq
```

#### Stop and Clean Up

```powershell
# Stop containers
docker stop image-consumer rabbitmq

# Remove containers
docker rm image-consumer rabbitmq

# Remove image
docker rmi image-compression-gpu:latest
```

#### Health Checks

```powershell
# Check container status
docker ps

# Check RabbitMQ management UI
# Open browser: http://localhost:15672
# Login: admin / password

# Verify GPU access (if using GPU runtime)
docker exec -it image-consumer-gpu nvidia-smi
```
