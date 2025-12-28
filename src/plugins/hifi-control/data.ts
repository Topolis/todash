// ABOUTME: Data provider for HiFi Control plugin
// ABOUTME: Fetches device status using configured device type

import type { HifiControlConfig, HifiControlData, DeviceConfig } from './types';
import { getDeviceType } from './device-types';
import { logger } from '@lib/logger';

let deviceInstance: any = null;
let currentDeviceConfig: DeviceConfig | null = null;

async function getDeviceInstance(config: DeviceConfig): Promise<any> {
  // Reuse existing instance if config hasn't changed
  if (deviceInstance && 
      currentDeviceConfig &&
      currentDeviceConfig.type === config.type &&
      currentDeviceConfig.host === config.host &&
      currentDeviceConfig.port === config.port) {
    return deviceInstance;
  }
  
  // Get device type implementation
  const deviceType = getDeviceType(config.type);
  if (!deviceType) {
    throw new Error(`Unknown device type: ${config.type}`);
  }
  
  // Create new instance and connect
  logger.info('HiFi Control', `Connecting to ${config.type} device at ${config.host}:${config.port || 80}`);
  await deviceType.connect(config);
  
  deviceInstance = deviceType;
  currentDeviceConfig = config;
  
  return deviceInstance;
}

export async function fetchHifiControlData(
  widgetConfig: HifiControlConfig = {},
  dashboardSettings: any
): Promise<HifiControlData> {
  try {
    // Get device config from dashboard settings
    const deviceConfig: DeviceConfig | undefined = dashboardSettings?.['hifi-control']?.device;
    
    if (!deviceConfig) {
      throw new Error('HiFi Control device not configured in dashboard settings');
    }
    
    if (!deviceConfig.type || !deviceConfig.host) {
      throw new Error('HiFi Control device configuration incomplete (type and host required)');
    }
    
    // Get device instance
    const device = await getDeviceInstance(deviceConfig);
    
    // Fetch current status
    const status = await device.getStatus();
    
    // Get capabilities
    const capabilities = device.getCapabilities();
    
    // Override available inputs if custom inputs are configured
    if (widgetConfig?.customInputs && widgetConfig.customInputs.length > 0) {
      capabilities.availableInputs = widgetConfig.customInputs;
    }
    
    return {
      status,
      capabilities,
      deviceConfig,
    };
  } catch (error) {
    logger.error('HiFi Control', 'Failed to fetch device data', error);
    throw error;
  }
}
