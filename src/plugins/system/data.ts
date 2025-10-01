import { registerValueFunction } from '@server/valueFunctions';

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

registerValueFunction('cpu-temperature', async () => {
  const si = await import('systeminformation');
  const temp = await si.cpuTemperature();
  // Return null if no temperature data available (common in VMs or systems without sensors)
  if (temp.main === null || temp.main === undefined || temp.main === -1) {
    return null;
  }
  return Math.round(temp.main);
});

registerValueFunction('system-temperature', async () => {
  const si = await import('systeminformation');
  const temp = await si.cpuTemperature();
  // Return average of all cores if available, otherwise main
  if (temp.cores && temp.cores.length > 0) {
    const validCores = temp.cores.filter((t: number) => t !== null && t !== undefined && t !== -1);
    if (validCores.length > 0) {
      const sum = validCores.reduce((acc: number, t: number) => acc + t, 0);
      return Math.round(sum / validCores.length);
    }
  }
  // Fallback to main temperature
  if (temp.main !== null && temp.main !== undefined && temp.main !== -1) {
    return Math.round(temp.main);
  }
  // Return null if no temperature data available
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
