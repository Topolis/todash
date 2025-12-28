import React, { useEffect, useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Link,
  CircularProgress,
  Alert,
  Typography,
  Chip,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { retryingJson } from '@app/lib/retryFetch';
import { useDashboardSettings } from '@app/components/DashboardSettingsContext';
import { formatDate } from '@app/lib/dateFormat';
import type { PluginWidgetProps } from '@types/plugin';
import type { RSSConfig, RSSData, RSSItem } from './data';

export default function RSSWidget(props: PluginWidgetProps<RSSConfig, RSSData>) {
  const { url, urls, limit = 10, layout = 'list', rowMinHeight = 160, refreshSignal } = props;
  const settings = useDashboardSettings();
  const dateFmt = settings?.dateFormat;
  const [items, setItems] = useState<RSSItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const config: RSSConfig = { limit, force: true };
    if (Array.isArray(urls) && urls.length) config.urls = urls;
    else if (url) config.url = url;

    retryingJson<{ data: RSSData }>(
      '/api/widget/rss-feed',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      },
      { retries: 2, backoffMs: 500 }
    )
      .then(({ data }) => {
        if (!active) return;
        setItems(data.items || []);
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
  }, [url, JSON.stringify(urls || []), limit, refreshSignal]);

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error}</Alert>;

  if (layout === 'msn') {
    return <MsnLayout items={items} dateFmt={dateFmt} rowMinHeight={rowMinHeight} />;
  }

  return (
    <List dense>
      {items.map((it, idx) => (
        <ListItem key={idx} disableGutters alignItems="flex-start">
          <ListItemAvatar>
            <Avatar variant="rounded" src={it.image || undefined}>
              {/* fallback empty */}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={
              <Link href={it.link} target="_blank" rel="noreferrer">
                {it.title}
              </Link>
            }
            secondary={
              <span>
                <strong>{it.sourceTitle || ''}</strong>{' '}
                <em>{formatDate((it.pubDate || it.isoDate) as string, dateFmt)}</em>
                {it.contentSnippet && <span> — {it.contentSnippet}</span>}
              </span>
            }
          />
        </ListItem>
      ))}
    </List>
  );
}

interface MsnLayoutProps {
  items: RSSItem[];
  dateFmt?: string;
  rowMinHeight?: number;
}

function MsnLayout({ items, dateFmt, rowMinHeight = 160 }: MsnLayoutProps) {
  const minH = Math.round(rowMinHeight * 1.33); // +33% height for MSN cards
  return (
    <Grid container spacing={1} alignItems="stretch" sx={{ width: '100%', m: 0 }}>
      {items.map((it, i) => {
        const m = i % 6;
        const isWide = m === 0 || m === 5; // pattern: 2-col, 1-col x4, 2-col
        const cols = isWide ? 6 : 3; // 50% or 25% of a 12-col grid
        return (
          <Grid key={i} size={{ xs: 12, md: cols }} sx={{ display: 'flex' }}>
            <MsnCard item={it} size={isWide ? 'lg' : 'md'} sx={{ minHeight: minH, flex: 1 }} dateFmt={dateFmt} />
          </Grid>
        );
      })}
    </Grid>
  );
}

interface MsnCardProps {
  item: RSSItem;
  size?: 'md' | 'lg';
  sx?: any;
  dateFmt?: string;
}

function MsnCard({ item, size = 'md', sx, dateFmt }: MsnCardProps) {
  const { title, link, image, sourceTitle, pubDate, isoDate, contentSnippet, content, description, summary } = item;
  const bg = image
    ? `linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.55) 60%), url(${image})`
    : 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.5) 60%)';

  const plain = (html?: string) =>
    String(html || '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const snippet = (contentSnippet && String(contentSnippet)) || plain(content || description || summary || '');
  const clamp = size === 'lg' ? 3 : 2;

  return (
    <Link href={link} target="_blank" rel="noreferrer" underline="none" sx={{ display: 'block', width: '100%' }}>
      <Box
        sx={{
          position: 'relative',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'grey.900',
          backgroundImage: bg,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          p: 1.5,
          display: 'flex',
          alignItems: 'flex-end',
          width: '100%',
          ...sx,
        }}
      >
        <Box sx={{ color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.8)', width: '100%' }}>
          <Typography variant={size === 'lg' ? 'h6' : 'subtitle1'} sx={{ lineHeight: 1.2 }}>
            {title}
          </Typography>
          {snippet && (
            <Typography
              variant={size === 'lg' ? 'body2' : 'caption'}
              sx={{
                opacity: 0.95,
                mt: 0.5,
                display: '-webkit-box',
                WebkitLineClamp: clamp,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {snippet}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.75 }}>
            {sourceTitle && (
              <Chip size="small" label={sourceTitle} sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white' }} />
            )}
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              {formatDate((pubDate || isoDate) as string, dateFmt)}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Link>
  );
}
