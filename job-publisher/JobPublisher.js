require("dotenv").config();
const amqp = require("amqplib");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

class JobPublisher {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.queueName = process.env.QUEUE_NAME || "image_compression_queue";
    this.rabbitUrl =
      process.env.RABBITMQ_URL || "amqp://admin:password@localhost:5672";
  }

  async connect() {
    try {
      console.log("🔌 Connecting to RabbitMQ...");
      this.connection = await amqp.connect(this.rabbitUrl);
      this.channel = await this.connection.createChannel();

      await this.channel.assertQueue(this.queueName, { durable: true });
      console.log("✅ Connected to RabbitMQ successfully");
    } catch (error) {
      console.error("❌ Failed to connect to RabbitMQ:", error.message);
      throw error;
    }
  }
  async publishJob(jobData) {
    try {
      if (!this.channel) {
        throw new Error("Not connected to RabbitMQ");
      }

      // Validate that inputPath is provided
      if (!jobData.inputPath) {
        throw new Error("inputPath is required for publishing a job");
      }

      const jobId = uuidv4();
      const job = {
        id: jobId,
        inputPath: jobData.inputPath,
        filename: jobData.filename || path.basename(jobData.inputPath),
        originalName:
          jobData.originalName ||
          jobData.filename ||
          path.basename(jobData.inputPath),
        options: {
          quality:
            jobData.quality || parseInt(process.env.DEFAULT_QUALITY) || 80,
          format: jobData.format || process.env.DEFAULT_FORMAT || "jpeg",
          width:
            jobData.width ||
            (process.env.DEFAULT_WIDTH
              ? parseInt(process.env.DEFAULT_WIDTH)
              : null),
          height:
            jobData.height ||
            (process.env.DEFAULT_HEIGHT
              ? parseInt(process.env.DEFAULT_HEIGHT)
              : null),
        },
        timestamp: new Date().toISOString(),
        metadata: jobData.metadata || {},
      };

      const message = Buffer.from(JSON.stringify(job));

      await this.channel.sendToQueue(this.queueName, message, {
        persistent: true,
      });

      console.log(`📦 Published job: ${jobId}`);
      console.log(`   File: ${job.originalName}`);
      console.log(`   Quality: ${job.options.quality}%`);
      console.log(`   Format: ${job.options.format}`);

      return job;
    } catch (error) {
      console.error("❌ Failed to publish job:", error.message);
      throw error;
    }
  }

  async publishMultipleJobs(jobs) {
    const results = [];
    const batchSize = parseInt(process.env.BATCH_SIZE) || 10;
    const interval = parseInt(process.env.PUBLISH_INTERVAL) || 1000;

    console.log(
      `📦 Publishing ${jobs.length} jobs in batches of ${batchSize}...`
    );

    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);

      console.log(
        `\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          jobs.length / batchSize
        )}`
      );

      for (const jobData of batch) {
        const job = await this.publishJob(jobData);
        results.push(job);

        // Small delay between jobs in batch
        if (batch.indexOf(jobData) < batch.length - 1) {
          await this.delay(100);
        }
      }

      // Delay between batches
      if (i + batchSize < jobs.length) {
        console.log(`⏳ Waiting ${interval}ms before next batch...`);
        await this.delay(interval);
      }
    }

    console.log(`\n✅ All ${jobs.length} jobs published successfully!`);
    return results;
  }

  async getQueueInfo() {
    try {
      if (!this.channel) {
        throw new Error("Not connected to RabbitMQ");
      }

      const queueInfo = await this.channel.checkQueue(this.queueName);
      return {
        queue: this.queueName,
        messageCount: queueInfo.messageCount,
        consumerCount: queueInfo.consumerCount,
      };
    } catch (error) {
      console.error("❌ Failed to get queue info:", error.message);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      console.log("🔌 Disconnected from RabbitMQ");
    } catch (error) {
      console.error("Error disconnecting:", error.message);
    }
  }
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = JobPublisher;
