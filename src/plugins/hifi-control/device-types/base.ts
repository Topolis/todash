// ABOUTME: Base implementation and utilities for device type handlers
// ABOUTME: Provides common functionality shared across all device types

import type { DeviceType, DeviceConfig } from '../types';

export abstract class BaseDeviceType implements DeviceType {
  abstract id: string;
  abstract displayName: string;
  
  protected config?: DeviceConfig;
  
  async connect(config: DeviceConfig): Promise<void> {
    this.config = config;
  }
  
  protected requireConfig(): DeviceConfig {
    if (!this.config) {
      throw new Error('Device not connected. Call connect() first.');
    }
    return this.config;
  }
  
  protected requireHost(): string {
    const config = this.requireConfig();
    if (!config.host) {
      throw new Error('Device host not configured');
    }
    return config.host;
  }
  
  // All methods must be implemented by concrete classes
  abstract getCapabilities(): any;
  abstract getStatus(): Promise<any>;
  abstract powerOn(): Promise<void>;
  abstract powerOff(): Promise<void>;
  abstract powerToggle(): Promise<void>;
  abstract setVolume(level: number): Promise<void>;
  abstract volumeUp(): Promise<void>;
  abstract volumeDown(): Promise<void>;
  abstract mute(): Promise<void>;
  abstract unmute(): Promise<void>;
  abstract toggleMute(): Promise<void>;
  abstract setInput(inputId: string): Promise<void>;
}

// Device type registry
const deviceTypes = new Map<string, DeviceType>();

export function registerDeviceType(deviceType: DeviceType): void {
  deviceTypes.set(deviceType.id, deviceType);
}

export function getDeviceType(id: string): DeviceType | undefined {
  return deviceTypes.get(id);
}

export function getAllDeviceTypes(): DeviceType[] {
  return Array.from(deviceTypes.values());
}
