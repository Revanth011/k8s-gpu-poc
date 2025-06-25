const sharp = require("sharp");
const path = require("path");
const fs = require("fs-extra");
const gpuMonitor = require("./gpuMonitor");

class ImageProcessor {
  constructor() {
    this.processedCount = 0;
    this.totalProcessingTime = 0;
  }
  async compressImage(job) {
    try {
      const { id, inputPath, options, originalName, filename } = job;

      console.log(`🔄 Starting compression for job ${id}`);

      // Add 10-second processing delay
      console.log(`⏳ Processing delay: 10 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
      console.log(`✨ Delay completed, proceeding with compression`);

      // Check GPU status for processing decision
      const gpuStatus = gpuMonitor.getStatus();
      const useGPU = gpuStatus.available && gpuStatus.ready;

      console.log(
        `   Processing mode: ${useGPU ? "🚀 GPU Accelerated" : "🖥️ CPU"}`
      );

      // Generate output filename
      const outputFilename = `compressed-${id}.${options.format}`;
      const outputPath = path.join("./output", outputFilename); // Configure Sharp pipeline with GPU considerations
      let pipeline = sharp(inputPath);

      // If GPU is available, configure for better performance
      if (useGPU) {
        // Set Sharp to use more aggressive settings when GPU is available
        pipeline = pipeline.withMetadata(); // Preserve metadata for better quality
      }

      // Resize if dimensions are specified
      if (options.width || options.height) {
        pipeline = pipeline.resize(options.width, options.height, {
          fit: "inside",
          withoutEnlargement: true,
          kernel: useGPU ? "lanczos3" : "lanczos2", // Better quality with GPU
        });
      }

      // Apply compression based on format with GPU-optimized settings
      switch (options.format.toLowerCase()) {
        case "jpeg":
        case "jpg":
          pipeline = pipeline.jpeg({
            quality: options.quality,
            progressive: true,
            mozjpeg: useGPU, // Use mozjpeg when GPU is available
            optimiseScans: useGPU,
            optimiseCoding: true,
          });
          break;

        case "png":
          pipeline = pipeline.png({
            quality: options.quality,
            compressionLevel: useGPU ? 9 : 6, // Higher compression with GPU
            progressive: true,
            palette: useGPU,
            adaptiveFiltering: useGPU,
          });
          break;

        case "webp":
          pipeline = pipeline.webp({
            quality: options.quality,
            effort: useGPU ? 6 : 4, // Higher effort with GPU
            lossless: false,
            smartSubsample: useGPU,
          });
          break;

        default:
          pipeline = pipeline.jpeg({
            quality: options.quality,
            progressive: true,
            mozjpeg: useGPU,
          });
      }

      // Get input file stats
      const inputStats = await fs.stat(inputPath);
      const inputSize = inputStats.size;

      const startTime = Date.now();

      // Process and save the image
      await pipeline.toFile(outputPath);

      const processingTime = Date.now() - startTime;

      // Update statistics
      this.processedCount++;
      this.totalProcessingTime += processingTime;

      // Get output file stats
      const outputStats = await fs.stat(outputPath);
      const outputSize = outputStats.size;

      // Calculate compression ratio
      const compressionRatio = (
        ((inputSize - outputSize) / inputSize) *
        100
      ).toFixed(2);
      const avgProcessingTime = (
        this.totalProcessingTime /
        this.processedCount /
        1000
      ).toFixed(2);

      console.log(`✅ Job ${id} completed:`);
      console.log(`   Original size: ${this.formatBytes(inputSize)}`);
      console.log(`   Compressed size: ${this.formatBytes(outputSize)}`);
      console.log(`   Compression ratio: ${compressionRatio}%`);
      console.log(`   Processing time: ${(processingTime / 1000).toFixed(2)}s`);
      console.log(`   Average processing time: ${avgProcessingTime}s`);
      console.log(`   Total jobs processed: ${this.processedCount}`);
      console.log(`   Output: ${outputPath}`);

      // Clean up input file (commented out to preserve test images)
      // await fs.remove(inputPath);

      // Log the result
      await this.logResult({
        jobId: id,
        originalName: originalName || filename,
        originalSize: inputSize,
        compressedSize: outputSize,
        compressionRatio,
        processingTime,
        processingMode: useGPU ? "GPU" : "CPU",
        outputPath,
        options,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        outputPath,
        originalSize: inputSize,
        compressedSize: outputSize,
        compressionRatio,
        processingTime,
        processingMode: useGPU ? "GPU" : "CPU",
      };
    } catch (error) {
      console.error(`❌ Error processing job ${job.id}:`, error);

      // Log the error
      await this.logError({
        jobId: job.id,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }
  async logResult(result) {
    try {
      const logPath = path.join("./logs", "compression.log");
      const logEntry = `${result.timestamp} - SUCCESS - Job: ${
        result.jobId
      }, Mode: ${result.processingMode}, Original: ${this.formatBytes(
        result.originalSize
      )}, Compressed: ${this.formatBytes(result.compressedSize)}, Ratio: ${
        result.compressionRatio
      }%, Time: ${(result.processingTime / 1000).toFixed(2)}s\n`;
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      console.error("Failed to write log:", error);
    }
  }

  async logError(errorInfo) {
    try {
      const logPath = path.join("./logs", "errors.log");
      const logEntry = `${errorInfo.timestamp} - ERROR - Job: ${errorInfo.jobId}, Error: ${errorInfo.error}\n`;
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      console.error("Failed to write error log:", error);
    }
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }
}

module.exports = new ImageProcessor();
