const amqp = require("amqplib");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://admin:password@localhost:5672";
const QUEUE_NAME = "image_compression_queue";

async function publishTestJob() {
  let connection, channel;

  try {
    console.log("🔌 Connecting to RabbitMQ...");
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAME, { durable: true });

    // Create a test job
    const jobId = uuidv4();
    const testJob = {
      id: jobId,
      inputPath: "/app/input/test-image.jpg", // This would be a real image path
      filename: `test-${jobId}.jpg`,
      originalName: "test-image.jpg",
      options: {
        quality: 75,
        format: "jpeg",
        width: null,
        height: null,
      },
      timestamp: new Date().toISOString(),
    };

    const message = Buffer.from(JSON.stringify(testJob));

    await channel.sendToQueue(QUEUE_NAME, message, { persistent: true });

    console.log(`✅ Published test job: ${jobId}`);
    console.log(`   Job details:`, testJob);

    await channel.close();
    await connection.close();
  } catch (error) {
    console.error("❌ Error publishing test job:", error);
  }
}

// Publish multiple test jobs if argument provided
const numJobs = parseInt(process.argv[2]) || 1;

async function publishMultipleJobs() {
  console.log(`📦 Publishing ${numJobs} test job(s)...`);

  for (let i = 0; i < numJobs; i++) {
    await publishTestJob();

    // Wait a bit between jobs
    if (i < numJobs - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`🎉 All ${numJobs} test job(s) published!`);
}

publishMultipleJobs().catch(console.error);
