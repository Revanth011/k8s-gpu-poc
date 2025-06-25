# Use latest stable Node.js image
FROM node:lts-slim

# Set default RabbitMQ URL for Docker environment
ENV RABBITMQ_URL=amqp://admin:password@host.docker.internal:5672

# Install only essential dependencies for Sharp.js
RUN apt-get update && apt-get install -y \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY src/ ./src/

# Copy test images
COPY test-images/ ./test-images/

# Create input, output and logs directories
RUN mkdir -p input output logs

# Start the application
CMD ["npm", "start"]
