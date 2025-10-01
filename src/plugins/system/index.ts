import type { PluginDefinition } from '@types/plugin';
import SystemStatsWidget from './widget';

export type { SystemConfig, SystemData } from './data';

export const systemPlugin: PluginDefinition<any, any> = {
  name: 'system-stats',
  displayName: 'System Stats',
  description: 'Display system CPU, memory, and OS information',
  widget: SystemStatsWidget as any,
  serverSide: true,
  defaultRefreshInterval: 5,
  defaultConfig: {
    refreshSeconds: 5,
  },
};
