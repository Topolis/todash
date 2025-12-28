// Server-side plugin registration
// This file imports data providers which use Node.js APIs
// We don't import the plugin definitions from index.ts because they import widgets
// which have browser-only dependencies
import { registerPlugin } from '@plugins/index';

// Import data providers (these register value functions as side effects)
import { fetchWeatherData, fetchWeatherForecastData } from '@plugins/weather/data';
import { fetchSystemData } from '@plugins/system/data';
import { fetchRSSData } from '@plugins/rss/data';
import { fetchProjectData } from '@plugins/project/data';
import { fetchCalendarData } from '@plugins/calendar/data';
import { fetchEmailData } from '@plugins/email/data';
import { fetchYouTubeData } from '@plugins/youtube/data';
import { fetchTransitData } from '@plugins/transit/data';
import { fetchAQIData } from '@plugins/aqi/data';
import { fetchZWaveThermostatData, fetchZWaveSwitchData, fetchZWaveSensorData } from '@plugins/zwave/data';
import { fetchTimedScriptsData } from '@plugins/timed-scripts/data';
import { fetchTemperatureHistoryData } from '@plugins/temperature-history/data';
import { fetchShellyData } from '@plugins/shelly/data';
import { fetchHifiControlData } from '@plugins/hifi-control/data';
// Import device types to register them
import '@plugins/hifi-control/device-types';
// Import timed-scripts commands to register them
import '@plugins/timed-scripts/commands';
// Import pi-hole value functions (no data provider, just value functions)
// Using v6 API for Pi-hole v6+
import '@plugins/pihole/data-v6';

export function registerServerPlugins() {
  // Register plugins with their data providers
  // We create minimal plugin definitions here to avoid importing widgets
  registerPlugin({
    name: 'weather',
    displayName: 'Weather',
    widget: null as any,
    serverSide: false,
    dataProvider: fetchWeatherData,
  });

  registerPlugin({
    name: 'weather-forecast',
    displayName: 'Weather Forecast',
    widget: null as any,
    serverSide: false,
    dataProvider: fetchWeatherForecastData,
  });

  registerPlugin({
    name: 'links-list',
    displayName: 'Links List',
    widget: null as any,
    serverSide: false,
  });

  registerPlugin({
    name: 'status',
    displayName: 'Status',
    widget: null as any,
    serverSide: false,
  });

  registerPlugin({
    name: 'system-stats',
    displayName: 'System Stats',
    widget: null as any,
    serverSide: true,
    dataProvider: fetchSystemData,
  });

  registerPlugin({
    name: 'rss-feed',
    displayName: 'RSS Feed',
    widget: null as any,
    serverSide: true,
    dataProvider: fetchRSSData,
  });

  registerPlugin({
    name: 'project-status',
    displayName: 'Project Status',
    widget: null as any,
    serverSide: true,
    dataProvider: fetchProjectData,
  });

  registerPlugin({
    name: 'calendar-ics',
    displayName: 'Calendar (ICS)',
    widget: null as any,
    serverSide: true,
    dataProvider: fetchCalendarData,
  });

  registerPlugin({
    name: 'email',
    displayName: 'Email',
    widget: null as any,
    serverSide: true,
    dataProvider: fetchEmailData,
  });

  registerPlugin({
    name: 'youtube-subscriptions',
    displayName: 'YouTube Subscriptions',
    widget: null as any,
    serverSide: true,
    dataProvider: fetchYouTubeData,
  });

  registerPlugin({
    name: 'transit-incidents',
    displayName: 'Transit Incidents',
    widget: null as any,
    serverSide: true,
    dataProvider: fetchTransitData,
  });

  registerPlugin({
    name: 'aqi',
    displayName: 'Air Quality Index',
    widget: null as any,
    serverSide: true,
    dataProvider: fetchAQIData,
  });

  registerPlugin({
    name: 'zwave-thermostat',
    displayName: 'Z-Wave Thermostat',
    widget: null as any,
    serverSide: true,
    dataProvider: fetchZWaveThermostatData,
  });

  registerPlugin({
    name: 'zwave-switch',
    displayName: 'Z-Wave Switch',
    widget: null as any,
    serverSide: true,
    dataProvider: fetchZWaveSwitchData,
  });

  registerPlugin({
    name: 'zwave-sensor',
    displayName: 'Z-Wave Sensor',
    widget: null as any,
    serverSide: true,
    dataProvider: fetchZWaveSensorData,
  });

  registerPlugin({
    name: 'timed-scripts',
    displayName: 'Timed Scripts',
    widget: null as any,
    serverSide: true,
    dataProvider: fetchTimedScriptsData,
  });

  registerPlugin({
    name: 'temperature-history',
    displayName: 'Temperature History',
    widget: null as any,
    serverSide: true,
    dataProvider: fetchTemperatureHistoryData,
  });

  [
    { name: 'shelly-thermostats', displayName: 'Shelly Thermostats' },
  ].forEach((entry) => {
    registerPlugin({
      ...entry,
      widget: null as any,
      serverSide: true,
      dataProvider: fetchShellyData,
    });
  });

  registerPlugin({
    name: 'hifi-control',
    displayName: 'HiFi Control',
    widget: null as any,
    serverSide: true,
    dataProvider: async (config: any, dashboardSettings: any) => {
      return await fetchHifiControlData(config, dashboardSettings);
    },
  });
}

