import React, { useEffect, useState } from 'react';
import { Stack, Typography, LinearProgress, Alert } from '@mui/material';
import { retryingJson } from '@app/lib/retryFetch';
import type { PluginWidgetProps } from '@types/plugin';
import type { SystemConfig, SystemData } from './data';

export default function SystemStatsWidget(props: PluginWidgetProps<SystemConfig, SystemData>) {
  const { refreshSeconds = 5, refreshSignal } = props;
  const [data, setData] = useState<SystemData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = () => {
      retryingJson<{ data: SystemData }>(
        '/api/widget/system-stats',
        { method: 'POST' },
        { retries: 1, backoffMs: 300 }
      )
        .then(({ data }) => {
          if (active) setData(data);
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    };

    load();
    const seconds = Math.max(1, Number(refreshSeconds) || 5);
    const id = setInterval(load, seconds * 1000);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [refreshSeconds, refreshSignal]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Typography>Loading…</Typography>;

  const loadPct = Math.round(data.load);
  const memUsedPct = Math.round((data.mem.used / data.mem.total) * 100);

  return (
    <Stack spacing={1}>
      <Typography variant="body2">
        CPU: {data.cpu.brand} ({data.cpu.cores} cores)
      </Typography>
      <Typography variant="body2">Load: {loadPct}%</Typography>
      <LinearProgress variant="determinate" value={loadPct} />
      <Typography variant="body2">Memory: {memUsedPct}%</Typography>
      <LinearProgress variant="determinate" value={memUsedPct} />
      <Typography variant="caption">
        OS: {data.os.distro} {data.os.release}
      </Typography>
    </Stack>
  );
}
