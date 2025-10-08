import React, { useEffect, useMemo, useState } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Container,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import BugReportIcon from '@mui/icons-material/BugReport';
import SettingsRemoteIcon from '@mui/icons-material/SettingsRemote';
import DashboardGrid from './components/DashboardGrid';
import PanelRenderer from './components/PanelRenderer';
import SaveLayoutBar from './components/SaveLayoutBar';
import LogViewerDialog from './components/LogViewerDialog';
import { DashboardSettingsContext } from './components/DashboardSettingsContext';
import { DashboardThemeContext } from './components/DashboardThemeContext';
import { WallpaperRenderer } from '../wallpapers';
import { logger } from '../lib/logger';
import type { DashboardConfig } from '@types/dashboard';
import type { PanelConfig } from '@types/panel';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#90caf9' },
    background: { default: '#0b0f19', paper: '#0e1422' },
  },
  shape: { borderRadius: 12 },
});

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const [edit, setEdit] = useState(false);
  const [layout, setLayout] = useState<PanelConfig[] | null>(null);
  const [name, setName] = useState('sample');
  const [logViewerOpen, setLogViewerOpen] = useState(false);

  useEffect(() => {
    logger.info('App', 'Application starting');

    // Load available dashboards and then the selected one
    fetch('/api/dashboards')
      .then((r) => r.json())
      .then(({ dashboards }) => {
        logger.info('App', `Loaded ${dashboards?.length || 0} available dashboards`);
        setAvailable(dashboards || []);
      })
      .catch((e) => {
        logger.error('App', 'Failed to load available dashboards', e);
      });

    const params = new URLSearchParams(window.location.search);
    const n = params.get('dashboard') || 'sample';
    setName(n);
    logger.info('App', `Loading dashboard: ${n}`);

    fetch(`/api/dashboards/${encodeURIComponent(n)}`)
      .then((r) => r.json())
      .then((cfg) => {
        logger.info('App', `Dashboard loaded: ${cfg.config?.title || n}`);
        setDashboard(cfg.config);
        setLayout(cfg.config.panels || []);
      })
      .catch((e) => {
        logger.error('App', `Failed to load dashboard: ${n}`, e);
        setError((e as Error).message);
      });
  }, []);

  const gridSpec = useMemo(
    () => dashboard?.grid || { columns: 12, gap: 12, rowHeight: 120 },
    [dashboard]
  );

  async function persistLayout(newLayout: PanelConfig[]) {
    try {
      const isDev = window.location.port === '5173';
      const apiBase = isDev ? 'http://localhost:4000' : '';
      const res = await fetch(`${apiBase}/api/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, panels: newLayout }),
      });

      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 200) || 'Invalid JSON response');
      }

      if (!res.ok) {
        console.warn('Persist layout failed:', json?.error || text);
      } else if (json?.newName && json.newName !== name) {
        // Only auto-switch when coming from 'sample' to 'sample.local'
        if (name === 'sample' && json.newName === 'sample.local') {
          setName(json.newName);
          const qs = new URLSearchParams(window.location.search);
          qs.set('dashboard', json.newName);
          window.history.replaceState(null, '', `?${qs.toString()}`);
        }
      }
    } catch (e) {
      console.warn('Persist layout failed:', e);
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <style>{`
        /* styled scrollbars for WebKit */
        *::-webkit-scrollbar { width: 10px; height: 10px; }
        *::-webkit-scrollbar-track { background: #0e1422; border-radius: 8px; }
        *::-webkit-scrollbar-thumb { background-color: #2a3550; border-radius: 8px; border: 2px solid #0e1422; }
        *::-webkit-scrollbar-thumb:hover { background-color: #3a4666; }
        /* Firefox */
        * { scrollbar-width: thin; scrollbar-color: #2a3550 #0e1422; }
      `}</style>

      {/* Wallpaper layer */}
      <WallpaperRenderer config={dashboard?.wallpaper} settings={dashboard?.settings} />

      <Container maxWidth="xl" sx={{ py: 2, position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
          <Tooltip title={edit ? 'Lock layout' : 'Unlock layout for drag/resize'}>
            <IconButton
              onClick={() => setEdit((e) => !e)}
              color={edit ? 'warning' : 'default'}
              aria-label="toggle-edit"
            >
              {edit ? <LockOpenIcon /> : <LockIcon />}
            </IconButton>
          </Tooltip>

          <Tooltip title="View application logs">
            <IconButton
              onClick={() => setLogViewerOpen(true)}
              color="default"
              aria-label="view-logs"
            >
              <BugReportIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Z-Wave Management">
            <IconButton
              onClick={() => window.location.href = '/zwave/admin'}
              color="default"
              aria-label="zwave-admin"
            >
              <SettingsRemoteIcon />
            </IconButton>
          </Tooltip>

          <Typography variant="h5" sx={{ flexGrow: 1 }}>
            {dashboard?.name || 'Dashboard'}
          </Typography>
          {available.length > 0 && (
            <FormControl size="small" variant="outlined" sx={{ minWidth: 200 }}>
              <InputLabel id="dashboard-select-label">Dashboard</InputLabel>
              <Select
                labelId="dashboard-select-label"
                id="dashboard-select"
                label="Dashboard"
                value={new URLSearchParams(window.location.search).get('dashboard') || 'sample'}
                onChange={(e) => {
                  const qs = new URLSearchParams(window.location.search);
                  qs.set('dashboard', e.target.value);
                  window.location.search = qs.toString();
                }}
              >
                {available.map((dashName) => (
                  <MenuItem key={dashName} value={dashName}>
                    {dashName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
        {error && <Typography color="error">{error}</Typography>}
        {dashboard && layout && (
          <DashboardSettingsContext.Provider value={dashboard.settings || {}}>
            <DashboardThemeContext.Provider value={dashboard.theme || {}}>
              <DashboardGrid
              columns={gridSpec.columns}
              gap={gridSpec.gap}
              rowHeight={gridSpec.rowHeight}
            >
              {layout.map((panel, idx) => {
                const persistPanelProps = (widgetIndex: number, updater: any) => {
                  setLayout((prev) => {
                    if (!prev) return prev;
                    const newLayout = prev.map((p, i) => {
                      if (i !== idx) return p;

                      // Handle single panel
                      if (p.panelType === 'single') {
                        const oldProps = p.widget.props || {};
                        const nextProps =
                          typeof updater === 'function'
                            ? updater(oldProps)
                            : { ...oldProps, ...updater };
                        return { ...p, widget: { ...p.widget, props: nextProps } };
                      }

                      // Handle tabbed panel
                      if (p.panelType === 'tabbed') {
                        const newWidgets = p.widgets.map((w, wIdx) => {
                          if (wIdx !== widgetIndex) return w;
                          const oldProps = w.props || {};
                          const nextProps =
                            typeof updater === 'function'
                              ? updater(oldProps)
                              : { ...oldProps, ...updater };
                          return { ...w, props: nextProps };
                        });
                        return { ...p, widgets: newWidgets };
                      }

                      return p;
                    });
                    persistLayout(newLayout);
                    return newLayout;
                  });
                };

                return (
                  <PanelRenderer
                    key={idx}
                    panel={panel}
                    editMode={edit}
                    onChange={(np) =>
                      setLayout((prev) => (prev ? prev.map((it, i) => (i === idx ? np : it)) : prev))
                    }
                    onDragEnd={(np) => {
                      setLayout((prev) => {
                        if (!prev) return prev;
                        const newLayout = prev.map((it, i) => (i === idx ? np : it));
                        persistLayout(newLayout);
                        return newLayout;
                      });
                    }}
                    onChangePropsPersist={persistPanelProps}
                  />
                );
              })}
              </DashboardGrid>
              {edit && <SaveLayoutBar name={name} widgets={layout} />}
            </DashboardThemeContext.Provider>
          </DashboardSettingsContext.Provider>
        )}
      </Container>

      {/* Log Viewer Dialog */}
      <LogViewerDialog open={logViewerOpen} onClose={() => setLogViewerOpen(false)} />
    </ThemeProvider>
  );
}
