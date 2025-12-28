// ABOUTME: Displays Shelly script state with quick enable/disable/run controls.
// ABOUTME: Uses shared RPC helpers to operate controller-side scripts.

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import BoltIcon from '@mui/icons-material/Bolt';
import type { PluginWidgetProps } from '../../types/plugin';
import type { ShellyWidgetConfig, ShellyWidgetData } from './data';
import { callShellyRpc, formatDuration, useShellyData } from './shared';

export default function ShellyScriptsWidget(
  props: PluginWidgetProps<ShellyWidgetConfig, ShellyWidgetData>
) {
  const { config, refreshSeconds, refreshSignal, data: initialData, error: initialError } = props;
  const { data, loading, error, setError, reload } = useShellyData({
    widgetType: 'shelly-scripts',
    config,
    refreshSeconds,
    refreshSignal,
    initialData: initialData ?? null,
    initialError: initialError ?? null,
  });
  const [pendingOps, setPendingOps] = useState<Set<string>>(new Set());

  const markPending = useCallback((key: string, isPending: boolean) => {
    setPendingOps(prev => {
      const next = new Set(prev);
      if (isPending) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const scripts = useMemo(() => data?.scripts ?? [], [data]);

  const handleScriptAction = useCallback(
    async (id: number, action: 'start' | 'stop' | 'enable' | 'disable') => {
      const key = `script:${action}:${id}`;
      const methodMap: Record<typeof action, string> = {
        start: 'Script.Start',
        stop: 'Script.Stop',
        enable: 'Script.Enable',
        disable: 'Script.Disable',
      };

      markPending(key, true);
      try {
        await callShellyRpc(methodMap[action], { id });
        await reload();
      } catch (e) {
        const message = e instanceof Error ? e.message : `Failed to ${action} script`;
        setError(message);
      } finally {
        markPending(key, false);
      }
    },
    [markPending, reload, setError]
  );

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

  if (data.authError) {
    return <Alert severity="error">{data.authError}</Alert>;
  }

  if (scripts.length === 0) {
    return <Alert severity="info">No scripts found on the Shelly controller</Alert>;
  }

  return (
    <Stack spacing={1.5} divider={<Divider flexItem light />}>
      {scripts.map((script) => {
        const runningKey = `script:start:${script.id}`;
        const stoppingKey = `script:stop:${script.id}`;
        const enablingKey = `script:enable:${script.id}`;
        const disablingKey = `script:disable:${script.id}`;

        return (
          <Box
            key={script.id}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              px: 2,
              py: 1.5,
              backgroundColor: 'rgba(255,255,255,0.03)',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle1">{script.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  ID {script.id} • {script.enabled ? 'enabled' : 'disabled'}{script.running ? ' • running' : ''}
                </Typography>
                {script.lastRunTs && (
                  <Typography variant="body2" color="text.secondary">
                    Last run {formatDuration(Math.floor(Date.now() / 1000) - script.lastRunTs)} ago
                  </Typography>
                )}
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<BoltIcon fontSize="small" />}
                  onClick={() => handleScriptAction(script.id, script.enabled ? 'disable' : 'enable')}
                  disabled={pendingOps.has(script.enabled ? disablingKey : enablingKey)}
                >
                  {script.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  startIcon={<PlayArrowIcon fontSize="small" />}
                  onClick={() => handleScriptAction(script.id, 'start')}
                  disabled={pendingOps.has(runningKey)}
                >
                  Start
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<StopIcon fontSize="small" />}
                  onClick={() => handleScriptAction(script.id, 'stop')}
                  disabled={pendingOps.has(stoppingKey)}
                >
                  Stop
                </Button>
              </Stack>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
