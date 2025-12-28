// ABOUTME: Lists Shelly actions with quick execution controls.
// ABOUTME: Runs Actions.Run RPC calls and reports status to the user.

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
import type { PluginWidgetProps } from '../../types/plugin';
import type { ShellyWidgetConfig, ShellyWidgetData } from './data';
import { callShellyRpc, useShellyData } from './shared';

export default function ShellyActionsWidget(
  props: PluginWidgetProps<ShellyWidgetConfig, ShellyWidgetData>
) {
  const { config, refreshSeconds, refreshSignal, data: initialData, error: initialError } = props;
  const { data, loading, error, setError, reload } = useShellyData({
    widgetType: 'shelly-actions',
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

  const actions = useMemo(() => data?.actions ?? [], [data]);

  const handleRunAction = useCallback(
    async (id: string) => {
      const key = `action:run:${id}`;
      markPending(key, true);

      try {
        await callShellyRpc('Actions.Run', { id });
        await reload();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to run action';
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

  if (actions.length === 0) {
    return <Alert severity="info">No actions available on the Shelly controller</Alert>;
  }

  return (
    <Stack spacing={1.5} divider={<Divider flexItem light />}>
      {actions.map((action) => {
        const key = `action:run:${action.id}`;
        return (
          <Box
            key={action.id}
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
                <Typography variant="subtitle1">{action.name ?? action.id}</Typography>
                <Typography variant="body2" color="text.secondary">
                  ID {action.id}{action.group ? ` • ${action.group}` : ''}
                </Typography>
              </Stack>

              <Button
                size="small"
                variant="outlined"
                startIcon={<PlayArrowIcon fontSize="small" />}
                onClick={() => handleRunAction(action.id)}
                disabled={pendingOps.has(key)}
              >
                Run
              </Button>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
