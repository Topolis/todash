import { registerValueFunction } from '../valueFunctions.js';
import si from 'systeminformation';

// Register system value functions
registerValueFunction('cpu-load', async () => {
  const os = await import('os');
  const cpus = os.cpus();
  const total = cpus.reduce((acc, c) => acc + c.times.user + c.times.nice + c.times.sys + c.times.irq + c.times.idle, 0);
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

export const systemPlugin = {
  async fetchData(config) {
    const [cpu, mem, osInfo, currentLoad] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.osInfo(),
      si.currentLoad(),
    ]);
    return {
      cpu: { manufacturer: cpu.manufacturer, brand: cpu.brand, cores: cpu.cores },
      load: currentLoad.currentLoad,
      mem: { total: mem.total, free: mem.free, used: mem.used },
      os: { platform: osInfo.platform, distro: osInfo.distro, release: osInfo.release },
    };
  },
};
