import React, { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, CircularProgress, Alert, Tabs, Tab, Chip } from '@mui/material';
import Grid from '@mui/material/Grid';
import { retryingJson } from '../../lib/retryFetch.js';
import { useDashboardSettings } from '../index.jsx';
import { formatDate } from '../../lib/dateFormat.js';

function wmoToEmoji(code) {
  if (code === 0) return '☀️';
  if ([1, 2, 3].includes(code)) return '⛅';
  if ([45, 48].includes(code)) return '🌫️';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67].includes(code)) return '🌧️';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
  if ([95, 96, 99].includes(code)) return '⛈️';
  return '🌡️';
}

function wmoToText(code) {
  if (code === 0) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunder';
  return 'Weather';
}

function MiniBars({ series = [], topValues, bottomLabels, color = '#c9a227', height = 100 }) {
  if (!series.length) return <Box sx={{ height, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = Math.max(1, max - min);
  const n = series.length;
  const step = Math.max(1, Math.ceil(n / 7));
  const tops = topValues && topValues.length === n ? topValues : series;
  return (
    <Box>
      <Box sx={{ position: 'relative' }}>
        <Stack direction="row" sx={{ height, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
          {series.map((v, i) => {
            const h = Math.round(((v - min) / range) * (height - 6)) + 3;
            return <Box key={i} sx={{ flex: 1, display: 'flex', alignItems: 'flex-end', p: '2px' }}><Box sx={{ height: h, width: '100%', bgcolor: color, borderRadius: 0.5 }} /></Box>;
          })}
        </Stack>
        {/* Top labels */}
        {n > 0 && (
          <>
            {Array.from({ length: n }).map((_, i) => (i % step === 0 ? (
              <Typography key={`t${i}`} variant="caption" sx={{ position: 'absolute', top: 2, left: `${((i + 0.5) / n) * 100}%`, transform: 'translateX(-50%)', fontSize: '0.7rem', color: 'rgba(255,255,255,0.9)' }}>
                {Math.round(tops[i])}
              </Typography>
            ) : null))}
          </>
        )}
      </Box>
      {/* Bottom labels */}
      {bottomLabels && bottomLabels.length === n && (
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5, px: 0.5 }}>
          {Array.from({ length: n }).map((_, i) => (i % step === 0 ? (
            <Typography key={`b${i}`} variant="caption" sx={{ minWidth: 0, flex: 1, textAlign: 'center', fontSize: '0.7rem', color: 'rgba(220,230,245,0.9)' }}>
              {bottomLabels[i]}
            </Typography>
          ) : null))}
        </Stack>
      )}
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
  const [tab, setTab] = useState('temp');

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
              <Typography variant="h4" component="div">{wmoToEmoji(curr?.weather_code ?? today?.code)}</Typography>
            </Stack>
            <Typography variant="body2">Precipitation: {typeof today?.pop === 'number' ? `${Math.round(today.pop)}%` : '—'}</Typography>
            <Typography variant="body2">Humidity: {typeof curr?.relative_humidity_2m === 'number' ? `${curr.relative_humidity_2m}%` : '—'}</Typography>
            <Typography variant="body2">Wind: {typeof curr?.wind_speed_10m === 'number' ? `${curr.wind_speed_10m} km/h` : '—'}</Typography>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }} sx={{mb: 10}}>
          <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
            <Typography variant="h6">Weather</Typography>
            <Typography variant="body2">{curr?.time ? formatDate(curr.time, dateFmt) : ''}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>{wmoToText(curr?.weather_code ?? today?.code)}</Typography>
          </Stack>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ minHeight: 32 }}>
        <Tab label="Temperature" value="temp" sx={{ minHeight: 32 }} />
        <Tab label="Precipitation" value="rain" sx={{ minHeight: 32 }} />
      </Tabs>

      {/* Chart area approximation (aligned to days grid) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${days.length || 1}, 1fr)`, gap: '4px' }}>
        {tab === 'temp' && (
          <Box sx={{ gridColumn: `1 / span ${days.length || 1}` }}>
            <MiniBars
              series={days.map(d => typeof d.tmax === 'number' ? d.tmax : 0)}
              topValues={days.map(d => typeof d.tmax === 'number' ? d.tmax : 0)}
              bottomLabels={days.map(d => new Date(d.date).toLocaleDateString(undefined, { day: '2-digit' }))}
              color="#d8b11e"
              height={110}
            />
          </Box>
        )}
        {tab === 'rain' && (
          <Box sx={{ gridColumn: `1 / span ${days.length || 1}` }}>
            <MiniBars
              series={days.map(d => typeof d.pop === 'number' ? d.pop : 0)}
              topValues={days.map(d => typeof d.pop === 'number' ? d.pop : 0)}
              bottomLabels={days.map(d => new Date(d.date).toLocaleDateString(undefined, { day: '2-digit' }))}
              color="#2196f3"
              height={110}
            />
          </Box>
        )}
      </Box>

      {/* Daily forecast row (aligned with chart columns) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${days.length || 1}, 1fr)`, gap: '4px', pt: 0.5 }}>
        {days.map((d) => (
          <Box key={d.date} sx={{ p: 0.75, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1, minWidth: 0, display:'flex', flexDirection:'column', justifyContent:'center', minHeight: 110 }}>
            <Typography variant="caption" sx={{ display: 'block' }}>{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}</Typography>
            <Typography variant="body2" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <span style={{ fontSize: '1.1rem' }}>{wmoToEmoji(d.code)}</span>
              <span>{Math.round(d.tmax)}°</span>
              <Typography component="span" variant="caption" sx={{ opacity: 0.7 }}>/{Math.round(d.tmin)}°</Typography>
            </Typography>
            {typeof d.pop === 'number' && (
              <Typography variant="body2" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>🌧️</span>
                <span>{`${Math.round(d.pop)}%`}</span>
              </Typography>
            )}
          </Box>
        ))}
      </Box>


    </Stack>
  );
}

