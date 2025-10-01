import React, { useEffect, useState } from 'react';
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { retryingJson } from '@app/lib/retryFetch';
import { useDashboardSettings } from '@app/components/DashboardSettingsContext';
import type { PluginWidgetProps } from '@types/plugin';
import type { AQIConfig, AQIData } from './data';

function aqiLabel(val: number | null): string {
  if (val == null) return 'N/A';
  if (val <= 50) return 'Good';
  if (val <= 100) return 'Moderate';
  if (val <= 150) return 'Unhealthy-Sensitive';
  if (val <= 200) return 'Unhealthy';
  if (val <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

export default function AQIWidget(props: PluginWidgetProps<AQIConfig, AQIData | null>) {
  const { latitude, longitude } = props;
  const settings = useDashboardSettings();
  const lat = latitude ?? settings?.defaultLocation?.latitude;
  const lon = longitude ?? settings?.defaultLocation?.longitude;
  const [data, setData] = useState<AQIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    setLoading(true);

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      setError('Missing latitude/longitude');
      setLoading(false);
      return;
    }

    retryingJson<{ data: AQIData }>(
      '/api/widget/aqi',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lon, force: true }),
      },
      { retries: 1, backoffMs: 500 }
    )
      .then(({ data }) => {
        if (!active) return;
        setData(data);
      })
      .catch((e) => {
        if (!active) return;
        setError(String(e));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lat, lon]);

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Typography>No AQI</Typography>;

  return (
    <Box>
      <Typography variant="subtitle2">Air Quality</Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        <Chip label={`AQI: ${data.european_aqi ?? 'N/A'} (${aqiLabel(data.european_aqi)})`} />
        <Chip label={`PM2.5: ${data.pm2_5 ?? '–'}`} />
        <Chip label={`PM10: ${data.pm10 ?? '–'}`} />
        <Chip label={`NO2: ${data.no2 ?? '–'}`} />
        <Chip label={`O3: ${data.o3 ?? '–'}`} />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {new Date(data.time).toLocaleString()}
      </Typography>
    </Box>
  );
}
