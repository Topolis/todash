import { registerValueFunction } from '@server/valueFunctions';
import { logger } from '../../lib/logger';

/**
 * System stats plugin configuration
 */
export interface SystemConfig {
  refreshSeconds?: number;
}

/**
 * System stats data
 */
export interface SystemData {
  cpu: {
    manufacturer?: string;
    brand: string;
    cores: number;
  };
  load: number;
  mem: {
    total: number;
    free: number;
    used: number;
  };
  os: {
    platform: string;
    distro: string;
    release: string;
  };
}

// Global variable for CPU load calculation
declare global {
  var __cpuPrevSample: { total: number; idle: number; ts: number } | undefined;
}

/**
 * Register system value functions for status widget
 */
registerValueFunction('cpu-load', async () => {
  const os = await import('os');
  const cpus = os.cpus();
  const total = cpus.reduce(
    (acc, c) => acc + c.times.user + c.times.nice + c.times.sys + c.times.irq + c.times.idle,
    0
  );
  const idle = cpus.reduce((acc, c) => acc + c.times.idle, 0);

  if (!global.__cpuPrevSample) {
    global.__cpuPrevSample = { total, idle, ts: Date.now() };
    return Math.round((1 - idle / total) * 100);
  }

  const prev = global.__cpuPrevSample;
  global.__cpuPrevSample = { total, idle, ts: Date.now() };
  const dTotal = total - prev.total;
  const dIdle = idle - prev.idle;
  const dBusy = dTotal - dIdle;
  return dTotal > 0 ? Math.round((dBusy / dTotal) * 100) : 0;
});

registerValueFunction('memory-used', async () => {
  const os = await import('os');
  return os.totalmem() - os.freemem();
});

registerValueFunction('memory-total', async () => {
  const os = await import('os');
  return os.totalmem();
});

/**
 * Generic sensor reader - reads any sensor from /sys/class/hwmon/
 * Config options:
 * - name: sensor name to match (e.g., "k10temp", "acpitz", "nvme")
 * - input: input file to read (e.g., "temp1_input", "temp2_input")
 * - divisor: divisor to convert raw value (default: 1000 for temperature)
 */
registerValueFunction('sensor', async ({ name, input = 'temp1_input', divisor = 1000 }: { name: string; input?: string; divisor?: number }) => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const hwmonPath = '/sys/class/hwmon';

    // Check if hwmon exists
    try {
      await fs.access(hwmonPath);
    } catch (e) {
      console.warn(`[sensor] hwmon not available at ${hwmonPath}`);
      return null;
    }

    const dirs = await fs.readdir(hwmonPath);
    for (const dir of dirs) {
      try {
        const namePath = path.join(hwmonPath, dir, 'name');
        const sensorName = (await fs.readFile(namePath, 'utf8')).trim();

        // Check if this is the sensor we're looking for (case-insensitive partial match)
        const nameMatch = name.toLowerCase();
        const sensorNameLower = sensorName.toLowerCase();

        if (sensorNameLower.includes(nameMatch) || nameMatch.includes(sensorNameLower)) {
          const inputPath = path.join(hwmonPath, dir, input);

          try {
            const rawValue = await fs.readFile(inputPath, 'utf8');
            const value = parseInt(rawValue.trim()) / divisor;

            if (!isNaN(value)) {
              const result = Math.round(value * 10) / 10;
              console.log(`[sensor] Found ${name} -> ${sensorName}: ${result} (from ${inputPath})`);
              return result;
            }
          } catch (e) {
            logger.warn('sensor', `Could not read ${inputPath}`, (e as Error).message);
          }
        }
      } catch (e) {
        // Skip this sensor
        continue;
      }
    }
    logger.warn('sensor', `Sensor not found: "${name}" (input: ${input})`);
  } catch (e) {
    logger.error('sensor', 'Error reading hwmon', e);
  }
  return null;
});



/**
 * Fetch system stats data
 */
export async function fetchSystemData(config: SystemConfig): Promise<SystemData> {
  // Dynamically import systeminformation to avoid bundling in frontend
  const si = await import('systeminformation');

  const [cpu, mem, osInfo, currentLoad] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.osInfo(),
    si.currentLoad(),
  ]);

  return {
    cpu: {
      manufacturer: cpu.manufacturer,
      brand: cpu.brand,
      cores: cpu.cores,
    },
    load: currentLoad.currentLoad,
    mem: {
      total: mem.total,
      free: mem.free,
      used: mem.used,
    },
    os: {
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
    },
  };
}
