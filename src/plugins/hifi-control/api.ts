// ABOUTME: Express router for HiFi Control API endpoints
// ABOUTME: Handles device control commands from the widget

import { Router, Request, Response } from 'express';
import { logger } from '@lib/logger';
import { getDeviceType } from './device-types';
import type { DeviceConfig } from './types';

const router = Router();

// Get device instance from config
async function getDevice(dashboardSettings: any) {
  const deviceConfig: DeviceConfig | undefined = dashboardSettings?.['hifi-control']?.device;
  
  if (!deviceConfig) {
    throw new Error('HiFi Control device not configured');
  }
  
  const deviceType = getDeviceType(deviceConfig.type);
  if (!deviceType) {
    throw new Error(`Unknown device type: ${deviceConfig.type}`);
  }
  
  await deviceType.connect(deviceConfig);
  return deviceType;
}

// POST /api/hifi-control/command - Execute a device command
router.post('/command', async (req: Request, res: Response) => {
  try {
    const { command, params, dashboardSettings } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    const device = await getDevice(dashboardSettings);
    
    let result;
    switch (command) {
      case 'powerOn':
        await device.powerOn();
        break;
      case 'powerOff':
        await device.powerOff();
        break;
      case 'powerToggle':
        await device.powerToggle();
        break;
      case 'volumeUp':
        await device.volumeUp();
        break;
      case 'volumeDown':
        await device.volumeDown();
        break;
      case 'setVolume':
        if (params?.volume === undefined) {
          return res.status(400).json({ error: 'Volume parameter required' });
        }
        await device.setVolume(params.volume);
        break;
      case 'mute':
        await device.mute();
        break;
      case 'unmute':
        await device.unmute();
        break;
      case 'toggleMute':
        await device.toggleMute();
        break;
      case 'setInput':
        if (!params?.inputId) {
          return res.status(400).json({ error: 'inputId parameter required' });
        }
        await device.setInput(params.inputId);
        break;
      case 'setSurroundMode':
        if (!params?.mode) {
          return res.status(400).json({ error: 'mode parameter required' });
        }
        if (device.setSurroundMode) {
          await device.setSurroundMode(params.mode);
        } else {
          return res.status(400).json({ error: 'Surround mode not supported' });
        }
        break;
      case 'setZone2Power':
        if (params?.on === undefined) {
          return res.status(400).json({ error: 'on parameter required' });
        }
        if (device.setZone2Power) {
          await device.setZone2Power(params.on);
        } else {
          return res.status(400).json({ error: 'Zone 2 not supported' });
        }
        break;
      case 'setZone2Volume':
        if (params?.volume === undefined) {
          return res.status(400).json({ error: 'volume parameter required' });
        }
        if (device.setZone2Volume) {
          await device.setZone2Volume(params.volume);
        } else {
          return res.status(400).json({ error: 'Zone 2 not supported' });
        }
        break;
      case 'setZone3Power':
        if (params?.on === undefined) {
          return res.status(400).json({ error: 'on parameter required' });
        }
        if (device.setZone3Power) {
          await device.setZone3Power(params.on);
        } else {
          return res.status(400).json({ error: 'Zone 3 not supported' });
        }
        break;
      case 'setZone3Volume':
        if (params?.volume === undefined) {
          return res.status(400).json({ error: 'volume parameter required' });
        }
        if (device.setZone3Volume) {
          await device.setZone3Volume(params.volume);
        } else {
          return res.status(400).json({ error: 'Zone 3 not supported' });
        }
        break;
      default:
        return res.status(400).json({ error: `Unknown command: ${command}` });
    }
    
    logger.info('HiFi Control', `Executed command: ${command}`, params);
    res.json({ success: true, result });
  } catch (error) {
    logger.error('HiFi Control', 'Command execution failed', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/hifi-control/status - Get current device status
router.post('/status', async (req: Request, res: Response) => {
  try {
    const { dashboardSettings } = req.body;
    const device = await getDevice(dashboardSettings);
    const status = await device.getStatus();
    res.json({ status });
  } catch (error) {
    logger.error('HiFi Control', 'Failed to get status', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/hifi-control/capabilities - Get device capabilities
router.post('/capabilities', async (req: Request, res: Response) => {
  try {
    const { dashboardSettings } = req.body;
    const device = await getDevice(dashboardSettings);
    const capabilities = device.getCapabilities();
    res.json({ capabilities });
  } catch (error) {
    logger.error('HiFi Control', 'Failed to get capabilities', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
