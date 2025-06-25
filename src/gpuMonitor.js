const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

class GPUMonitor {
  constructor() {
    this.isGPUAvailable = false;
    this.gpuInfo = null;
    this.monitoringInterval = null;
    this.checkInterval = parseInt(process.env.GPU_CHECK_INTERVAL) || 30000; // Check every 30 seconds
  }

  async checkGPUAvailability() {
    try {
      console.log("🔍 Checking NVIDIA GPU availability...");

      // Try to run nvidia-smi command
      const { stdout, stderr } = await execAsync(
        "nvidia-smi --query-gpu=name,memory.total,memory.used,utilization.gpu --format=csv,noheader,nounits"
      );

      if (stderr) {
        console.warn("⚠️ nvidia-smi stderr:", stderr);
      }

      const gpuLines = stdout.trim().split("\n");
      const gpus = gpuLines.map((line) => {
        const [name, memoryTotal, memoryUsed, utilization] = line.split(", ");
        return {
          name: name.trim(),
          memoryTotal: parseInt(memoryTotal),
          memoryUsed: parseInt(memoryUsed),
          memoryFree: parseInt(memoryTotal) - parseInt(memoryUsed),
          utilization: parseInt(utilization),
        };
      });

      this.isGPUAvailable = true;
      this.gpuInfo = gpus;

      console.log("✅ NVIDIA GPU detected:");
      gpus.forEach((gpu, index) => {
        console.log(`   GPU ${index}: ${gpu.name}`);
        console.log(
          `   Memory: ${gpu.memoryUsed}MB / ${gpu.memoryTotal}MB (${gpu.memoryFree}MB free)`
        );
        console.log(`   Utilization: ${gpu.utilization}%`);
      });

      return true;
    } catch (error) {
      this.isGPUAvailable = false;
      this.gpuInfo = null;

      if (error.code === "ENOENT") {
        console.log(
          "❌ NVIDIA drivers not found - falling back to CPU processing"
        );
        console.log(
          "   Install NVIDIA drivers and CUDA toolkit for GPU acceleration"
        );
      } else {
        console.log("❌ GPU check failed:", error.message);
        console.log("   Falling back to CPU processing");
      }

      return false;
    }
  }

  async getGPUStats() {
    if (!this.isGPUAvailable) {
      return null;
    }

    try {
      const { stdout } = await execAsync(
        "nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits"
      );

      const gpuLines = stdout.trim().split("\n");
      const stats = gpuLines.map((line) => {
        const [utilization, memoryUsed, memoryTotal, temperature] =
          line.split(", ");
        return {
          utilization: parseInt(utilization),
          memoryUsed: parseInt(memoryUsed),
          memoryTotal: parseInt(memoryTotal),
          memoryFree: parseInt(memoryTotal) - parseInt(memoryUsed),
          temperature: parseInt(temperature),
        };
      });

      return stats;
    } catch (error) {
      console.error("Failed to get GPU stats:", error.message);
      return null;
    }
  }

  isGPUReady() {
    if (!this.isGPUAvailable || !this.gpuInfo) {
      return false;
    }

    // Check if any GPU has enough free memory (at least 1GB) and low utilization
    return this.gpuInfo.some(
      (gpu) =>
        gpu.memoryFree > 1024 && // At least 1GB free
        gpu.utilization < 90 // Less than 90% utilization
    );
  }

  startMonitoring() {
    if (this.monitoringInterval) {
      return;
    }

    console.log("🖥️ Starting GPU monitoring...");

    this.monitoringInterval = setInterval(async () => {
      await this.updateGPUStatus();
    }, this.checkInterval);

    // Initial check
    this.updateGPUStatus();
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log("🛑 GPU monitoring stopped");
    }
  }

  async updateGPUStatus() {
    try {
      const stats = await this.getGPUStats();

      if (stats) {
        this.gpuInfo = this.gpuInfo.map((gpu, index) => ({
          ...gpu,
          ...stats[index],
        }));

        // Log status periodically (every 5 minutes)
        if (Date.now() % (5 * 60 * 1000) < this.checkInterval) {
          this.logGPUStatus();
        }
      }
    } catch (error) {
      console.error("Error updating GPU status:", error.message);
    }
  }

  logGPUStatus() {
    if (!this.isGPUAvailable || !this.gpuInfo) {
      console.log("📊 GPU Status: Not available - using CPU processing");
      return;
    }

    console.log("📊 GPU Status:");
    this.gpuInfo.forEach((gpu, index) => {
      const readyStatus =
        gpu.memoryFree > 1024 && gpu.utilization < 90 ? "🟢 Ready" : "🔴 Busy";
      console.log(`   GPU ${index}: ${readyStatus}`);
      console.log(
        `   Utilization: ${gpu.utilization}% | Memory: ${gpu.memoryUsed}/${gpu.memoryTotal}MB | Temp: ${gpu.temperature}°C`
      );
    });
  }

  getStatus() {
    return {
      available: this.isGPUAvailable,
      ready: this.isGPUReady(),
      gpus: this.gpuInfo,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = new GPUMonitor();
