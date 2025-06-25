const amqp = require("amqplib");

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://admin:password@localhost:5672";
const QUEUE_NAME = "image_compression_queue";

async function monitorQueue() {
  let connection, channel;

  try {
    console.log("🔌 Connecting to RabbitMQ...");
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAME, { durable: true });

    console.log("👀 Monitoring queue status...");
    console.log("Press Ctrl+C to stop");

    const monitorInterval = setInterval(async () => {
      try {
        const queueInfo = await channel.checkQueue(QUEUE_NAME);
        const timestamp = new Date().toISOString();

        console.log(`\n📊 [${timestamp}] Queue Status:`);
        console.log(`   Queue: ${QUEUE_NAME}`);
        console.log(`   Messages in queue: ${queueInfo.messageCount}`);
        console.log(`   Consumers: ${queueInfo.consumerCount}`);

        if (queueInfo.messageCount === 0) {
          console.log("   ✅ Queue is empty");
        } else {
          console.log(`   ⏳ ${queueInfo.messageCount} job(s) waiting`);
        }

        if (queueInfo.consumerCount === 0) {
          console.log("   ⚠️ No consumers connected");
        } else {
          console.log(`   👂 ${queueInfo.consumerCount} consumer(s) active`);
        }
      } catch (error) {
        console.error("❌ Error checking queue:", error.message);
      }
    }, 5000); // Check every 5 seconds

    process.on("SIGINT", async () => {
      console.log("\n🛑 Stopping queue monitor...");
      clearInterval(monitorInterval);
      await channel.close();
      await connection.close();
      console.log("✅ Disconnected from RabbitMQ");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Error connecting to RabbitMQ:", error);
    process.exit(1);
  }
}

monitorQueue().catch(console.error);
