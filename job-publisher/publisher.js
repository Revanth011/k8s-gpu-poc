#!/usr/bin/env node

const JobPublisher = require("./JobPublisher");

async function main() {
  const publisher = new JobPublisher();

  try {
    await publisher.connect();

    // Get command line arguments
    const args = process.argv.slice(2);
    const numJobs = parseInt(args[0]) || 1;
    const quality = parseInt(args[1]) || 80;
    const format = args[2] || "jpeg";
    const width = args[3] ? parseInt(args[3]) : null;
    const height = args[4] ? parseInt(args[4]) : null;

    console.log(`🚀 Publishing ${numJobs} job(s) with:`);
    console.log(`   Quality: ${quality}%`);
    console.log(`   Format: ${format}`);
    if (width || height) {
      console.log(`   Dimensions: ${width || "auto"} x ${height || "auto"}`);
    }
    console.log("");

    if (numJobs === 1) {
      // Single job
      const job = await publisher.publishJob({
        originalName: `test-image-${Date.now()}.jpg`,
        quality,
        format,
        width,
        height,
        metadata: {
          publishedBy: "CLI",
          publishTime: new Date().toISOString(),
        },
      });

      console.log(`\n📊 Job published with ID: ${job.id}`);
    } else {
      // Multiple jobs
      const jobs = [];
      for (let i = 0; i < numJobs; i++) {
        jobs.push({
          originalName: `test-image-${Date.now()}-${i + 1}.jpg`,
          quality: quality + (Math.random() * 20 - 10), // Vary quality slightly
          format,
          width,
          height,
          metadata: {
            publishedBy: "CLI-Batch",
            batchIndex: i + 1,
            publishTime: new Date().toISOString(),
          },
        });
      }

      await publisher.publishMultipleJobs(jobs);
    }

    // Show queue status
    const queueInfo = await publisher.getQueueInfo();
    console.log(`\n📊 Queue Status:`);
    console.log(`   Messages in queue: ${queueInfo.messageCount}`);
    console.log(`   Active consumers: ${queueInfo.consumerCount}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await publisher.disconnect();
  }
}

// Handle script execution
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
}
