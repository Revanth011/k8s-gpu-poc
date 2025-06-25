require("dotenv").config();
const fs = require("fs-extra");
const rabbitmq = require("./rabbitmq");
const imageProcessor = require("./imageProcessor");
const gpuMonitor = require("./gpuMonitor");

// Ensure directories exist
const ensureDirectories = async () => {
  await fs.ensureDir("./input");
  await fs.ensureDir("./output");
  await fs.ensureDir("./logs");
};

// Initialize queue consumer service
const init = async () => {
  try {
    console.log("🚀 Starting Image Compression Queue Consumer...");
    console.log("📅 Started at:", new Date().toISOString());

    await ensureDirectories();
    console.log("📁 Directories initialized");

    // Check GPU availability
    await gpuMonitor.checkGPUAvailability();

    // Connect to RabbitMQ
    await rabbitmq.connect();
    console.log("🐰 Connected to RabbitMQ");

    // Start consuming jobs from queue
    await rabbitmq.startConsumer();
    console.log("👂 Queue consumer started - waiting for jobs...");

    // Start GPU monitoring
    gpuMonitor.startMonitoring();
    console.log("🖥️ GPU monitoring started");
  } catch (error) {
    console.error("❌ Failed to initialize queue consumer:", error);
    process.exit(1);
  }
};

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(
    `🛑 Received ${signal} - Shutting down queue consumer gracefully...`
  );
  gpuMonitor.stopMonitoring();
  await rabbitmq.disconnect();
  console.log("✅ Queue consumer stopped");
  process.exit(0);
};

// Register signal handlers
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

init();
