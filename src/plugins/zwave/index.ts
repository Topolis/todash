import type { PluginDefinition } from '@types/plugin';
import ZWaveThermostatWidget from './thermostat-widget';
import ZWaveSwitchWidget from './switch-widget';
import ZWaveSensorWidget from './sensor-widget';

export type {
  ZWaveThermostatConfig,
  ZWaveThermostatData,
  ZWaveSwitchConfig,
  ZWaveSwitchData,
  ZWaveSensorConfig,
  ZWaveSensorData,
} from './data';

/**
 * Z-Wave Thermostat Plugin
 */
export const zwaveThermostatPlugin: PluginDefinition<any, any> = {
  name: 'zwave-thermostat',
  displayName: 'Z-Wave Thermostat',
  description: 'Control Z-Wave thermostats and climate devices',
  widget: ZWaveThermostatWidget as any,
  serverSide: true,
  defaultRefreshInterval: 10,
  defaultConfig: {
    refreshSeconds: 10,
  },
};

/**
 * Z-Wave Switch Plugin
 */
export const zwaveSwitchPlugin: PluginDefinition<any, any> = {
  name: 'zwave-switch',
  displayName: 'Z-Wave Switch',
  description: 'Control Z-Wave switches and dimmers',
  widget: ZWaveSwitchWidget as any,
  serverSide: true,
  defaultRefreshInterval: 10,
  defaultConfig: {
    refreshSeconds: 10,
  },
};

/**
 * Z-Wave Sensor Plugin
 */
export const zwaveSensorPlugin: PluginDefinition<any, any> = {
  name: 'zwave-sensor',
  displayName: 'Z-Wave Sensor',
  description: 'Monitor Z-Wave sensors (temperature, humidity, motion, etc.)',
  widget: ZWaveSensorWidget as any,
  serverSide: true,
  defaultRefreshInterval: 30,
  defaultConfig: {
    refreshSeconds: 30,
  },
};

