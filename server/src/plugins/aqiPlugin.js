export const aqiPlugin = {
  async fetchData(config) {
    const { cacheGet, cacheSet } = await import('../cache.js');
    const { latitude, longitude } = config;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('aqi requires numeric latitude and longitude');
    }
    const key = `aqi:${latitude.toFixed(3)},${longitude.toFixed(3)}`;
    const ttlMs = (process.env.CACHE_TTL_MS && Number(process.env.CACHE_TTL_MS)) || 5 * 60 * 1000;
    const cached = cacheGet(key);
    if (!config.force && cached) return cached;
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      hourly: ['european_aqi','pm2_5','pm10','nitrogen_dioxide','ozone','sulphur_dioxide','carbon_monoxide'].join(','),
      timezone: 'auto'
    });
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('AQI API error');
    const json = await res.json();
    const h = json.hourly || {};
    const times = h.time || [];
    const idx = times.length - 1;
    const data = idx >= 0 ? {
      time: times[idx],
      european_aqi: h.european_aqi?.[idx] ?? null,
      pm2_5: h.pm2_5?.[idx] ?? null,
      pm10: h.pm10?.[idx] ?? null,
      no2: h.nitrogen_dioxide?.[idx] ?? null,
      o3: h.ozone?.[idx] ?? null,
      so2: h.sulphur_dioxide?.[idx] ?? null,
      co: h.carbon_monoxide?.[idx] ?? null,
    } : null;
    cacheSet(key, data, ttlMs);
    return data;
  }
};
