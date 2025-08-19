import React, { useEffect, useState } from 'react';
import { Stack, Typography, CircularProgress, Alert } from '@mui/material';
import { retryingJson } from '../../lib/retryFetch.js';
import { useDashboardSettings } from '../index.jsx';
import { formatDate } from '../../lib/dateFormat.js';

export default function WeatherWidget({ latitude, longitude, refreshSignal }) {
  const settings = useDashboardSettings();
  const dateFmt = settings?.dateFormat;
  const lat = (latitude ?? settings?.defaultLocation?.latitude);
  const lon = (longitude ?? settings?.defaultLocation?.longitude);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      setError('Missing latitude/longitude'); setLoading(false); return;
    }
    retryingJson('/api/widget/weather', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude: lat, longitude: lon, force: true })
    }, { retries: 2, backoffMs: 500 })
      .then(({ data }) => { if (!active) return; setData(data) })
      .catch((e) => { if (!active) return; setError(String(e)); })
      .finally(() => { if (!active) return; setLoading(false); });
    return () => { active = false; };
  }, [lat, lon, refreshSignal]);

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Typography>No data</Typography>;

  return (
    <Stack spacing={1}>
      <Typography variant="h4">{Math.round(data.temperature_2m)}°C</Typography>
      <Typography variant="body2">Humidity: {data.relative_humidity_2m}%</Typography>
      <Typography variant="body2">Wind: {data.wind_speed_10m} km/h</Typography>
      <Typography variant="caption">Updated: {formatDate(data.time, dateFmt)}</Typography>
    </Stack>
  );
}

