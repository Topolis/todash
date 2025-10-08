import type { ServerSidePlugin } from '@types/plugin';
import type { TemperatureHistoryConfig, TemperatureHistoryData } from './types.js';
import { fetchTemperatureHistoryData } from './data.js';

export const temperatureHistoryServerPlugin: ServerSidePlugin<TemperatureHistoryConfig, TemperatureHistoryData> = {
  name: 'temperature-history',
  fetchData: fetchTemperatureHistoryData,
};

