import React, { useEffect, useState } from 'react';
import { List, ListItem, ListItemAvatar, Avatar, ListItemText, Link, CircularProgress, Alert } from '@mui/material';
import { retryingJson } from '../../lib/retryFetch.js';
import { useDashboardSettings } from '../index.jsx';
import { formatDate } from '../../lib/dateFormat.js';

export default function RSSWidget({ url, urls, limit = 10, refreshSignal }) {
  const settings = useDashboardSettings();
  const dateFmt = settings?.dateFormat;
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    const body = { limit, force: true };
    if (Array.isArray(urls) && urls.length) body.urls = urls;
    else if (url) body.url = url;
    retryingJson('/api/widget/rss-feed', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }, { retries: 2, backoffMs: 500 })
      .then(({ data }) => { if (!active) return; setItems(data.items || []); setTitle(data.title || ''); })
      .catch((e) => { if (!active) return; setError(String(e)); })
      .finally(() => { if (!active) return; setLoading(false); });
    return () => { active = false; };
  }, [url, JSON.stringify(urls || []), limit, refreshSignal]);

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <List dense>
      {items.map((it, idx) => (
        <ListItem key={idx} disableGutters alignItems="flex-start">
          <ListItemAvatar>
            <Avatar variant="rounded" src={it.image || undefined}>{/* fallback empty */}</Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={<Link href={it.link} target="_blank" rel="noreferrer">{it.title}</Link>}
            secondary={
              <span>
                <strong>{it.sourceTitle || ''}</strong>{' '}
                <em>{formatDate(it.pubDate || it.isoDate, dateFmt)}</em>
                {it.contentSnippet && <span> — {it.contentSnippet}</span>}
              </span>
            }
          />
        </ListItem>
      ))}
    </List>
  );
}

