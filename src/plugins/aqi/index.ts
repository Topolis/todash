import type { PluginDefinition } from '@types/plugin';
import AQIWidget from './widget';

// Re-export types from data.ts to avoid duplication
export type { AQIConfig, AQIData } from './data';

export const aqiPlugin: PluginDefinition<any, any> = {
  name: 'aqi',
  displayName: 'Air Quality Index',
  description: 'Display air quality information from Open-Meteo',
  widget: AQIWidget as any,
  serverSide: true,
  defaultRefreshInterval: 600,
  defaultConfig: {},
};
