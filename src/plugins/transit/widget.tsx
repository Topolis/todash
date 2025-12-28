import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ConstructionRoundedIcon from '@mui/icons-material/ConstructionRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReportIcon from '@mui/icons-material/Report';
import SubwayIcon from '@mui/icons-material/Subway';
import TrainIcon from '@mui/icons-material/Train';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import { retryingJson } from '@app/lib/retryFetch';
import type { PluginWidgetProps } from '@types/plugin';
import type { TransitConfig, TransitData, TransitIncident, TransitLine } from './data';

interface LineInfo {
  type: string;
  label: string;
}

export default function TransitIncidentsWidget(props: PluginWidgetProps<TransitConfig, TransitData>) {
  const { favorites = [], limit = 20, mvgApiUrl, apiUrl, refreshSignal } = props;
  const [items, setItems] = useState<TransitIncident[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [open, setOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<TransitIncident | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    setLoading(true);

    const config: TransitConfig = { force: true, limit };
    if (mvgApiUrl || apiUrl) config.mvgApiUrl = mvgApiUrl || apiUrl;

    retryingJson<{ data: TransitData }>(
      '/api/widget/transit-incidents',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      },
      { retries: 1, backoffMs: 500 }
    )
      .then(({ data }) => {
        if (!active) return;
        setItems(Array.isArray(data) ? data : []);
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
  }, [refreshSignal, limit, mvgApiUrl, apiUrl]);

  const favSet = useMemo(() => new Set((favorites || []).map((s: any) => String(s).toUpperCase())), [favorites]);

  const sortedAndFiltered = useMemo(() => {
    if (!items) return [];

    // sort by: primary transportType order, then publication desc
    const transportOrder: Record<string, number> = { SBAHN: 1, UBAHN: 2, BUS: 3, REGIONAL_BUS: 4 };

    const getPrimaryTransport = (it: TransitIncident) => {
      const lines = Array.isArray(it.lines) ? it.lines : [];
      const types = lines.map((l) => (typeof l === 'string' ? null : l.transportType)).filter(Boolean);
      if (types.includes('SBAHN')) return 'SBAHN';
      if (types.includes('UBAHN')) return 'UBAHN';
      if (types.includes('BUS')) return 'BUS';
      if (types.includes('REGIONAL_BUS')) return 'REGIONAL_BUS';
      return 'ZZZ';
    };

    const list = [...items].sort((a, b) => {
      const at = transportOrder[getPrimaryTransport(a)] || 99;
      const bt = transportOrder[getPrimaryTransport(b)] || 99;
      if (at !== bt) return at - bt;

      const ta = typeof a.publication === 'number' ? a.publication : Date.parse(String(a.publication || '')) || 0;
      const tb = typeof b.publication === 'number' ? b.publication : Date.parse(String(b.publication || '')) || 0;
      return tb - ta;
    });

    if (tab !== 'fav' || favSet.size === 0) return list;

    return list.filter((it) => {
      const lines = Array.isArray(it.lines) ? it.lines : [];
      return lines.some((l) => {
        const label = typeof l === 'string' ? l : l.label || l.name || l.id || '';
        return favSet.has(String(label).toUpperCase());
      });
    });
  }, [items, tab, favSet]);

  function lineTypeAndLabel(line: TransitLine | string): LineInfo {
    const raw = (typeof line === 'string' ? line : line.label || line.name || line.id || '').toString();
    const label = raw.replace(/\s+/g, '');

    if (/^U\d+/i.test(label) || raw.toUpperCase().startsWith('U')) return { type: 'U', label };
    if (/^S\d+/i.test(label) || raw.toUpperCase().startsWith('S')) return { type: 'S', label };
    if (/^\d+/.test(label) || raw.toLowerCase().startsWith('bus'))
      return { type: 'BUS', label: label.replace(/^bus/i, '') };
    return { type: 'OTHER', label };
  }

  function uniqueLineKeys(lines: (TransitLine | string)[]): LineInfo[] {
    const seen = new Set<string>();
    const out: LineInfo[] = [];

    for (const l of lines || []) {
      const { type, label } = lineTypeAndLabel(l);
      const key = `${type}:${label.toUpperCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ type, label });
      }
    }

    return out;
  }

  function LineBadge({ line }: { line: string }) {
    const { type, label } = lineTypeAndLabel(line);
    const styles = {
      U: { bg: '#005AA5', fg: '#fff', icon: <SubwayIcon sx={{ fontSize: 16 }} /> },
      S: { bg: '#007F3D', fg: '#fff', icon: <TrainIcon sx={{ fontSize: 16 }} /> },
      BUS: { bg: '#666666', fg: '#fff', icon: <DirectionsBusIcon sx={{ fontSize: 16 }} /> },
      OTHER: { bg: '#444', fg: '#fff', icon: <ReportIcon sx={{ fontSize: 16 }} /> },
    }[type];

    return (
      <Chip
        size="small"
        icon={styles?.icon}
        label={label}
        sx={{
          height: 24,
          '& .MuiChip-label': { px: 0.5, fontWeight: 600 },
          bgcolor: styles?.bg,
          color: styles?.fg,
        }}
      />
    );
  }

  function openDialog(item: TransitIncident) {
    setActiveItem(item);
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setActiveItem(null);
  }

  function relativeAge(ts: number | string | null): string {
    const t = typeof ts === 'number' ? ts : Date.parse(String(ts || ''));
    if (isNaN(t)) return '';

    const diffMs = Date.now() - t;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!items || items.length === 0) return <Alert severity="success">Keine Störungen gemeldet.</Alert>;

  return (
    <Box>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} textColor="primary" indicatorColor="primary" sx={{ mb: 1 }}>
        <Tab value="all" label="Alle" />
        <Tab value="fav" label="Favoriten" />
      </Tabs>

      <Box sx={{ height: '100%', overflow: 'auto' }}>
        <List dense sx={{ pr: 1 }}>
          {sortedAndFiltered.map((it, idx) => {
            const published = it.publication;
            const uniq = uniqueLineKeys(it.lines);
            const type = (it.type || '').toUpperCase();
            const TypeIcon =
              type === 'INCIDENT'
                ? WarningAmberRoundedIcon
                : type === 'SCHEDULE_CHANGE'
                ? ConstructionRoundedIcon
                : InfoOutlinedIcon;

            return (
              <ListItem key={idx} alignItems="flex-start" sx={{ alignItems: 'center', gap: 1 }}>
                {/* Type icon with reduced space */}
                <ListItemIcon sx={{ minWidth: 34 }}>
                  <TypeIcon color={type === 'INCIDENT' ? 'error' : 'warning'} />
                </ListItemIcon>

                {/* Content area: title left, icons below, date on right of icons */}
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%' }}>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => openDialog(it)}
                      sx={{
                        textTransform: 'none',
                        p: 0,
                        minWidth: 0,
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                        textAlign: 'left',
                        width: '100%',
                        maxWidth: '100%',
                      }}
                    >
                      {it.title}
                    </Button>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Stack direction="row" spacing={0.5} sx={{ mr: 1, flexWrap: 'wrap' }}>
                      {uniq.slice(0, 6).map((ln, i) => (
                        <LineBadge key={i} line={ln.label} />
                      ))}
                      {uniq.length > 6 && <Chip size="small" label={`+${uniq.length - 6}`} />}
                    </Stack>
                    <Box sx={{ ml: 'auto', color: 'text.secondary', fontSize: 12 }}>{relativeAge(published)}</Box>
                  </Box>
                </Box>
              </ListItem>
            );
          })}
        </List>
      </Box>

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{activeItem?.title}</DialogTitle>
        <DialogContent dividers>
          {activeItem?.description ? (
            <DialogContentText sx={{ whiteSpace: 'pre-line' }}>{activeItem.description}</DialogContentText>
          ) : (
            <DialogContentText>Keine Details verfügbar.</DialogContentText>
          )}
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" spacing={0.5}>
              {(activeItem?.lines || []).map((ln, i) => (
                <LineBadge key={i} line={typeof ln === 'string' ? ln : ln.label || ln.name || ln.id || ''} />
              ))}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Schließen</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
