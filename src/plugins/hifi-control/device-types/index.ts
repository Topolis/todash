// ABOUTME: Device type registry and exports
// ABOUTME: Centralizes all device type implementations

import { registerDeviceType } from './base';
import { DenonAVRDeviceType } from './denon-avr';

// Register all device types
const denonAVR = new DenonAVRDeviceType();
registerDeviceType(denonAVR);

// Export device types
export { denonAVR };
export * from './base';
export * from './denon-avr';
