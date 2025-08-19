import React, { useEffect, useState } from 'react';
import { Stack, Typography, CircularProgress, Alert } from '@mui/material';
import { retryingJson } from '../../lib/retryFetch.js';

export default function ProjectStatusWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    retryingJson('/api/widget/project-status', { method: 'POST' }, { retries: 1, backoffMs: 500 })
      .then(({ data }) => { if (!active) return; setData(data) })
      .catch((e) => { if (!active) return; setError(String(e)); })
      .finally(() => { if (!active) return; setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Typography>No data</Typography>;

  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle1">{data.name}</Typography>
      <Typography variant="body2">Version: {data.version}</Typography>
      <Typography variant="body2">Server time: {new Date(data.serverTime).toLocaleString()}</Typography>
      <Typography variant="body2">Uptime: {Math.floor(data.uptimeSec)}s</Typography>
      {data.git && (
        <Typography variant="body2">
          Git: {data.git.ref ? `${data.git.ref}@` : ''}{data.git.commit?.slice(0,7) || 'unknown'}
        </Typography>
      )}
    </Stack>
  );
}

