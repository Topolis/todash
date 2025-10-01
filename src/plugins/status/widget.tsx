import React, { useEffect, useState } from 'react';
import { Alert, Box, LinearProgress, Stack, Typography } from '@mui/material';
import { retryingJson } from '@app/lib/retryFetch';
import { sprintf } from '@app/lib/sprintf';
import type { PluginWidgetProps } from '@types/plugin';
import type { StatusConfig, StatusData, StatusItem } from './data';

export default function StatusWidget(props: PluginWidgetProps<StatusConfig, StatusData>) {
  const { items = [], refreshSeconds = 5, refreshSignal } = props;
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchData = () => {
      retryingJson<{ data: StatusData }>(
        '/api/widget/status',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        },
        { retries: 1, backoffMs: 400 }
      )
        .then(({ data }) => {
          if (!active) return;
          setData(data);
          setError(null);
        })
        .catch((e) => {
          if (!active) return;
          setError(String(e));
        });
    };

    fetchData();
    const id = setInterval(fetchData, Math.max(2, Number(refreshSeconds || 5)) * 1000);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [JSON.stringify(items || []), refreshSeconds, refreshSignal]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  return (
    <Stack spacing={1}>
      {data.items?.map((it: StatusItem, idx: number) => (
        <Box key={idx}>
          <Typography variant="caption" sx={{ color: 'rgba(200,210,230,0.85)' }}>
            {it.label}
          </Typography>
          {it.display === 'progress' ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flexGrow: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(
                    0,
                    Math.min(100, it.valueMax ? (it.value / it.valueMax) * 100 : it.value)
                  )}
                />
              </Box>
              <Typography variant="caption">
                {it.valueMax
                  ? `${Math.round((it.value / it.valueMax) * 100)}%`
                  : `${it.value}%`}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2">
              {it.value === null || it.value === undefined
                ? 'N/A'
                : it.format
                ? sprintf(it.format, it.value)
                : String(it.value)}
            </Typography>
          )}
        </Box>
      ))}
    </Stack>
  );
}
