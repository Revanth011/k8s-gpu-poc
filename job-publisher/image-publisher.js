#!/usr/bin/env node

const JobPublisher = require("./JobPublisher");
const path = require("path");

async function publishImageJob(imagePath, options = {}) {
  const publisher = new JobPublisher();

  try {
    await publisher.connect();

    const filename = path.basename(imagePath);
    const ext = path.extname(filename).toLowerCase();

    // Validate image extension
    const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".tiff", ".bmp"];
    if (!validExtensions.includes(ext)) {
      throw new Error(
        `Invalid image format. Supported: ${validExtensions.join(", ")}`
      );
    }

    console.log(`📸 Publishing image job:`);
    console.log(`   File: ${filename}`);
    console.log(`   Path: ${imagePath}`);
    console.log(""); // Create job with path exactly as provided
    const job = await publisher.publishJob({
      inputPath: imagePath,
      filename: filename,
      originalName: filename,
      quality: options.quality || 80,
      format: options.format || "jpeg",
      width: options.width || null,
      height: options.height || null,
      metadata: {
        publishedBy: "Real-Image-Publisher",
        publishTime: new Date().toISOString(),
      },
    });

    console.log(`✅ Job published with ID: ${job.id}`);

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

async function publishMultipleImages(imageDirectory, options = {}) {
  const publisher = new JobPublisher();

  try {
    await publisher.connect();

    // Common image extensions to look for
    const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".tiff", ".bmp"];

    // For directories, we'll assume they exist and let the consumer handle errors
    console.log(
      `📁 Publishing jobs for images in directory: ${imageDirectory}`
    );
    console.log("");

    // Publish jobs for common image file patterns
    const commonFiles = ["image.jpg", "photo.jpg", "test.png", "sample.jpg"];
    const jobs = [];

    for (const file of commonFiles) {
      const imagePath = path.join(imageDirectory, file);

      console.log(`📦 Publishing job for: ${file}`);

      const job = await publisher.publishJob({
        inputPath: imagePath,
        filename: file,
        originalName: file,
        quality: options.quality || 80,
        format: options.format || "jpeg",
        width: options.width || null,
        height: options.height || null,
        metadata: {
          publishedBy: "Batch-Image-Publisher",
          publishTime: new Date().toISOString(),
        },
      });

      jobs.push(job);

      // Small delay between jobs
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`\n✅ Published ${jobs.length} image jobs!`);

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

// Command line interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
📸 Real Image Job Publisher

Usage:
  node image-publisher.js <image-path> [quality] [format] [width] [height]
  node image-publisher.js <directory-path> [quality] [format] [width] [height]

Examples:
  # Single image (any path - local or container)
  node image-publisher.js C:\\Images\\photo.jpg 85 webp
  node image-publisher.js /app/input/photo.jpg 90 jpeg 1920 1080
  
  # Directory (publishes jobs for common image names)
  node image-publisher.js C:\\Images\\ 80 jpeg
  node image-publisher.js /app/input/ 75 webp 1280 720

Arguments:
  image-path/directory-path  Path to image file or directory (any format)
  quality                   Compression quality 1-100 (default: 80)
  format                    Output format: jpeg|png|webp (default: jpeg)
  width                     Target width in pixels (optional)
  height                    Target height in pixels (optional)

Note: This publisher accepts any path and lets the consumer handle validation.
`);
    return;
  }

  const imagePath = args[0];
  const options = {
    quality: args[1] ? parseInt(args[1]) : 80,
    format: args[2] || "jpeg",
    width: args[3] ? parseInt(args[3]) : null,
    height: args[4] ? parseInt(args[4]) : null,
  };

  // Simple heuristic: if path ends with slash or backslash, treat as directory
  if (imagePath.endsWith("/") || imagePath.endsWith("\\")) {
    await publishMultipleImages(imagePath, options);
  } else {
    await publishImageJob(imagePath, options);
  }
}

// Handle script execution
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
}
