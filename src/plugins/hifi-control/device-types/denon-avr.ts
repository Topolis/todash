// ABOUTME: Denon AVR device type implementation using Telnet control protocol
// ABOUTME: Implements communication with Denon AVR receivers via Telnet commands

import { BaseDeviceType } from './base';
import type { DeviceCapabilities, DeviceStatus, Input } from '../types';
import { logger } from '@lib/logger';
import * as net from 'net';

export class DenonAVRDeviceType extends BaseDeviceType {
  id = 'denon-avr';
  displayName = 'Denon AVR Receiver';
  
  private statusCache?: DeviceStatus;
  private lastStatusUpdate = 0;
  private readonly STATUS_CACHE_MS = 2000; // Cache status for 2 seconds
  
  private socket?: net.Socket;
  private commandQueue: Array<{ command: string; resolve: (data: string) => void; reject: (err: Error) => void }> = [];
  private isProcessingQueue = false;
  private responseBuffer = '';
  
  private async ensureConnected(): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      return;
    }
    
    const config = this.requireConfig();
    const port = config.port || 23;
    
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setTimeout(5000);
      
      this.socket.on('data', (data) => {
        this.responseBuffer += data.toString();
      });
      
      this.socket.on('error', (error) => {
        logger.error('HiFi Control', 'Socket error', error);
      });
      
      this.socket.on('close', () => {
        logger.debug('HiFi Control', 'Socket closed');
        this.socket = undefined;
      });
      
      this.socket.connect(port, config.host, () => {
        logger.debug('HiFi Control', 'Socket connected', { host: config.host, port });
        resolve();
      });
      
      this.socket.on('error', reject);
    });
  }
  
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.commandQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.commandQueue.length > 0) {
      const item = this.commandQueue.shift();
      if (!item) break;
      
      try {
        await this.ensureConnected();
        
        this.responseBuffer = '';
        this.socket!.write(item.command + '\r');
        
        // Wait for response (shorter delay)
        await new Promise(resolve => setTimeout(resolve, 200));
        
        item.resolve(this.responseBuffer);
      } catch (error) {
        item.reject(error as Error);
      }
      
      // Minimal delay between commands
      if (this.commandQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    this.isProcessingQueue = false;
  }
  
  getCapabilities(): DeviceCapabilities {
    return {
      supportsPower: true,
      supportsVolume: true,
      volumeRange: { min: 0, max: 98 },
      supportsInputs: true,
      availableInputs: this.getDefaultInputs(),
      supportsMute: true,
      supportsSurroundModes: true,
      availableSurroundModes: [
        'MOVIE',
        'MUSIC',
        'GAME',
        'DIRECT',
        'STEREO',
        'DOLBY DIGITAL',
        'DTS SURROUND',
        'MCH STEREO',
      ],
      supportsMultiZone: true,
      zones: 3,
      supportsDisplayBrightness: true,
    };
  }
  
  private getDefaultInputs(): Input[] {
    return [
      { id: 'BD', label: 'Blu-ray', icon: 'mdi:disc-player' },
      { id: 'GAME', label: 'Game', icon: 'mdi:gamepad-variant' },
      { id: 'TV', label: 'TV Audio', icon: 'mdi:television' },
      { id: 'SAT/CBL', label: 'Satellite/Cable', icon: 'mdi:satellite-variant' },
      { id: 'MPLAY', label: 'Media Player', icon: 'mdi:play-box' },
      { id: 'NET', label: 'Network', icon: 'mdi:wifi' },
      { id: 'BT', label: 'Bluetooth', icon: 'mdi:bluetooth' },
      { id: 'AUX1', label: 'Aux 1', icon: 'mdi:audio-input-rca' },
      { id: 'AUX2', label: 'Aux 2', icon: 'mdi:audio-input-rca' },
    ];
  }
  
  private async sendCommand(command: string): Promise<string> {
    const config = this.requireConfig();
    logger.debug('HiFi Control', `Queuing Denon command: ${command}`);
    
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ command, resolve, reject });
      this.processQueue().catch(reject);
    });
  }
  
  async getStatus(): Promise<DeviceStatus> {
    // Return cached status if recent enough
    const now = Date.now();
    if (this.statusCache && (now - this.lastStatusUpdate) < this.STATUS_CACHE_MS) {
      return this.statusCache;
    }
    
    try {
      // Query all status values (READ-ONLY commands)
      const queries = [
        this.sendCommand('PW?'),
        this.sendCommand('MV?'),
        this.sendCommand('MU?'),
        this.sendCommand('SI?'),
        this.sendCommand('NSE'),
      ];
      
      // Add Zone 2/3 queries if supported
      if (this.getCapabilities().supportsMultiZone) {
        queries.push(this.sendCommand('Z2?'));
        queries.push(this.sendCommand('Z3?'));
      }
      
      const responses = await Promise.all(queries);
      let [powerResp, volumeResp, muteResp, inputResp, displayResp, zone2Resp, zone3Resp] = responses;
      
      // Parse power status
      const power = this.parsePowerStatus(powerResp);
      
      // Parse volume (Denon returns like "MV45" or "MV455" for 45.5)
      const volume = this.parseVolume(volumeResp);
      
      // Parse mute
      const muted = this.parseMuteStatus(muteResp);
      
      // Parse input
      const currentInput = this.parseInput(inputResp);
      
      // Parse display info
      const displayInfo = this.parseDisplayInfo(displayResp);
      
      const status: DeviceStatus = {
        power,
        volume,
        volumePercent: Math.round((volume / 98) * 100),
        volumeDb: this.volumeToDb(volume),
        muted,
        currentInput,
        currentInputLabel: this.getInputLabel(currentInput),
        ...displayInfo,
      };
      
      // Parse Zone 2/3 if available
      if (zone2Resp) {
        status.zone2Power = zone2Resp.includes('Z2ON');
        const z2Vol = this.parseVolume(zone2Resp);
        if (z2Vol > 0) status.zone2Volume = z2Vol;
      }
      
      if (zone3Resp) {
        status.zone3Power = zone3Resp.includes('Z3ON');
        const z3Vol = this.parseVolume(zone3Resp);
        if (z3Vol > 0) status.zone3Volume = z3Vol;
      }
      
      this.statusCache = status;
      this.lastStatusUpdate = now;
      
      return status;
    } catch (error) {
      logger.error('HiFi Control', 'Failed to get device status', error);
      throw error;
    }
  }
  
  private parsePowerStatus(response: string): 'on' | 'standby' | 'off' | 'unknown' {
    if (response.includes('PWON')) return 'on';
    if (response.includes('PWSTANDBY')) return 'standby';
    return 'unknown';
  }
  
  private parseVolume(response: string): number {
    // Response format: "MV45" (45) or "MV455" (45.5)
    const match = response.match(/MV(\d+)/);
    if (!match) return 0;
    
    const value = match[1];
    if (value.length === 3) {
      // Three digits like "455" = 45.5
      return parseInt(value.substring(0, 2)) + (parseInt(value.substring(2)) / 10);
    } else {
      // Two digits like "45" = 45
      return parseInt(value);
    }
  }
  
  private parseMuteStatus(response: string): boolean {
    return response.includes('MUON');
  }
  
  private parseInput(response: string): string {
    // Response format: "SIBD", "SIGAME", etc.
    const match = response.match(/SI(.+)/);
    return match ? match[1].trim() : 'UNKNOWN';
  }
  
  private parseDisplayInfo(response: string): { displayLine1?: string; displayLine2?: string; displayInfo?: string } {
    // NSE response format: NSE0..., NSE1..., NSE2..., etc.
    // Each line represents a line of the display
    const lines: string[] = [];
    const matches = response.matchAll(/NSE([0-9])(.*?)(?:\r|\n|$)/g);
    
    for (const match of matches) {
      const lineNum = parseInt(match[1], 10);
      const content = match[2].trim();
      if (content && lineNum >= 0 && lineNum <= 9) {
        lines[lineNum] = content;
      }
    }
    
    // Filter out empty lines and system messages
    const validLines = lines.filter(line => 
      line && 
      !line.match(/^[\x00-\x1F\x7F]+$/) // Filter control characters
    );
    
    return {
      displayLine1: validLines[0] || undefined,
      displayLine2: validLines[1] || undefined,
      displayInfo: validLines.join(' | ') || undefined,
    };
  }
  
  private volumeToDb(volume: number): string {
    // Denon volume: 0-98 maps to -80dB to +18dB (0.5dB steps)
    // Reference: volume 80 = 0dB
    const db = (volume - 80) * 0.5;
    return db > 0 ? `+${db.toFixed(1)}dB` : `${db.toFixed(1)}dB`;
  }
  
  private getInputLabel(inputId: string): string {
    const inputs = this.getDefaultInputs();
    const input = inputs.find(i => i.id === inputId);
    return input?.label || inputId;
  }
  
  // Control methods (WRITE operations)
  async powerOn(): Promise<void> {
    await this.sendCommand('PWON');
    // Don't invalidate cache - device will send status updates
  }
  
  async powerOff(): Promise<void> {
    await this.sendCommand('PWSTANDBY');
    // Don't invalidate cache - device will send status updates
  }
  
  async powerToggle(): Promise<void> {
    const status = await this.getStatus();
    if (status.power === 'on') {
      await this.powerOff();
    } else {
      await this.powerOn();
    }
  }
  
  async setVolume(level: number): Promise<void> {
    // Clamp to valid range
    const clampedLevel = Math.max(0, Math.min(98, Math.round(level)));
    
    // Format: MV45 for 45, MV455 for 45.5
    const command = `MV${clampedLevel.toString().padStart(2, '0')}`;
    await this.sendCommand(command);
    
    // Update cache immediately with new value
    if (this.statusCache) {
      this.statusCache.volume = clampedLevel;
      this.statusCache.volumePercent = Math.round((clampedLevel / 98) * 100);
      this.statusCache.volumeDb = this.volumeToDb(clampedLevel);
    }
  }
  
  async volumeUp(): Promise<void> {
    await this.sendCommand('MVUP');
    // Cache will be refreshed on next poll
  }
  
  async volumeDown(): Promise<void> {
    await this.sendCommand('MVDOWN');
    // Cache will be refreshed on next poll
  }
  
  async mute(): Promise<void> {
    await this.sendCommand('MUON');
    if (this.statusCache) {
      this.statusCache.muted = true;
    }
  }
  
  async unmute(): Promise<void> {
    await this.sendCommand('MUOFF');
    if (this.statusCache) {
      this.statusCache.muted = false;
    }
  }
  
  async toggleMute(): Promise<void> {
    const status = await this.getStatus();
    if (status.muted) {
      await this.unmute();
    } else {
      await this.mute();
    }
  }
  
  async setInput(inputId: string): Promise<void> {
    await this.sendCommand(`SI${inputId}`);
    // Update cache immediately
    if (this.statusCache) {
      this.statusCache.currentInput = inputId;
      this.statusCache.currentInputLabel = this.getInputLabel(inputId);
    }
  }
  
  async setSurroundMode(mode: string): Promise<void> {
    await this.sendCommand(`MS${mode}`);
    if (this.statusCache) {
      this.statusCache.currentSurroundMode = mode;
    }
  }
  
  async setZone2Power(on: boolean): Promise<void> {
    await this.sendCommand(on ? 'Z2ON' : 'Z2OFF');
    if (this.statusCache) {
      this.statusCache.zone2Power = on;
    }
  }
  
  async setZone2Volume(level: number): Promise<void> {
    const clampedLevel = Math.max(0, Math.min(98, Math.round(level)));
    await this.sendCommand(`Z2${clampedLevel.toString().padStart(2, '0')}`);
    if (this.statusCache) {
      this.statusCache.zone2Volume = clampedLevel;
    }
  }
  
  async setZone3Power(on: boolean): Promise<void> {
    await this.sendCommand(on ? 'Z3ON' : 'Z3OFF');
    if (this.statusCache) {
      this.statusCache.zone3Power = on;
    }
  }
  
  async setZone3Volume(level: number): Promise<void> {
    const clampedLevel = Math.max(0, Math.min(98, Math.round(level)));
    await this.sendCommand(`Z3${clampedLevel.toString().padStart(2, '0')}`);
    if (this.statusCache) {
      this.statusCache.zone3Volume = clampedLevel;
    }
  }
  
  private invalidateCache(): void {
    this.statusCache = undefined;
    this.lastStatusUpdate = 0;
  }
}
