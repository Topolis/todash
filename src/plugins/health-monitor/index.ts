// ABOUTME: Health monitor plugin definition and registration

import type { PluginDefinition } from '@types/plugin';
import HealthMonitorWidget from './widget';
import {
  fetchHealthMonitorData,
  type HealthMonitorConfig,
  type HealthMonitorData,
} from './data';

export const healthMonitorPlugin: PluginDefinition<HealthMonitorConfig, HealthMonitorData> = {
  name: 'health-monitor',
  displayName: 'Health Monitor',
  description: 'Monitor web services and API endpoints for availability and health',
  widget: HealthMonitorWidget,
  dataProvider: fetchHealthMonitorData,
  serverSide: true, // Health checks must run on server
  defaultRefreshInterval: 30, // Check every 30 seconds by default
  defaultConfig: {
    services: [],
    timeout: 5000,
    retries: 1,
    refreshSeconds: 30,
  },
};
