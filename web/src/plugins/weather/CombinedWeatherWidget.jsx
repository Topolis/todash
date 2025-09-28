import React, { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, CircularProgress, Alert, Tabs, Tab } from '@mui/material';
import Grid from '@mui/material/Grid';
import { BarChart } from '@mui/x-charts';
import { retryingJson } from '../../lib/retryFetch.js';
import { useDashboardSettings } from '../index.jsx';
import { formatDate } from '../../lib/dateFormat.js';

function wmoToIconName(code) {
  const c = Number(code);
  if (c === 0) return 'sun';
  if (c === 1 || c === 2) return 'cloud-sun';
  if (c === 3) return 'clouds';
  if (c === 45 || c === 48) return 'fog';
  if ([51, 53, 55, 56, 57].includes(c)) return 'cloud-drizzle';
  if ([61, 63, 65, 80, 81, 82].includes(c)) return 'cloud-rain';
  if ([66, 67].includes(c)) return 'cloud-hail';
  if ([71, 73, 75, 77, 85, 86].includes(c)) return 'cloud-snow';
  if (c === 95) return 'cloud-lightning';
  if ([96, 99].includes(c)) return 'cloud-rain-lightning';
  return 'cloud';
}

const WeatherIcon = ({ code, size = 28, sx }) => {
  const name = wmoToIconName(code);
  return (
    <Box component="img"
      alt=""
      src={`/icons/weather/dripicons/${name}.svg`}
      sx={{ width: size, height: size, display: 'inline-block', filter: 'invert(1)', opacity: 0.9, ...sx }}
    />
  );
};

function wmoToText(code) {
  if (code === 0) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunder';
  return 'Weather';
}

function BarChartMui({ xLabels = [], data = [], color = '#d8b11e', height = 140 }) {
  const thinLabel = (v, i) => (i % Math.max(1, Math.ceil((xLabels.length || 1) / 6)) ? '' : v);
  const values = data.map(v => (typeof v === 'number' ? v : 0));

  return (
    <Box sx={{ height, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
      <BarChart
        xAxis={[{ scaleType: 'band', data: xLabels, valueFormatter: thinLabel }]}
        series={[{ data: values, color }]}
        height={height}
        slotProps={{ legend: { hidden: true } }}
        sx={{
          '--Charts-grid-lineColor': 'rgba(255,255,255,0.12)',
        }}
        margin={{ top: 10, left: 0, right: 10, bottom: 5 }}
      />
    </Box>
  );
}

export default function CombinedWeatherWidget({ latitude, longitude, refreshSignal }) {
  const settings = useDashboardSettings();
  const dateFmt = settings?.dateFormat;
  const lat = (latitude ?? settings?.defaultLocation?.latitude);
  const lon = (longitude ?? settings?.defaultLocation?.longitude);
  const [curr, setCurr] = useState(null);
  const [fc, setFc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(2);


  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    if (typeof lat !== 'number' || typeof lon !== 'number') { setError('Missing latitude/longitude'); setLoading(false); return; }
    Promise.all([
      retryingJson('/api/widget/weather', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude: lat, longitude: lon, force: true })
      }, { retries: 2, backoffMs: 500 }),
      retryingJson('/api/widget/weather-forecast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude: lat, longitude: lon, force: true })
      }, { retries: 1, backoffMs: 500 })
    ]).then(([c, f]) => { if (!active) return; setCurr(c?.data || null); setFc(f?.data || null); })
      .catch(e => { if (!active) return; setError(String(e)); })
      .finally(() => { if (!active) return; setLoading(false); });
    return () => { active = false; };
  }, [lat, lon, refreshSignal]);

  const days = useMemo(() => {
    const daily = fc?.daily;
    if (!daily) return [];
    const out = [];
    for (let i = 0; i < Math.min(daily.time.length, 7); i++) {
      out.push({
        date: daily.time[i],
        tmax: daily.temperature_2m_max?.[i],
        tmin: daily.temperature_2m_min?.[i],
        pop: daily.precipitation_probability_max?.[i],
        code: daily.weather_code?.[i]
      });
    }
    return out;
  }, [fc]);

  // Next 24 hours (local) for charts
  const hourly = useMemo(() => {
    const h = fc?.hourly;
    const times = h?.time || [];
    if (!Array.isArray(times) || times.length === 0) return { times: [], temp: [], pop: [] };
    const toMs = (t) => new Date(t).getTime();
    const nowMs = Date.now();
    let idx = times.findIndex((t) => toMs(t) >= nowMs);
    if (idx < 0) idx = 0;
    const end = Math.min(idx + 24, times.length);
    return {
      times: times.slice(idx, end),
      temp: (h.temperature_2m || []).slice(idx, end).map(v => (typeof v === 'number' ? v : 0)),
      pop: (h.precipitation_probability || []).slice(idx, end).map(v => (typeof v === 'number' ? v : 0)),
    };
  }, [fc]);

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error}</Alert>;

  const today = days[0];

  return (
    <Stack spacing={1} sx={{ height: '100%' }}>
      {/* Header area */}
      <Grid container spacing={1} alignItems="flex-start">
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={0.25}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h3" component="div">
                {typeof curr?.temperature_2m === 'number' ? `${Math.round(curr.temperature_2m)}°C` : '--'}
              </Typography>
              <WeatherIcon code={(curr?.weather_code ?? today?.code)} size={28} />
            </Stack>
            <Typography variant="body2">Precipitation: {typeof today?.pop === 'number' ? `${Math.round(today.pop)}%` : '—'}</Typography>
            <Typography variant="body2">Humidity: {typeof curr?.relative_humidity_2m === 'number' ? `${curr.relative_humidity_2m}%` : '—'}</Typography>
            <Typography variant="body2">Wind: {typeof curr?.wind_speed_10m === 'number' ? `${curr.wind_speed_10m} km/h` : '—'}</Typography>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }} sx={{mb: 2}}>
          <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
            <Typography variant="h6">Weather</Typography>
            <Typography variant="body2">{curr?.time ? formatDate(curr.time, dateFmt) : ''}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>{wmoToText(curr?.weather_code ?? today?.code)}</Typography>
          </Stack>
        </Grid>
      </Grid>

      {/* Tabs for Temperature and Precipitation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          aria-label="weather charts"
          sx={{ minHeight: 36 }}
        >
          <Tab label="Temperature" sx={{ minHeight: 30, fontSize: '0.7rem', py: 0 }} />
          <Tab label="Rain" sx={{ minHeight: 30, fontSize: '0.7rem', py: 0 }} />
          <Tab label="7 Day" sx={{ minHeight: 30, fontSize: '0.7rem', py: 0 }} />
        </Tabs>
      </Box>

      {/* Chart content based on active tab */}
      {(() => {
        const hourLabels = hourly.times.map(t => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit' }));

        if (activeTab === 0) {
          // Temperature chart
          return (
            <BarChartMui
              xLabels={hourLabels}
              data={hourly.temp}
              color="#d8b11e"
              height={160}
            />
          );
        } else if (activeTab === 1) {
          // Precipitation chart
          return (
            <BarChartMui
              xLabels={hourLabels}
              data={hourly.pop}
              color="#2196f3"
              height={160}
            />
          );
        } else {
          // 7-day forecast
          return (
            <Box sx={{ height: 160, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden', p: 1 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${days.length || 1}, 1fr)`, gap: '6px', height: '100%' }}>
                {days.map((d) => (
                  <Box key={d.date} sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1, minWidth: 0, display:'flex', flexDirection:'column', justifyContent:'space-evenly', alignItems: 'center', height: '100%' }}>
                    <Typography variant="caption" sx={{ display: 'block', fontSize: '0.75rem', fontWeight: 500 }}>{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}</Typography>
                    <WeatherIcon code={d.code} size={32} />
                    <Typography variant="caption" sx={{ fontSize: '0.8rem', textAlign: 'center', fontWeight: 500 }}>
                      <span>{Math.round(d.tmax)}°</span>
                      <Typography component="span" variant="caption" sx={{ opacity: 0.7, fontSize: '0.75rem' }}>/ {Math.round(d.tmin)}°</Typography>
                    </Typography>
                    {typeof d.pop === 'number' && (
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box component="img" alt="" src="/icons/weather/dripicons/raindrop.svg" sx={{ width: 12, height: 12, filter: 'invert(1)', opacity: 0.8 }} />
                        <span>{`${Math.round(d.pop)}%`}</span>
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          );
        }
      })()}

    </Stack>
  );
}

