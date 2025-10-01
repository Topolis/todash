import type { PluginDefinition } from '@types/plugin';
import StatusWidget from './widget';
import { fetchStatusData, type StatusConfig, type StatusData } from './data';

export const statusPlugin: PluginDefinition<StatusConfig, StatusData> = {
  name: 'status',
  displayName: 'Status',
  description: 'Display system status values using value functions',
  widget: StatusWidget,
  dataProvider: fetchStatusData,
  serverSide: true, // Requires server-side value function evaluation
  defaultRefreshInterval: 5,
  defaultConfig: {
    items: [],
    refreshSeconds: 5,
  },
};
