import React, { useEffect, useState } from 'react';
import { Stack, Typography, CircularProgress, Alert, Link } from '@mui/material';
import { retryingJson } from '../../lib/retryFetch.js';

// props: { refreshSeconds?: number, refreshSignal?: number }
export default function ProjectStatusWidget({ refreshSeconds = 5, refreshSignal }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      setLoading(true); setError(null);
      retryingJson('/api/widget/project-status', { method: 'POST' }, { retries: 1, backoffMs: 300 })
        .then(({ data }) => { if (active) setData(data); })
        .catch((e) => { if (active) setError(String(e)); })
        .finally(() => { if (active) setLoading(false); });
    };
    load();
    const seconds = Math.max(1, Number(refreshSeconds) || 5);
    const id = setInterval(load, seconds * 1000);
    return () => { active = false; clearInterval(id); };
  }, [refreshSeconds, refreshSignal]);

  if (loading && !data) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Typography>No data</Typography>;

  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle1">{data.name}</Typography>
      <Typography variant="body2">Version: {data.version}</Typography>
      <Typography variant="body2">Server time: {new Date(data.serverTime).toLocaleString()}</Typography>
      <Typography variant="body2">Uptime: {Math.floor(data.uptimeSec)}s</Typography>
      {data.git && (
        <>
          <Typography variant="body2">
            {data.git.branch ? `Branch: ${data.git.branch}` : 'Git info unavailable'} {data.git.commit && `(${data.git.commit.slice(0,7)})`}
          </Typography>
          {((data.git.ahead ?? 0) !== 0 || (data.git.behind ?? 0) !== 0) && (
            <Typography variant="body2">Ahead/Behind: {data.git.ahead ?? 0}/{data.git.behind ?? 0}</Typography>
          )}
          {(typeof data.git.changed === 'number' || typeof data.git.untracked === 'number') && (
            <Typography variant="body2">Changes: {data.git.changed ?? 0} | Untracked: {data.git.untracked ?? 0}</Typography>
          )}
          {data.git.github && (
            <Typography variant="body2">
              GitHub: <Link href={data.git.github.repoUrl} target="_blank" rel="noreferrer" underline="hover" sx={{
                color: 'rgba(144, 202, 249, 0.7)',
                textDecorationColor: 'rgba(144, 202, 249, 0.25)',
                '&:hover': { color: 'rgba(144, 202, 249, 0.85)', textDecorationColor: 'rgba(144, 202, 249, 0.5)' }
              }}>{data.git.github.owner}/{data.git.github.repo}</Link>
              {` ${data.git.github.branch}`}
              {(data.git.github.pullsOpen ?? 0) > 0 && (
                <> {` - Open PRs: ${data.git.github.pullsOpen}`}</>
              )}
            </Typography>
          )}
        </>
      )}
    </Stack>
  );
}

