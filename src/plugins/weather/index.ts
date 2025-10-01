import type { PluginDefinition } from '@types/plugin';
import WeatherWidget from './widget';

export type { WeatherConfig, WeatherData, WeatherForecastConfig, WeatherForecastData } from './data';

export const weatherPlugin: PluginDefinition<any, any> = {
  name: 'weather',
  displayName: 'Weather',
  description: 'Display current weather conditions using Open-Meteo API',
  widget: WeatherWidget as any,
  serverSide: false,
  defaultRefreshInterval: 300,
  defaultConfig: {
    latitude: 0,
    longitude: 0,
  },
};

export const weatherForecastPlugin: PluginDefinition<any, any> = {
  name: 'weather-forecast',
  displayName: 'Weather Forecast',
  description: 'Display weather forecast using Open-Meteo API',
  widget: WeatherWidget as any,
  serverSide: false,
  defaultRefreshInterval: 600,
};
