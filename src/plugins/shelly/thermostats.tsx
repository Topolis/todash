// ABOUTME: Renders Shelly thermostat controls with RPC-backed interactions.
// ABOUTME: Provides temperature and mode controls for Gen3 thermostats.

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  Chip,
} from '@mui/material';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import type { PluginWidgetProps } from '../../types/plugin';
import type { ShellyWidgetConfig, ShellyWidgetData, ShellyThermostatState } from './data';
import {
  callShellyRpc,
  clampTemperature,
  deriveCandidateModes,
  formatTemperature,
  useShellyData,
} from './shared';

export default function ShellyThermostatsWidget(
  props: PluginWidgetProps<ShellyWidgetConfig, ShellyWidgetData>
) {
  const { config, refreshSeconds, refreshSignal, data: initialData, error: initialError } = props;
  const { data, loading, error, setError, reload } = useShellyData({
    widgetType: 'shelly-thermostats',
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

  const isPending = useCallback(
    (key: string) => pendingOps.has(key),
    [pendingOps]
  );

  const thermostats = useMemo(() => data?.thermostats ?? [], [data]);

  const handleTemperatureChange = useCallback(
    async (thermo: ShellyThermostatState, delta: number) => {
      const base = thermo.targetTemperature ?? thermo.currentTemperature ?? 21;
      const nextTemp = clampTemperature(base + delta);
      const key = `thermo-temp:${thermo.id}`;

      markPending(key, true);
      try {
        await callShellyRpc('Thermostat.SetTargetTemperature', {
          id: thermo.id,
          target_t: nextTemp,
        });
        await reload();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to adjust temperature';
        setError(message);
      } finally {
        markPending(key, false);
      }
    },
    [markPending, reload, setError]
  );

  const handleModeChange = useCallback(
    async (thermo: ShellyThermostatState, mode: string) => {
      const key = `thermo-mode:${thermo.id}:${mode}`;
      markPending(key, true);

      const trimmed = mode.trim().toLowerCase();
      const isProfile = trimmed === 'manual' || trimmed === 'schedule';
      const method = isProfile ? 'Thermostat.SetProfile' : 'Thermostat.SetMode';
      const params = isProfile ? { id: thermo.id, profile: trimmed } : { id: thermo.id, mode: trimmed };

      try {
        await callShellyRpc(method, params);
        await reload();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to change mode';
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

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <ThermostatIcon color="primary" />
        <Typography variant="h6">Thermostats</Typography>
      </Stack>

      {thermostats.length === 0 && <Alert severity="info">No thermostats configured</Alert>}

      <Stack spacing={1.5} divider={<Divider flexItem light />}>
        {thermostats.map((thermo) => {
          const tempKey = `thermo-temp:${thermo.id}`;
          const modes = deriveCandidateModes(thermo);

          return (
            <Box
              key={thermo.id}
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
                  <Typography variant="subtitle1">{thermo.label ?? thermo.id}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {thermo.status ?? 'unknown'}{thermo.mode ? ` • ${thermo.mode}` : ''}
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                  <Tooltip title="Decrease target">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleTemperatureChange(thermo, -0.5)}
                        disabled={isPending(tempKey)}
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>

                  <Typography variant="h5" sx={{ minWidth: 88, textAlign: 'center' }}>
                    {formatTemperature(thermo.targetTemperature ?? thermo.currentTemperature)}
                  </Typography>

                  <Tooltip title="Increase target">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleTemperatureChange(thermo, 0.5)}
                        disabled={isPending(tempKey)}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={3} mt={1} flexWrap="wrap">
                <Typography variant="body2" color="text.secondary">
                  Current: <strong>{formatTemperature(thermo.currentTemperature)}</strong>
                </Typography>
                {thermo.battery !== undefined && (
                  <Typography variant="body2" color="text.secondary">
                    Battery: {thermo.battery}%
                  </Typography>
                )}
                {thermo.valvePosition !== undefined && (
                  <Typography variant="body2" color="text.secondary">
                    Valve: {thermo.valvePosition}%
                  </Typography>
                )}
              </Stack>

              <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                {modes.map((mode) => {
                  const key = `thermo-mode:${thermo.id}:${mode}`;
                  const active = thermo.mode?.toLowerCase() === mode.toLowerCase();
                  return (
                    <Chip
                      key={key}
                      label={mode}
                      color={active ? 'primary' : 'default'}
                      variant={active ? 'filled' : 'outlined'}
                      onClick={() => handleModeChange(thermo, mode)}
                      disabled={isPending(key)}
                      size="small"
                    />
                  );
                })}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}
