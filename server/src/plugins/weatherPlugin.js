export const weatherPlugin = {
  async fetchData(config) {
    const { cacheGet, cacheSet } = await import('../cache.js');
    // Simple Open-Meteo (no key) example
    const { latitude, longitude } = config;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Weather requires numeric latitude and longitude');
    }
    const key = `weather:${latitude.toFixed(3)},${longitude.toFixed(3)}`;
    const ttlMs = (process.env.CACHE_TTL_MS && Number(process.env.CACHE_TTL_MS)) || 5 * 60 * 1000;
    const cached = cacheGet(key);
    if (!config.force && cached) return cached;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather API error');
    const json = await res.json();
    const data = json.current || json;
    cacheSet(key, data, ttlMs);
    return data;
  },
};

export const weatherForecastPlugin = {
  async fetchData(config) {
    const { cacheGet, cacheSet } = await import('../cache.js');
    // Open-Meteo free forecast
    const { latitude, longitude, hourly = ['temperature_2m','precipitation_probability','weather_code'], daily = ['temperature_2m_max','temperature_2m_min','precipitation_probability_max','weather_code'] } = config;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') throw new Error('Weather forecast requires numeric latitude and longitude');
    const key = `forecast:${latitude.toFixed(3)},${longitude.toFixed(3)}:${hourly.join(',')}:${daily.join(',')}`;
    const ttlMs = (process.env.CACHE_TTL_MS && Number(process.env.CACHE_TTL_MS)) || 10 * 60 * 1000;
    const cached = cacheGet(key);
    if (!config.force && cached) return cached;
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      hourly: hourly.join(','),
      daily: daily.join(','),
      timezone: 'auto'
    });
    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Forecast API error');

    const json = await res.json();
    cacheSet(key, json, ttlMs);
    return json;
  }
};
