import type { PluginDefinition } from '@types/plugin';
import TemperatureHistoryWidget from './widget';

export type { TemperatureHistoryConfig, TemperatureHistoryData } from './types';

export const temperatureHistoryPlugin: PluginDefinition<any, any> = {
  name: 'temperature-history',
  displayName: 'Temperature History',
  description: 'Display temperature history graph from a Z-Wave sensor',
  widget: TemperatureHistoryWidget as any,
  serverSide: true,
  defaultRefreshInterval: 300, // 5 minutes
  defaultConfig: {
    hours: 48,
    refreshSeconds: 300,
  },
};

