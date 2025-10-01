import { cacheGet, cacheSet } from '@server/cache';

/**
 * Weather plugin configuration
 */
export interface WeatherConfig {
  latitude: number;
  longitude: number;
  force?: boolean;
}

/**
 * Weather data response from Open-Meteo API
 */
export interface WeatherData {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  weather_code: number;
  wind_speed_10m: number;
}

/**
 * Fetch current weather data from Open-Meteo API
 */
export async function fetchWeatherData(config: WeatherConfig): Promise<WeatherData> {
  const { latitude, longitude, force } = config;
  
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Weather requires numeric latitude and longitude');
  }
  
  // Check cache first
  const cacheKey = `weather:${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const ttlMs = (process.env.CACHE_TTL_MS && Number(process.env.CACHE_TTL_MS)) || 5 * 60 * 1000;
  
  if (!force) {
    const cached = cacheGet<WeatherData>(cacheKey);
    if (cached) return cached;
  }
  
  // Fetch from API
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
  const res = await fetch(url);
  
  if (!res.ok) {
    throw new Error('Weather API error');
  }

  const json = await res.json() as any;
  const data = json.current || json;
  
  // Cache the result
  cacheSet(cacheKey, data, ttlMs);
  
  return data;
}

/**
 * Weather forecast configuration
 */
export interface WeatherForecastConfig {
  latitude: number;
  longitude: number;
  hourly?: string[];
  daily?: string[];
  force?: boolean;
}

/**
 * Weather forecast data
 */
export interface WeatherForecastData {
  hourly?: {
    time: string[];
    [key: string]: any;
  };
  daily?: {
    time: string[];
    [key: string]: any;
  };
}

/**
 * Fetch weather forecast data from Open-Meteo API
 */
export async function fetchWeatherForecastData(config: WeatherForecastConfig): Promise<WeatherForecastData> {
  const {
    latitude,
    longitude,
    hourly = ['temperature_2m', 'precipitation_probability', 'weather_code'],
    daily = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_probability_max', 'weather_code'],
    force,
  } = config;
  
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Weather forecast requires numeric latitude and longitude');
  }
  
  // Check cache first
  const cacheKey = `forecast:${latitude.toFixed(3)},${longitude.toFixed(3)}:${hourly.join(',')}:${daily.join(',')}`;
  const ttlMs = (process.env.CACHE_TTL_MS && Number(process.env.CACHE_TTL_MS)) || 10 * 60 * 1000;
  
  if (!force) {
    const cached = cacheGet<WeatherForecastData>(cacheKey);
    if (cached) return cached;
  }
  
  // Build URL
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: hourly.join(','),
    daily: daily.join(','),
    timezone: 'auto',
  });
  
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url);
  
  if (!res.ok) {
    throw new Error('Forecast API error');
  }
  
  const data = await res.json() as WeatherForecastData;

  // Cache the result
  cacheSet(cacheKey, data, ttlMs);

  return data;
}
