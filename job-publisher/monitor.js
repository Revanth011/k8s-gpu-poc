#!/usr/bin/env node

const JobPublisher = require("./JobPublisher");

async function monitorQueue() {
  const publisher = new JobPublisher();

  try {
    await publisher.connect();

    console.log("👀 Starting queue monitor...");
    console.log("Press Ctrl+C to stop\n");

    const monitor = async () => {
      try {
        const queueInfo = await publisher.getQueueInfo();
        const timestamp = new Date().toLocaleString();

        // Clear screen and move cursor to top
        process.stdout.write("\x1b[2J\x1b[H");

        console.log(`📊 [${timestamp}] Queue Status:`);
        console.log(`   Queue: ${queueInfo.queue}`);
        console.log(`   Messages waiting: ${queueInfo.messageCount}`);
        console.log(`   Active consumers: ${queueInfo.consumerCount}`);

        if (queueInfo.messageCount === 0) {
          console.log("   ✅ Queue is empty");
        } else {
          console.log(`   ⏳ ${queueInfo.messageCount} job(s) pending`);
        }

        if (queueInfo.consumerCount === 0) {
          console.log("   ⚠️  No consumers connected!");
        } else {
          console.log(`   👂 ${queueInfo.consumerCount} consumer(s) active`);
        }

        console.log("\n📝 Press Ctrl+C to stop monitoring");
      } catch (error) {
        console.error("❌ Error checking queue:", error.message);
      }
    };

    // Initial check
    await monitor();

    // Set up periodic monitoring
    const intervalId = setInterval(monitor, 5000); // Check every 5 seconds

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Stopping queue monitor...");
      clearInterval(intervalId);
      await publisher.disconnect();
      console.log("✅ Monitor stopped");
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\n🛑 Stopping queue monitor...");
      clearInterval(intervalId);
      await publisher.disconnect();
      console.log("✅ Monitor stopped");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start monitor:", error.message);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  monitorQueue().catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
}
