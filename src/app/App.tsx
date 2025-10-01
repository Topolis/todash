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
import DashboardGrid from './components/DashboardGrid';
import PanelRenderer from './components/PanelRenderer';
import SaveLayoutBar from './components/SaveLayoutBar';
import { DashboardSettingsContext } from './components/DashboardSettingsContext';
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

  useEffect(() => {
    // Load available dashboards and then the selected one
    fetch('/api/dashboards')
      .then((r) => r.json())
      .then(({ dashboards }) => setAvailable(dashboards || []));

    const params = new URLSearchParams(window.location.search);
    const n = params.get('dashboard') || 'sample';
    setName(n);
    fetch(`/api/dashboards/${encodeURIComponent(n)}`)
      .then((r) => r.json())
      .then((cfg) => {
        setDashboard(cfg.config);
        setLayout(cfg.config.panels || []);
      })
      .catch((e) => setError((e as Error).message));
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

        /* Animated dark nebula background */
        .nebula-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
        .nebula-bg {
          background:
            radial-gradient(1000px 700px at 10% 20%, rgba(64, 91, 155, 0.25), transparent 60%),
            radial-gradient(900px 650px at 85% 15%, rgba(113, 63, 136, 0.22), transparent 60%),
            radial-gradient(900px 650px at 60% 85%, rgba(38, 90, 102, 0.22), transparent 60%),
            radial-gradient(800px 600px at 20% 85%, rgba(128, 96, 56, 0.14), transparent 60%),
            radial-gradient(1400px 1000px at 50% 50%, rgba(11, 15, 25, 0.60), rgba(11, 15, 25, 0.60));
          filter: saturate(1.1) contrast(1.05);
          animation: nebulaMove 40s ease-in-out infinite alternate;
          will-change: background-position;
        }
        @keyframes nebulaMove {
          0%   { background-position: 0% 0%, 100% 0%, 0% 100%, 100% 100%, 50% 50%; }
          50%  { background-position: 20% 10%, 80% 20%, 20% 80%, 10% 70%, 50% 50%; }
          100% { background-position: 100% 100%, 0% 100%, 100% 0%, 0% 0%, 50% 50%; }
        }
      `}</style>

      {/* animated nebula background layer */}
      <Box className="nebula-bg" />

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
          </DashboardSettingsContext.Provider>
        )}
      </Container>
    </ThemeProvider>
  );
}
