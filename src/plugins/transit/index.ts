import type { PluginDefinition } from '@types/plugin';
import TransitIncidentsWidget from './widget';

export type { TransitConfig, TransitData, TransitIncident } from './data';

export const transitPlugin: PluginDefinition<any, any> = {
  name: 'transit-incidents',
  displayName: 'Transit Incidents',
  description: 'Display public transit incidents and disruptions (MVG)',
  widget: TransitIncidentsWidget as any,
  serverSide: true,
  defaultRefreshInterval: 300,
  defaultConfig: {
    limit: 20,
    favorites: [],
  },
};
