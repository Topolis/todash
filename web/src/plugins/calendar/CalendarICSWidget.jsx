import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Chip, CircularProgress, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { retryingJson } from '../../lib/retryFetch.js';

function fmtRange(start, end) {
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  if (s && e && s.toDateString() === e.toDateString()) {
    return `${s.toLocaleDateString()} ${s.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} – ${e.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
  }
  if (s && e) return `${s.toLocaleString()} – ${e.toLocaleString()}`;
  if (s) return s.toLocaleString();
  return '';
}

export default function CalendarICSWidget({ urls = [], sources = [], lookAheadDays = 14, limit = 20, showSourceStatus = true, refreshSignal }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setError(null); setLoading(true);
    const body = { lookAheadDays, limit, force: true };
    if (Array.isArray(sources) && sources.length) body.sources = sources;
    else body.urls = urls;
    retryingJson('/api/widget/calendar-ics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }, { retries: 1, backoffMs: 500 })
      .then(({ data }) => { if (!active) return; setItems(data); })
      .catch(e => { if (!active) return; setError(String(e)); })
      .finally(() => { if (!active) return; setLoading(false); });
    return () => { active = false; };
  }, [JSON.stringify(sources || []), JSON.stringify(urls || []), lookAheadDays, limit, refreshSignal]);

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error}</Alert>;

  const events = Array.isArray(items?.events) ? items.events : (items || []);
  const sourceStatus = Array.isArray(items?.sources) ? items.sources : [];

  if (!events || events.length === 0) return <Typography>No upcoming events</Typography>;

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      {/* Source status indicator (top) */}
      {showSourceStatus && sourceStatus.length > 0 && (
        <Box sx={{ mb: 1 }}>
          {sourceStatus.map((s, idx) => (
            s.ok ? (
              <Chip key={idx} size="small" variant="outlined" label={`${s.label || s.url} (${s.inWindow ?? s.count ?? 0})`} sx={{ mr: 0.5, mb: 0.5 }} />
            ) : (
              <Chip key={idx} size="small" color="warning" label={s.label || s.url} title={`Failed to load: ${s.error}`} sx={{ mr: 0.5, mb: 0.5 }} />
            )
          ))}
        </Box>
      )}

      <List dense>
        {events.map((ev, i) => (
          <ListItem key={i}>
            <ListItemText primary={ev.title || '(untitled)'} secondary={fmtRange(ev.start, ev.end)} />
            {(ev.color || ev.sourceLabel) && (
              <Stack direction="row" spacing={1} sx={{ ml: 1 }}>
                {ev.color && <Chip size="small" label="" sx={{ bgcolor: ev.color, width: 16 }} />}
                {ev.sourceLabel && <Chip size="small" label={ev.sourceLabel} />}
              </Stack>
            )}
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

