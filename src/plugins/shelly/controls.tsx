// ABOUTME: Provides high-level controller controls and layout automation for Shelly widgets.
// ABOUTME: Offers quick links, device counts, and a button to add dashboard widgets.

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';
import AddToPhotosIcon from '@mui/icons-material/AddToPhotos';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { PluginWidgetProps } from '../../types/plugin';
import type { ShellyWidgetConfig, ShellyWidgetData } from './data';
import {
  formatDuration,
  getCurrentDashboardName,
  useShellyData,
} from './shared';

async function ensureShellyLayout(dashboard: string) {
  const response = await fetch('/api/shelly/layout/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dashboard }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  if (payload?.error) {
    const message = typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error);
    throw new Error(message);
  }

  return payload;
}

export default function ShellyControlsWidget(
  props: PluginWidgetProps<ShellyWidgetConfig, ShellyWidgetData>
) {
  const { config, refreshSeconds, refreshSignal, data: initialData, error: initialError } = props;
  const { data, loading, error, setError, reload } = useShellyData({
    widgetType: 'shelly-controls',
    config,
    refreshSeconds,
    refreshSignal,
    initialData: initialData ?? null,
    initialError: initialError ?? null,
  });
  const [layoutMessage, setLayoutMessage] = useState<string | null>(null);
  const [layoutPending, setLayoutPending] = useState(false);

  const controller = data?.controller ?? null;

  const stats = useMemo(() => ({
    thermostats: data?.thermostats.length ?? 0,
    scripts: data?.scripts.length ?? 0,
    actions: data?.actions.length ?? 0,
    schedules: data?.schedules.length ?? 0,
  }), [data]);

  const handleOpenUi = useCallback(() => {
    if (!data?.controllerUrl) return;
    window.open(data.controllerUrl, '_blank', 'noopener,noreferrer');
  }, [data?.controllerUrl]);

  const handleAddWidgets = useCallback(async () => {
    setLayoutMessage(null);
    setLayoutPending(true);

    try {
      const dashboard = getCurrentDashboardName();
      const payload = await ensureShellyLayout(dashboard);
      const added = Number(payload?.added ?? 0);
      setLayoutMessage(
        added > 0
          ? `Added ${added} Shelly panel${added === 1 ? '' : 's'} to the ${dashboard} dashboard`
          : `Shelly panels already present on the ${dashboard} dashboard`
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update dashboard layout';
      setError(message);
    } finally {
      setLayoutPending(false);
      await reload();
    }
  }, [reload, setError]);

  if (loading && !data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={160}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data) {
    return <Alert severity="info">No data from Shelly controller yet</Alert>;
  }

  return (
    <Stack spacing={2}>
      {data.authError && (
        <Alert severity="error">{data.authError}</Alert>
      )}
      {controller && (
        <Stack spacing={0.5}>
          <Typography variant="h6">{controller.name ?? 'Shelly Controller'}</Typography>
          <Typography variant="body2" color="text.secondary">
            Model {controller.model ?? 'unknown'} • Firmware {controller.firmware ?? 'unknown'}
          </Typography>
          {controller.uptimeSeconds !== undefined && (
            <Typography variant="body2" color="text.secondary">
              Uptime {formatDuration(controller.uptimeSeconds)}
            </Typography>
          )}
        </Stack>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Chip label={`${stats.thermostats} thermostat${stats.thermostats === 1 ? '' : 's'}`} />
        <Chip label={`${stats.scripts} script${stats.scripts === 1 ? '' : 's'}`} />
        <Chip label={`${stats.actions} action${stats.actions === 1 ? '' : 's'}`} />
        <Chip label={`${stats.schedules} schedule${stats.schedules === 1 ? '' : 's'}`} />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<LaunchIcon />}
          onClick={handleOpenUi}
          disabled={!data.controllerUrl}
        >
          Open Shelly UI
        </Button>
        <Button
          variant="outlined"
          startIcon={<AddToPhotosIcon />}
          onClick={handleAddWidgets}
          disabled={layoutPending}
        >
          Add Shelly Widgets
        </Button>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={reload}
        >
          Refresh Data
        </Button>
      </Stack>

      {layoutMessage && <Alert severity="success">{layoutMessage}</Alert>}
    </Stack>
  );
}
