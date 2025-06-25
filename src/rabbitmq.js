const amqp = require("amqplib");
const imageProcessor = require("./imageProcessor");
const gpuMonitor = require("./gpuMonitor");

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.queueName = process.env.QUEUE_NAME || "image_compression_queue";
    this.rabbitUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";
    this.isConsuming = false;
    this.consumerTag = null;
    this.prefetchCount = parseInt(process.env.PREFETCH_COUNT) || 1;
  }

  async connect() {
    try {
      console.log("Connecting to RabbitMQ...");
      this.connection = await amqp.connect(this.rabbitUrl);
      this.channel = await this.connection.createChannel();

      // Assert queue exists
      await this.channel.assertQueue(this.queueName, {
        durable: true,
      });

      console.log("Connected to RabbitMQ successfully");

      // Handle connection errors
      this.connection.on("error", (err) => {
        console.error("RabbitMQ connection error:", err);
      });

      this.connection.on("close", () => {
        console.log("RabbitMQ connection closed");
      });
    } catch (error) {
      console.error("Failed to connect to RabbitMQ:", error);
      throw error;
    }
  }

  async publishJob(job) {
    try {
      if (!this.channel) {
        throw new Error("RabbitMQ channel not initialized");
      }

      const message = Buffer.from(JSON.stringify(job));

      await this.channel.sendToQueue(this.queueName, message, {
        persistent: true,
      });

      console.log(`Job ${job.id} published to queue`);
    } catch (error) {
      console.error("Failed to publish job:", error);
      throw error;
    }
  }
  async startConsumer() {
    try {
      if (!this.channel) {
        throw new Error("RabbitMQ channel not initialized");
      } // Set prefetch to process one message at a time for GPU processing
      await this.channel.prefetch(this.prefetchCount);

      console.log("👂 Starting queue consumer...");
      console.log("🔄 Continuously monitoring queue for jobs...");

      const { consumerTag } = await this.channel.consume(
        this.queueName,
        async (message) => {
          if (message !== null) {
            try {
              const job = JSON.parse(message.content.toString());
              console.log(`\n📦 New job received: ${job.id}`);
              console.log(`   File: ${job.originalName || job.filename}`);
              console.log(`   Timestamp: ${job.timestamp}`);

              // Check if GPU is ready for processing
              const gpuStatus = gpuMonitor.getStatus();
              console.log(
                `🖥️ GPU Status: ${
                  gpuStatus.available
                    ? gpuStatus.ready
                      ? "🟢 Ready"
                      : "🔴 Busy"
                    : "❌ Not Available"
                }`
              );

              if (gpuStatus.available && !gpuStatus.ready) {
                console.log("⏳ GPU is busy, waiting for availability...");

                // Wait for GPU to become available
                await this.waitForGPU();
              }

              // Process the image
              console.log(`🔄 Processing job ${job.id}...`);
              const startTime = Date.now();

              await imageProcessor.compressImage(job);

              const processingTime = ((Date.now() - startTime) / 1000).toFixed(
                2
              );
              console.log(`✅ Job ${job.id} completed in ${processingTime}s`);

              // Acknowledge the message
              this.channel.ack(message);
            } catch (error) {
              console.error(`❌ Error processing job:`, error.message);

              // Reject the message and don't requeue it to avoid infinite loops
              this.channel.nack(message, false, false);
            }
          }
        },
        {
          noAck: false, // Manual acknowledgment
        }
      );

      this.consumerTag = consumerTag;
      this.isConsuming = true;
      console.log("✅ Queue consumer started successfully");
    } catch (error) {
      console.error("❌ Failed to start consumer:", error);
      throw error;
    }
  }

  async waitForGPU(
    maxWaitTime = parseInt(process.env.GPU_WAIT_TIMEOUT) || 300000
  ) {
    // Max wait 5 minutes
    const startTime = Date.now();
    const checkInterval = 5000; // Check every 5 seconds

    return new Promise((resolve) => {
      const checkGPU = () => {
        const gpuStatus = gpuMonitor.getStatus();

        if (gpuStatus.ready || !gpuStatus.available) {
          console.log("🚀 GPU ready for processing");
          resolve();
          return;
        }

        if (Date.now() - startTime > maxWaitTime) {
          console.log("⏰ GPU wait timeout, proceeding with current state");
          resolve();
          return;
        }

        console.log("⏳ Still waiting for GPU...");
        setTimeout(checkGPU, checkInterval);
      };

      checkGPU();
    });
  }

  async stopConsumer() {
    try {
      if (this.isConsuming && this.consumerTag) {
        await this.channel.cancel(this.consumerTag);
        this.isConsuming = false;
        this.consumerTag = null;
        console.log("🛑 Queue consumer stopped");
      }
    } catch (error) {
      console.error("Error stopping consumer:", error);
    }
  }
  async disconnect() {
    try {
      await this.stopConsumer();

      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      console.log("🔌 Disconnected from RabbitMQ");
    } catch (error) {
      console.error("Error disconnecting from RabbitMQ:", error);
    }
  }
}

module.exports = new RabbitMQService();
