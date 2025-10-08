import { getDriver } from './service';
import { logger } from '@lib/logger';
import { registerValueFunction } from '@server/valueFunctions';

/**
 * Common Z-Wave device info
 */
export interface ZWaveDeviceInfo {
  nodeId: number;
  name?: string;
  location?: string;
  manufacturer?: string;
  productLabel?: string;
  isListening: boolean;
  isFrequentListening: boolean;
  isRouting: boolean;
  status: 'alive' | 'dead' | 'asleep' | 'awake' | 'unknown';
  ready: boolean;
  interviewStage?: string;
  batteryLevel?: number;
  lastSeen?: number; // Timestamp in milliseconds
}

/**
 * Thermostat-specific data
 */
export interface ZWaveThermostatData {
  devices: Array<ZWaveDeviceInfo & {
    currentTemperature?: number;
    targetTemperature?: number;
    mode?: string;
    fanMode?: string;
    humidity?: number;
    operatingState?: string;
  }>;
}

/**
 * Switch/Dimmer-specific data
 */
export interface ZWaveSwitchData {
  devices: Array<ZWaveDeviceInfo & {
    isOn: boolean;
    level?: number; // For dimmers (0-100)
    power?: number; // Current power consumption in watts
    energy?: number; // Total energy consumption in kWh
  }>;
}

/**
 * Sensor-specific data
 */
export interface ZWaveSensorData {
  devices: Array<ZWaveDeviceInfo & {
    sensorType: string;
    value: number;
    unit: string;
    timestamp?: string;
  }>;
}

/**
 * Configuration for thermostat widget
 */
export interface ZWaveThermostatConfig {
  nodeId: number; // Node ID of the thermostat
  refreshSeconds?: number;
}

/**
 * Configuration for switch widget
 */
export interface ZWaveSwitchConfig {
  nodeId?: number; // Single node ID (convenience)
  nodeIds?: number[]; // Filter by specific node IDs
  refreshSeconds?: number;
}

/**
 * Configuration for sensor widget
 */
export interface ZWaveSensorConfig {
  nodeId?: number; // Single node ID (convenience)
  nodeIds?: number[]; // Filter by specific node IDs
  sensorTypes?: string[]; // Filter by sensor type
  refreshSeconds?: number;
}

/**
 * Helper to get common device info
 */
function getDeviceInfo(node: any): ZWaveDeviceInfo {
  const status = node.status;
  let statusStr: ZWaveDeviceInfo['status'] = 'unknown';
  
  if (status === 0) statusStr = 'unknown';
  else if (status === 1) statusStr = 'asleep';
  else if (status === 2) statusStr = 'awake';
  else if (status === 3) statusStr = 'dead';
  else if (status === 4) statusStr = 'alive';

  // Get lastSeen - it might be a Date object or timestamp
  const lastSeenRaw = (node as any).lastSeen;
  let lastSeenMs: number | undefined;

  if (lastSeenRaw instanceof Date) {
    lastSeenMs = lastSeenRaw.getTime();
  } else if (typeof lastSeenRaw === 'number') {
    lastSeenMs = lastSeenRaw;
  }

  return {
    nodeId: node.id,
    name: node.name || node.deviceConfig?.label || `Node ${node.id}`,
    location: node.location,
    manufacturer: node.deviceConfig?.manufacturer,
    productLabel: node.deviceConfig?.label,
    isListening: node.isListening,
    isFrequentListening: node.isFrequentListening,
    isRouting: node.isRouting,
    status: statusStr,
    ready: node.ready,
    interviewStage: node.interviewStage,
    batteryLevel: node.getValue({ commandClass: 0x80, property: 'level' }), // Battery CC
    lastSeen: lastSeenMs, // Timestamp of last communication in milliseconds
  };
}

/**
 * Fetch thermostat data
 */
export async function fetchZWaveThermostatData(config: ZWaveThermostatConfig): Promise<ZWaveThermostatData> {
  try {
    const driver = await getDriver();

    // Check if controller is ready before accessing it
    try {
      const _ = driver.controller;
    } catch (e) {
      // Controller not ready yet, return empty data
      return { devices: [] };
    }

    const controller = driver.controller;
    const nodes = controller.nodes;

    const devices: ZWaveThermostatData['devices'] = [];

    for (const [nodeId, node] of nodes.entries()) {
      // Filter by nodeId
      if (nodeId !== config.nodeId) {
        continue;
      }

      // Check if node supports thermostat command classes
      // 0x40 = Thermostat Mode, 0x43 = Thermostat Setpoint, 0x67 = Thermostat Setpoint (older)
      const isThermostat = node.supportsCC(0x40) || node.supportsCC(0x43) || node.supportsCC(0x67);
      if (!isThermostat) {
        continue;
      }

      const deviceInfo = getDeviceInfo(node);

      // Get thermostat values - try different command classes
      const currentTemp = node.getValue({ commandClass: 0x31, property: 'Air temperature' }); // Multilevel Sensor

      // Try different setpoint command classes
      let targetTemp = node.getValue({ commandClass: 0x43, property: 'setpoint', propertyKey: 1 }); // CC 0x43
      if (targetTemp === undefined) {
        targetTemp = node.getValue({ commandClass: 0x67, property: 'setpoint', propertyKey: 1 }); // CC 0x67
      }
      if (targetTemp === undefined) {
        targetTemp = node.getValue({ commandClass: 0x40, property: 'setpoint', propertyKey: 1 }); // CC 0x40
      }



      const mode = node.getValue({ commandClass: 0x40, property: 'mode' });
      const fanMode = node.getValue({ commandClass: 0x44, property: 'mode' }); // Thermostat Fan Mode
      const humidity = node.getValue({ commandClass: 0x31, property: 'Humidity' });
      const operatingState = node.getValue({ commandClass: 0x42, property: 'state' }); // Thermostat Operating State

      devices.push({
        ...deviceInfo,
        currentTemperature: typeof currentTemp === 'number' ? currentTemp : undefined,
        targetTemperature: typeof targetTemp === 'number' ? targetTemp : undefined,
        mode: mode?.toString(),
        fanMode: fanMode?.toString(),
        humidity: typeof humidity === 'number' ? humidity : undefined,
        operatingState: operatingState?.toString(),
      });
    }

    return { devices };
  } catch (error: any) {
    // Don't log errors if driver is still initializing or port not available
    if (error?.code !== 100 && error?.code !== 103) {
      logger.error('ZWave', 'Error fetching thermostat data', error);
    }
    // Return empty data instead of throwing
    return { devices: [] };
  }
}

/**
 * Fetch switch/dimmer data
 */
export async function fetchZWaveSwitchData(config: ZWaveSwitchConfig): Promise<ZWaveSwitchData> {
  try {
    const driver = await getDriver();

    // Check if controller is ready before accessing it
    try {
      const _ = driver.controller;
    } catch (e) {
      // Controller not ready yet, return empty data
      return { devices: [] };
    }

    const controller = driver.controller;
    const nodes = controller.nodes;

    const devices: ZWaveSwitchData['devices'] = [];

    // Support both nodeId (singular) and nodeIds (plural)
    const filterNodeIds = config.nodeIds || (config.nodeId ? [config.nodeId] : undefined);

    for (const [nodeId, node] of nodes.entries()) {
      // Filter by nodeIds if specified
      if (filterNodeIds && !filterNodeIds.includes(nodeId)) {
        continue;
      }

      // Check if node supports Binary Switch (0x25) or Multilevel Switch (0x26)
      const supportsBinarySwitch = node.supportsCC(0x25);
      const supportsMultilevelSwitch = node.supportsCC(0x26);

      if (!supportsBinarySwitch && !supportsMultilevelSwitch) {
        continue;
      }

      const deviceInfo = getDeviceInfo(node);

      let isOn = false;
      let level: number | undefined;

      if (supportsMultilevelSwitch) {
        const currentValue = node.getValue({ commandClass: 0x26, property: 'currentValue' });
        level = typeof currentValue === 'number' ? currentValue : undefined;
        isOn = (level ?? 0) > 0;
      } else if (supportsBinarySwitch) {
        const currentValue = node.getValue({ commandClass: 0x25, property: 'currentValue' });
        isOn = currentValue === true;
      }

      // Get power/energy if available (Meter CC 0x32)
      const power = node.getValue({ commandClass: 0x32, property: 'value', propertyKey: 2 }); // Electric - W
      const energy = node.getValue({ commandClass: 0x32, property: 'value', propertyKey: 0 }); // Electric - kWh

      devices.push({
        ...deviceInfo,
        isOn,
        level,
        power: typeof power === 'number' ? power : undefined,
        energy: typeof energy === 'number' ? energy : undefined,
      });
    }

    return { devices };
  } catch (error: any) {
    // Don't log errors if driver is still initializing or port not available
    if (error?.code !== 100 && error?.code !== 103) {
      logger.error('ZWave', 'Error fetching switch data', error);
    }
    // Return empty data instead of throwing
    return { devices: [] };
  }
}

/**
 * Fetch sensor data
 */
export async function fetchZWaveSensorData(config: ZWaveSensorConfig): Promise<ZWaveSensorData> {
  try {
    const driver = await getDriver();

    // Check if controller is ready before accessing it
    try {
      const _ = driver.controller;
    } catch (e) {
      // Controller not ready yet, return empty data
      return { devices: [] };
    }

    const controller = driver.controller;
    const nodes = controller.nodes;

    const devices: ZWaveSensorData['devices'] = [];

    // Support both nodeId (singular) and nodeIds (plural)
    const filterNodeIds = config.nodeIds || (config.nodeId ? [config.nodeId] : undefined);

    for (const [nodeId, node] of nodes.entries()) {
      // Filter by nodeIds if specified
      if (filterNodeIds && !filterNodeIds.includes(nodeId)) {
        continue;
      }

      // Check if node supports Multilevel Sensor (0x31) or Binary Sensor (0x30)
      if (!node.supportsCC(0x31) && !node.supportsCC(0x30)) {
        continue;
      }

      const deviceInfo = getDeviceInfo(node);

      // Get all sensor values
      const values = node.getDefinedValueIDs();

      for (const valueId of values) {
        if (valueId.commandClass !== 0x31 && valueId.commandClass !== 0x30) {
          continue;
        }

        const value = node.getValue(valueId);
        if (value === undefined) continue;

        const metadata = node.getValueMetadata(valueId);
        const sensorType = valueId.property?.toString() || 'Unknown';

        // Filter by sensor type if specified
        if (config.sensorTypes && !config.sensorTypes.includes(sensorType)) {
          continue;
        }

        // Extract unit from metadata (it may be in different places depending on the metadata type)
        let unit = '';
        if (metadata && 'unit' in metadata) {
          unit = (metadata as any).unit || '';
        }

        devices.push({
          ...deviceInfo,
          sensorType,
          value: typeof value === 'number' ? value : (value ? 1 : 0),
          unit,
        });
      }
    }

    return { devices };
  } catch (error: any) {
    // Don't log errors if driver is still initializing or port not available
    if (error?.code !== 100 && error?.code !== 103) {
      logger.error('ZWave', 'Error fetching sensor data', error);
    }
    // Return empty data instead of throwing
    return { devices: [] };
  }
}

/**
 * Control functions for Z-Wave devices
 */

/**
 * Set thermostat temperature
 */
export async function setThermostatTemperature(nodeId: number, temperature: number, setpointType: number = 1): Promise<void> {
  try {
    const driver = await getDriver();
    const node = driver.controller.nodes.get(nodeId);

    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Determine which command class to use for setpoint
    let commandClass: number;
    if (node.supportsCC(0x43)) {
      commandClass = 0x43; // Thermostat Setpoint
    } else if (node.supportsCC(0x67)) {
      commandClass = 0x67; // Thermostat Setpoint (older)
    } else if (node.supportsCC(0x40)) {
      commandClass = 0x40; // Thermostat Mode (fallback)
    } else {
      throw new Error(`Node ${nodeId} does not support thermostat control`);
    }

    await node.setValue({ commandClass, property: 'setpoint', propertyKey: setpointType }, temperature);
    logger.info('ZWave', `Set thermostat ${nodeId} temperature to ${temperature} using CC 0x${commandClass.toString(16)}`);
  } catch (error) {
    logger.error('ZWave', `Error setting thermostat temperature for node ${nodeId}`, error);
    throw error;
  }
}

/**
 * Set thermostat mode
 */
export async function setThermostatMode(nodeId: number, mode: number): Promise<void> {
  try {
    const driver = await getDriver();
    const node = driver.controller.nodes.get(nodeId);

    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    await node.setValue({ commandClass: 0x40, property: 'mode' }, mode);
    logger.info('ZWave', `Set thermostat ${nodeId} mode to ${mode}`);
  } catch (error) {
    logger.error('ZWave', `Error setting thermostat mode for node ${nodeId}`, error);
    throw error;
  }
}

/**
 * Turn switch on/off
 */
export async function setSwitchState(nodeId: number, isOn: boolean): Promise<void> {
  try {
    const driver = await getDriver();
    const node = driver.controller.nodes.get(nodeId);

    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    if (node.supportsCC(0x26)) {
      // Multilevel switch - set to 0 or 99
      await node.setValue({ commandClass: 0x26, property: 'targetValue' }, isOn ? 99 : 0);
    } else if (node.supportsCC(0x25)) {
      // Binary switch
      await node.setValue({ commandClass: 0x25, property: 'targetValue' }, isOn);
    } else {
      throw new Error(`Node ${nodeId} does not support switch control`);
    }

    logger.info('ZWave', `Set switch ${nodeId} to ${isOn ? 'ON' : 'OFF'}`);
  } catch (error) {
    logger.error('ZWave', `Error setting switch state for node ${nodeId}`, error);
    throw error;
  }
}

/**
 * Set dimmer level (0-100)
 */
export async function setDimmerLevel(nodeId: number, level: number): Promise<void> {
  try {
    const driver = await getDriver();
    const node = driver.controller.nodes.get(nodeId);

    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    if (!node.supportsCC(0x26)) {
      throw new Error(`Node ${nodeId} does not support dimmer control`);
    }

    const clampedLevel = Math.max(0, Math.min(100, level));
    await node.setValue({ commandClass: 0x26, property: 'targetValue' }, clampedLevel);
    logger.info('ZWave', `Set dimmer ${nodeId} level to ${clampedLevel}`);
  } catch (error) {
    logger.error('ZWave', `Error setting dimmer level for node ${nodeId}`, error);
    throw error;
  }
}

/**
 * Register value functions for status widget integration
 */

// Get temperature from a specific thermostat node
registerValueFunction('zwave-thermostat-temp', async ({ nodeId }: { nodeId: number }) => {
  try {
    const driver = await getDriver();
    const node = driver.controller.nodes.get(nodeId);
    if (!node) return null;

    const temp = node.getValue({ commandClass: 0x31, property: 'Air temperature' });
    return typeof temp === 'number' ? temp : null;
  } catch (error) {
    logger.error('ZWave', `Error getting temperature for node ${nodeId}`, error);
    return null;
  }
});

// Get battery level from a specific node
registerValueFunction('zwave-battery', async ({ nodeId }: { nodeId: number }) => {
  try {
    const driver = await getDriver();
    const node = driver.controller.nodes.get(nodeId);
    if (!node) return null;

    const battery = node.getValue({ commandClass: 0x80, property: 'level' });
    return typeof battery === 'number' ? battery : null;
  } catch (error) {
    logger.error('ZWave', `Error getting battery for node ${nodeId}`, error);
    return null;
  }
});

// Get switch state from a specific node
registerValueFunction('zwave-switch-state', async ({ nodeId }: { nodeId: number }) => {
  try {
    const driver = await getDriver();
    const node = driver.controller.nodes.get(nodeId);
    if (!node) return null;

    if (node.supportsCC(0x26)) {
      const level = node.getValue({ commandClass: 0x26, property: 'currentValue' });
      return typeof level === 'number' ? (level > 0 ? 1 : 0) : null;
    } else if (node.supportsCC(0x25)) {
      const state = node.getValue({ commandClass: 0x25, property: 'currentValue' });
      return state === true ? 1 : 0;
    }
    return null;
  } catch (error) {
    logger.error('ZWave', `Error getting switch state for node ${nodeId}`, error);
    return null;
  }
});

