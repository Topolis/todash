import React, { useEffect, useMemo, useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Container, Box, Typography, FormControl, InputLabel, Select, MenuItem, IconButton, Tooltip } from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import DashboardGrid from './components/DashboardGrid.jsx';
import { WidgetRenderer, DashboardSettingsContext } from './plugins/index.jsx';
import SaveLayoutBar from './components/SaveLayoutBar.jsx';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#90caf9' },
    background: { default: '#0b0f19', paper: '#0e1422' },
  },
  shape: { borderRadius: 12 },
});

export default function App() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);
  const [available, setAvailable] = useState([]);
  const [edit, setEdit] = useState(false);
  const [layout, setLayout] = useState(null);
  const [name, setName] = useState('sample');

  useEffect(() => {
    // Load available dashboards and then the selected one
    fetch('/api/dashboards').then(r => r.json()).then(({ dashboards }) => setAvailable(dashboards || []));

    const params = new URLSearchParams(window.location.search);
    const n = params.get('dashboard') || 'sample';
    setName(n);
    fetch(`/api/dashboards/${encodeURIComponent(n)}`)
      .then(r => r.json())
      .then((cfg) => { setDashboard(cfg); setLayout(cfg.widgets || []); })
      .catch(e => setError(e.message));
  }, []);

  const gridSpec = useMemo(() => dashboard?.grid || { columns: 12, gap: 12, rowHeight: 120 }, [dashboard]);

  async function persistLayout(newLayout) {
    try {
      const isDev = window.location.port === '5173';
      const apiBase = isDev ? 'http://localhost:4000' : '';
      const res = await fetch(`${apiBase}/api/layout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, widgets: newLayout }) });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { throw new Error(text.slice(0, 200) || 'Invalid JSON response'); }
      if (!res.ok) {
        console.warn('Persist layout failed:', json?.error || text);
      } else if (json?.newName && json.newName !== name) {
        // Only auto-switch when coming from 'sample' to 'sample.local'; otherwise stay on the chosen file
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

      <Container maxWidth="xl" sx={{ py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
          <Tooltip title={edit ? 'Lock layout' : 'Unlock layout for drag/resize'}>
            <IconButton onClick={() => setEdit(e => !e)} color={edit ? 'warning' : 'default'} aria-label="toggle-edit">
              {edit ? <LockOpenIcon /> : <LockIcon />}
            </IconButton>
          </Tooltip>
          <Typography variant="h5" sx={{ flexGrow: 1 }}>{dashboard?.title || 'Dashboard'}</Typography>
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
                {available.map((name) => (
                  <MenuItem key={name} value={name}>{name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
        {error && <Typography color="error">{error}</Typography>}
        {dashboard && layout && (
          <DashboardSettingsContext.Provider value={dashboard.settings || {}}>
            <DashboardGrid columns={gridSpec.columns} gap={gridSpec.gap} rowHeight={gridSpec.rowHeight}>
              {layout.map((w, idx) => {
                const persistWidgetProps = (updater) => {
                  setLayout(prev => {
                    const newLayout = prev.map((it, i) => {
                      if (i !== idx) return it;
                      const oldProps = it.props || {};
                      const nextProps = typeof updater === 'function' ? updater(oldProps) : { ...oldProps, ...updater };
                      return { ...it, props: nextProps };
                    });
                    persistLayout(newLayout);
                    return newLayout;
                  });
                };
                return (
                  <WidgetRenderer
                    key={idx}
                    widget={w}
                    editMode={edit}
                    onChange={(nw) => setLayout(prev => prev.map((it, i) => i === idx ? nw : it))}
                    onDragEnd={(nw) => {
                      setLayout(prev => {
                        const newLayout = prev.map((it, i) => i === idx ? nw : it);
                        persistLayout(newLayout);
                        return newLayout;
                      });
                    }}
                    onChangePropsPersist={persistWidgetProps}
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

