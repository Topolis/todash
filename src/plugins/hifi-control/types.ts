// ABOUTME: Type definitions for HiFi Control plugin
// ABOUTME: Defines device-agnostic interfaces for AV receiver control

export interface DeviceConfig {
  type: string;
  host: string;
  port?: number;
  username?: string;
  password?: string;
}

export interface Input {
  id: string;
  label: string;
  icon?: string;
}

export interface DeviceCapabilities {
  supportsPower: boolean;
  supportsVolume: boolean;
  volumeRange: { min: number; max: number };
  supportsInputs: boolean;
  availableInputs: Input[];
  supportsMute: boolean;
  supportsSurroundModes: boolean;
  availableSurroundModes?: string[];
  supportsMultiZone: boolean;
  zones?: number;
  supportsDisplayBrightness: boolean;
}

export interface DeviceStatus {
  power: 'on' | 'standby' | 'off' | 'unknown';
  volume: number;
  volumePercent: number;
  volumeDb?: string;
  muted: boolean;
  currentInput: string;
  currentInputLabel?: string;
  currentSurroundMode?: string;
  zone2Power?: boolean;
  zone2Volume?: number;
  zone3Power?: boolean;
  zone3Volume?: number;
  displayBrightness?: string;
  displayInfo?: string; // Current channel/track info from device display
  displayLine1?: string; // First line of display info
  displayLine2?: string; // Second line of display info
}

export interface DeviceType {
  id: string;
  displayName: string;
  
  // Initialize connection
  connect(config: DeviceConfig): Promise<void>;
  
  // Get device capabilities
  getCapabilities(): DeviceCapabilities;
  
  // Query device status (READ-ONLY)
  getStatus(): Promise<DeviceStatus>;
  
  // Control commands (WRITE)
  powerOn(): Promise<void>;
  powerOff(): Promise<void>;
  powerToggle(): Promise<void>;
  
  setVolume(level: number): Promise<void>;
  volumeUp(): Promise<void>;
  volumeDown(): Promise<void>;
  
  mute(): Promise<void>;
  unmute(): Promise<void>;
  toggleMute(): Promise<void>;
  
  setInput(inputId: string): Promise<void>;
  
  // Optional advanced features
  setSurroundMode?(mode: string): Promise<void>;
  setZone2Power?(on: boolean): Promise<void>;
  setZone2Volume?(level: number): Promise<void>;
  setZone3Power?(on: boolean): Promise<void>;
  setZone3Volume?(level: number): Promise<void>;
  setDisplayBrightness?(level: string): Promise<void>;
}

export interface HifiControlConfig {
  refreshSeconds?: number;
  showPower?: boolean;
  showVolume?: boolean;
  showInputs?: boolean;
  showSurroundMode?: boolean;
  showZone2?: boolean;
  showZone3?: boolean;
  showAdvanced?: boolean;
  customInputs?: Input[];
  inputMapping?: { [inputId: string]: { label?: string; icon?: string } };
}

export interface HifiControlData {
  status: DeviceStatus;
  capabilities: DeviceCapabilities;
  deviceConfig?: DeviceConfig;
}
