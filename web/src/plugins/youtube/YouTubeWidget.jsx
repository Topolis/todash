import React, { useEffect, useState } from 'react';
import { Alert, Box, CardActionArea, CardMedia, CircularProgress, Grid, Typography } from '@mui/material';
import { retryingJson } from '../../lib/retryFetch.js';

export default function YouTubeWidget({ limit = 12 }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setError(null); setLoading(true);
    retryingJson('/api/widget/youtube-subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit }) }, { retries: 1, backoffMs: 500 })
      .then(({ data }) => { if (!active) return; setItems(Array.isArray(data) ? data : []); })
      .catch(e => { if (!active) return; setError(String(e)); })
      .finally(() => { if (!active) return; setLoading(false); });
    return () => { active = false; };
  }, [limit]);

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!items) return null;

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      <Grid container spacing={1}>
        {items.map(it => (
          <Grid key={it.videoId} item xs={6} sm={4} md={3}>
            <CardActionArea component="a" href={it.url} target="_blank" rel="noreferrer">
              {it.thumbnail && (
                <CardMedia component="img" image={it.thumbnail} alt={it.title} sx={{ borderRadius: 1 }} />
              )}
              <Typography variant="subtitle2" noWrap title={it.title}>{it.title}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>{it.channelTitle}</Typography>
            </CardActionArea>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

