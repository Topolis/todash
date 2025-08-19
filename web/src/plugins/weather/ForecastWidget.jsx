import React, { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, CircularProgress, Alert, Chip } from '@mui/material';
import { retryingJson } from '../../lib/retryFetch.js';
import { useDashboardSettings } from '../index.jsx';

function wmoToEmoji(code) {
  // Minimal WMO code mapping
  if (code === 0) return '☀️';
  if ([1,2,3].includes(code)) return '⛅';
  if ([45,48].includes(code)) return '🌫️';
  if ([51,53,55,56,57,61,63,65,66,67].includes(code)) return '🌧️';
  if ([71,73,75,77,85,86].includes(code)) return '❄️';
  if ([95,96,99].includes(code)) return '⛈️';
  return '🌡️';
}

export default function ForecastWidget({ latitude, longitude }) {
  const settings = useDashboardSettings();
  const lat = (latitude ?? settings?.defaultLocation?.latitude);
  const lon = (longitude ?? settings?.defaultLocation?.longitude);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setError(null); setLoading(true);
    if (typeof lat !== 'number' || typeof lon !== 'number') { setError('Missing latitude/longitude'); setLoading(false); return; }
    retryingJson('/api/widget/weather-forecast', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude: lat, longitude: lon, force: true })
    }, { retries: 1, backoffMs: 500 })
      .then(({ data }) => { if (!active) return; setData(data); })
      .catch(e => { if (!active) return; setError(String(e)); })
      .finally(() => { if (!active) return; setLoading(false); });
    return () => { active = false; };
  }, [lat, lon]);

  const daily = data?.daily;
  const days = useMemo(() => {
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
  }, [daily]);

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!daily) return <Typography>No forecast</Typography>;

  return (
    <Stack spacing={1} sx={{ overflow: 'auto' }}>
      <Typography variant="subtitle2">7-day forecast</Typography>
      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto' }}>
        {days.map((d) => (
          <Box key={d.date} sx={{ p: 1, minWidth: 120, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1 }}>
            <Typography variant="caption">{new Date(d.date).toLocaleDateString()}</Typography>
            <Typography variant="h5" component="div">{wmoToEmoji(d.code)} {Math.round(d.tmax)}°/{Math.round(d.tmin)}°</Typography>
            {typeof d.pop === 'number' && <Chip size="small" label={`POP ${d.pop}%`} />}
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

