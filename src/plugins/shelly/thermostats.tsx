// ABOUTME: Renders Shelly thermostat controls with RPC-backed interactions.
// ABOUTME: Provides temperature and mode controls for Gen3 thermostats.

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Grid,
  IconButton,
  Stack,
  Typography,
  Chip,
} from '@mui/material';
import { Icon } from '@iconify/react';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import Battery0BarRoundedIcon from '@mui/icons-material/Battery0BarRounded';
import Battery1BarRoundedIcon from '@mui/icons-material/Battery1BarRounded';
import Battery2BarRoundedIcon from '@mui/icons-material/Battery2BarRounded';
import Battery3BarRoundedIcon from '@mui/icons-material/Battery3BarRounded';
import Battery4BarRoundedIcon from '@mui/icons-material/Battery4BarRounded';
import Battery5BarRoundedIcon from '@mui/icons-material/Battery5BarRounded';
import Battery6BarRoundedIcon from '@mui/icons-material/Battery6BarRounded';
import BatteryFullRoundedIcon from '@mui/icons-material/BatteryFullRounded';
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
  const { 
    refreshSeconds, 
    refreshSignal, 
    data: initialData, 
    error: initialError,
    thermostats: configThermostats,
    scriptIds,
    actionIds,
    scheduleIds,
    includeScripts,
    includeActions,
    includeSchedules,
    ...rest
  } = props;
  
  // Build config from props
  const config = useMemo<ShellyWidgetConfig>(() => ({
    thermostats: configThermostats,
    scriptIds,
    actionIds,
    scheduleIds,
    includeScripts,
    includeActions,
    includeSchedules,
  }), [configThermostats, scriptIds, actionIds, scheduleIds, includeScripts, includeActions, includeSchedules]);
  
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

  const getBatteryIcon = useCallback((level?: number) => {
    if (level === undefined) return null;
    if (level === 100) return <BatteryFullRoundedIcon fontSize="small" />;
    if (level >= 90) return <Battery6BarRoundedIcon fontSize="small" />;
    if (level >= 75) return <Battery5BarRoundedIcon fontSize="small" />;
    if (level >= 60) return <Battery4BarRoundedIcon fontSize="small" />;
    if (level >= 40) return <Battery3BarRoundedIcon fontSize="small" />;
    if (level >= 25) return <Battery2BarRoundedIcon fontSize="small" />;
    if (level >= 10) return <Battery1BarRoundedIcon fontSize="small" />;
    return <Battery0BarRoundedIcon fontSize="small" />;
  }, []);

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

  if (thermostats.length === 0) {
    return <Alert severity="info">No thermostats configured</Alert>;
  }

  return (
    <Grid container spacing={2}>
      {thermostats.map((thermo) => {
        const tempKey = `thermo-temp:${thermo.id}`;
        const modes = deriveCandidateModes(thermo);
        const target = thermo.targetTemperature ?? thermo.currentTemperature ?? 20;
        const current = thermo.currentTemperature;

        return (
          <Grid key={thermo.id} size={{ xs: 12, sm: 6, md: 6, lg: 4 }}>
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                pt: 0,
                pb: 2,
                px: 2,
                minHeight: 240,
              }}
            >
            {/* Battery indicator - top right */}
            <Stack
              spacing={0}
              alignItems="flex-end"
              sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                zIndex: 10,
              }}
            >
              {thermo.battery !== undefined && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {getBatteryIcon(thermo.battery)}
                  <Typography variant="caption">
                    {thermo.battery}%
                  </Typography>
                </Stack>
              )}
              {thermo.valvePosition !== undefined && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Icon icon="mdi:pipe-valve" width={14} height={14} style={{ opacity: 0.5 }} />
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'text.disabled',
                      fontSize: '0.7rem',
                    }}
                  >
                    {thermo.valvePosition}%
                  </Typography>
                </Stack>
              )}
            </Stack>

            {/* Circular temperature display */}
            <Box
              sx={{
                position: 'relative',
                width: 240,
                height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mt: -4.5,
              }}
            >
              {/* SVG for arc */}
              <svg
                width="240"
                height="200"
                viewBox="0 0 240 200"
                style={{ position: 'absolute' }}
              >
                {/* Background arc (2/3 circle = 240 degrees) */}
                <path
                  d="M 33 165 A 90 90 0 1 1 207 165"
                  fill="none"
                  stroke="rgba(100, 150, 220, 0.2)"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Progress arc (based on target temperature) */}
                <path
                  d="M 33 165 A 90 90 0 1 1 207 165"
                  fill="none"
                  stroke="url(#tempGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${((target - 10) / 20) * 377} 377`}
                  style={{ transition: 'stroke-dasharray 0.3s ease' }}
                />
                {/* Gradient definition */}
                <defs>
                  <linearGradient id="tempGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(80, 180, 220, 1)" />
                    <stop offset="50%" stopColor="rgba(150, 100, 200, 1)" />
                    <stop offset="100%" stopColor="rgba(220, 100, 150, 1)" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Minus button at left end of arc */}
              <IconButton
                onClick={() => handleTemperatureChange(thermo, -0.5)}
                disabled={isPending(tempKey)}
                sx={{
                  position: 'absolute',
                  left: 20,
                  bottom: -20,
                  width: 48,
                  height: 48,
                  border: '2px solid',
                  borderColor: 'divider',
                  backgroundColor: 'background.paper',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    borderColor: 'primary.main',
                  },
                }}
              >
                <RemoveIcon />
              </IconButton>

              {/* Plus button at right end of arc */}
              <IconButton
                onClick={() => handleTemperatureChange(thermo, 0.5)}
                disabled={isPending(tempKey)}
                sx={{
                  position: 'absolute',
                  right: 20,
                  bottom: -20,
                  width: 48,
                  height: 48,
                  border: '2px solid',
                  borderColor: 'divider',
                  backgroundColor: 'background.paper',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    borderColor: 'primary.main',
                  },
                }}
              >
                <AddIcon />
              </IconButton>

              {/* Center content */}
              <Stack alignItems="center" spacing={0} sx={{ zIndex: 1, mt: 12, mb: 1 }}>
                {/* Current temperature */}
                {current !== undefined && (
                  <Typography
                    variant="h2"
                    sx={{
                      fontWeight: 300,
                      fontSize: '3.5rem',
                      lineHeight: 1,
                    }}
                  >
                    {current.toFixed(1)}°
                  </Typography>
                )}

                {/* Target temperature */}
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography
                    variant="h6"
                    sx={{
                      color: 'text.secondary',
                      fontWeight: 400,
                      fontSize: '1.1rem',
                    }}
                  >
                    {target.toFixed(1)}°
                  </Typography>
                  {isPending(tempKey) && (
                    <CircularProgress size={12} thickness={6} sx={{ color: 'text.secondary' }} />
                  )}
                </Stack>

                {/* Thermostat label */}
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '0.75rem',
                    mt: 0.5,
                  }}
                >
                  {thermo.label ?? thermo.id}
                </Typography>
              </Stack>
            </Box>

            {/* Additional info at bottom */}
            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              {thermo.status && thermo.status !== 'ok' && (
                <Typography variant="caption" color="text.secondary">
                  {thermo.status}
                </Typography>
              )}
              {thermo.mode && (
                <Typography variant="caption" color="text.secondary">
                  {thermo.mode}
                </Typography>
              )}
              {thermo.valvePosition !== undefined && (
                <Typography variant="caption" color="text.secondary">
                  Valve: {thermo.valvePosition}%
                </Typography>
              )}
            </Stack>

            {/* Mode chips */}
            {modes.length > 0 && (
              <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" justifyContent="center">
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
            )}
            </Box>
          </Grid>
        );
      })}
    </Grid>
  );
}
