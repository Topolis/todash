// ABOUTME: HiFi Control plugin registration for client
// ABOUTME: Exports plugin definition for dashboard widget rendering

import type { PluginDefinition } from '../../types/plugin';
import HifiControlWidget from './widget';
import type { HifiControlConfig, HifiControlData } from './types';

export type { HifiControlConfig, HifiControlData } from './types';

export const hifiControlPlugin: PluginDefinition<HifiControlConfig, HifiControlData> = {
  name: 'hifi-control',
  displayName: 'HiFi Control',
  description: 'Control AV receivers and amplifiers',
  widget: HifiControlWidget,
  serverSide: true,
  defaultRefreshInterval: 5,
  defaultConfig: {
    refreshSeconds: 5,
    showPower: true,
    showVolume: true,
    showInputs: true,
    showSurroundMode: false,
    showAdvanced: false,
  },
};
