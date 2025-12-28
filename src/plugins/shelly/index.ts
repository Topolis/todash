// ABOUTME: Declares the Shelly dashboard plugin for registering on client and server.
// ABOUTME: Exports widget definitions and related configuration/data types.

import type { PluginDefinition } from '../../types/plugin';
import ShellyThermostatsWidget from './thermostats';
import type {
  ShellyWidgetConfig,
  ShellyWidgetData,
  ShellyThermostatState,
  ShellyControllerInfo,
} from './data';

export type {
  ShellyWidgetConfig,
  ShellyWidgetData,
  ShellyThermostatState,
  ShellyControllerInfo,
} from './data';

export const shellyThermostatsPlugin: PluginDefinition<ShellyWidgetConfig, ShellyWidgetData> = {
  name: 'shelly-thermostats',
  displayName: 'Shelly Thermostats',
  description: 'Control Shelly Gen3 thermostats',
  widget: ShellyThermostatsWidget,
  serverSide: true,
  defaultRefreshInterval: 15,
  defaultConfig: {
    refreshSeconds: 15,
    includeScripts: false,
    includeActions: false,
    includeSchedules: false,
  },
};

export const shellyPlugins = [
  shellyThermostatsPlugin,
];
