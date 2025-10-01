import React, { useMemo, useState } from 'react';
import { Box, Button, Snackbar, Alert } from '@mui/material';
import type { WidgetConfig } from '@types/dashboard';

export interface SaveLayoutBarProps {
  name: string;
  widgets: WidgetConfig[];
}

export default function SaveLayoutBar({ name, widgets }: SaveLayoutBarProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(
    () => Array.isArray(widgets) && widgets.length > 0 && name,
    [widgets, name]
  );

  async function save() {
    setError(null);
    try {
      const isDev = window.location.port === '5173';
      const apiBase = isDev ? 'http://localhost:4000' : '';
      const res = await fetch(`${apiBase}/api/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, widgets }),
      });

      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 200) || 'Invalid JSON response');
      }

      if (!res.ok) {
        throw new Error(json.error || 'Failed to save');
      }

      setOpen(true);

      // Switch URL to the new layout
      const qs = new URLSearchParams(window.location.search);
      qs.set('dashboard', json.newName);
      window.history.replaceState(null, '', `?${qs.toString()}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
      <Button size="small" variant="contained" onClick={save} disabled={!canSave}>
        Save layout
      </Button>
      <Snackbar open={open} autoHideDuration={2000} onClose={() => setOpen(false)}>
        <Alert severity="success" sx={{ width: '100%' }}>
          Layout saved
        </Alert>
      </Snackbar>
      <Snackbar open={!!error} autoHideDuration={3000} onClose={() => setError(null)}>
        <Alert severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
