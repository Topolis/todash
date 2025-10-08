import React, { useEffect, useState } from 'react';
import { Stack, Typography, CircularProgress, Alert, Box, IconButton } from '@mui/material';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import Battery0BarRoundedIcon from '@mui/icons-material/Battery0BarRounded';
import Battery1BarRoundedIcon from '@mui/icons-material/Battery1BarRounded';
import Battery2BarRoundedIcon from '@mui/icons-material/Battery2BarRounded';
import Battery3BarRoundedIcon from '@mui/icons-material/Battery3BarRounded';
import Battery4BarRoundedIcon from '@mui/icons-material/Battery4BarRounded';
import Battery5BarRoundedIcon from '@mui/icons-material/Battery5BarRounded';
import Battery6BarRoundedIcon from '@mui/icons-material/Battery6BarRounded';
import BatteryFullRoundedIcon from '@mui/icons-material/BatteryFullRounded';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import { retryingJson } from '@app/lib/retryFetch';
import type { PluginWidgetProps } from '@types/plugin';
import type { ZWaveThermostatConfig, ZWaveThermostatData } from './data';

export default function ZWaveThermostatWidget(props: PluginWidgetProps<ZWaveThermostatConfig, ZWaveThermostatData>) {
  const { refreshSeconds = 10, refreshSignal, nodeId } = props;

  const [data, setData] = useState<ZWaveThermostatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingNode, setUpdatingNode] = useState<number | null>(null);
  const [boostingNode, setBoostingNode] = useState<number | null>(null);
  const [, setTick] = useState(0); // Force re-render every second for time ago
  const [pendingChanges, setPendingChanges] = useState<Map<number, { temp: number, timeout: NodeJS.Timeout }>>(new Map());

  useEffect(() => {
    let active = true;

    const load = () => {
      retryingJson<{ data: ZWaveThermostatData }>(
        '/api/widget/zwave-thermostat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId, refreshSeconds }),
        },
        { retries: 2, backoffMs: 500 }
      )
        .then(({ data }) => {
          if (active) {
            setData(data);
            setError(null);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (active) {
            setError(String(e));
            setLoading(false);
          }
        });
    };

    load();
    const seconds = Math.max(5, Number(refreshSeconds) || 10);
    const id = setInterval(load, seconds * 1000);

    // Listen for driver ready and value update events
    const eventSource = new EventSource('/api/zwave/admin/events');
    eventSource.onmessage = (event) => {
      try {
        const eventData = JSON.parse(event.data);
        if (eventData.type === 'driver-ready' && active) {
          console.log('[Z-Wave Thermostat] Driver ready - reloading data');
          load();
        } else if (eventData.type === 'value-updated' && active) {
          // Reload if this is our node
          if (eventData.nodeId === nodeId) {
            console.log(`[Z-Wave Thermostat] Node ${nodeId} value updated - reloading data`);
            load();
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    return () => {
      active = false;
      clearInterval(id);
      eventSource.close();
    };
  }, [refreshSeconds, refreshSignal, nodeId]);

  // Update display every second to refresh "time ago"
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Cleanup pending timeouts on unmount
  useEffect(() => {
    return () => {
      pendingChanges.forEach(({ timeout }) => clearTimeout(timeout));
    };
  }, [pendingChanges]);

  // Helper to calculate time ago from timestamp
  const getTimeAgo = (lastSeenMs?: number): string => {
    if (!lastSeenMs || isNaN(lastSeenMs)) return 'never';

    const now = Date.now();
    const diffMs = now - lastSeenMs;

    // Check for invalid values
    if (isNaN(diffMs) || diffMs < 0) return 'never';

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 10) {
      return 'just now';
    } else if (diffSec < 60) {
      return `${diffSec} sec ago`;
    } else if (diffMin < 60) {
      return `${diffMin} min ago`;
    } else if (diffHour < 24) {
      return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    } else {
      return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    }
  };

  const handleTemperatureChange = (nodeId: number, delta: number) => {
    if (!data) return;

    const device = data.devices.find(d => d.nodeId === nodeId);
    if (!device || device.targetTemperature === undefined) return;

    const newTemp = device.targetTemperature + delta;

    // Update local state immediately (optimistic update)
    setData({
      ...data,
      devices: data.devices.map(d =>
        d.nodeId === nodeId ? { ...d, targetTemperature: newTemp } : d
      ),
    });

    // Clear any existing timeout for this node
    const existing = pendingChanges.get(nodeId);
    if (existing) {
      clearTimeout(existing.timeout);
    }

    // Set new timeout to send change after 2 seconds
    const timeout = setTimeout(async () => {
      // Show loading indicator only when actually sending
      setUpdatingNode(nodeId);

      console.log(`[Z-Wave Thermostat] Starting to set node ${nodeId} to ${newTemp}°C...`);

      try {
        const response = await fetch('/api/zwave/thermostat/temperature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId, temperature: newTemp }),
        });

        if (!response.ok) {
          throw new Error('Failed to set temperature');
        }

        console.log(`[Z-Wave Thermostat] Successfully set node ${nodeId} to ${newTemp}°C`);
      } catch (e) {
        console.error(`[Z-Wave Thermostat] Failed to set node ${nodeId} temperature:`, e);
        setError(`Failed to set temperature: ${e}`);
        // Revert on error - will be corrected on next refresh
      } finally {
        setUpdatingNode(null);
        setPendingChanges(prev => {
          const next = new Map(prev);
          next.delete(nodeId);
          return next;
        });
      }
    }, 2000);

    // Store the pending change
    setPendingChanges(prev => {
      const next = new Map(prev);
      next.set(nodeId, { temp: newTemp, timeout });
      return next;
    });
  };

  const handleBoost = async (nodeId: number) => {
    if (!data) return;

    const device = data.devices.find(d => d.nodeId === nodeId);
    if (!device || device.targetTemperature === undefined) return;

    const boostTemp = device.targetTemperature + 5; // +5°C boost
    const originalTemp = device.targetTemperature;

    setBoostingNode(nodeId);
    console.log(`[Z-Wave Thermostat] Starting boost for node ${nodeId}: ${originalTemp}°C → ${boostTemp}°C for 30 minutes`);

    try {
      // Set boost temperature
      const response = await fetch('/api/zwave/thermostat/temperature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, temperature: boostTemp }),
      });

      if (!response.ok) {
        throw new Error('Failed to set boost temperature');
      }

      console.log(`[Z-Wave Thermostat] Boost activated for node ${nodeId}`);

      // Schedule revert after 30 minutes
      setTimeout(async () => {
        console.log(`[Z-Wave Thermostat] Reverting boost for node ${nodeId}: ${boostTemp}°C → ${originalTemp}°C`);

        try {
          const revertResponse = await fetch('/api/zwave/thermostat/temperature', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodeId, temperature: originalTemp }),
          });

          if (revertResponse.ok) {
            console.log(`[Z-Wave Thermostat] Boost ended for node ${nodeId}`);
          }
        } catch (e) {
          console.error(`[Z-Wave Thermostat] Failed to revert boost for node ${nodeId}:`, e);
        } finally {
          setBoostingNode(null);
        }
      }, 30 * 60 * 1000); // 30 minutes

    } catch (e) {
      console.error(`[Z-Wave Thermostat] Failed to activate boost for node ${nodeId}:`, e);
      setError(`Failed to activate boost: ${e}`);
      setBoostingNode(null);
    }
  };

  const getBatteryIcon = (level?: number) => {
    if (level === undefined) return null;
    if (level === 100) return <BatteryFullRoundedIcon fontSize="small" />;
    if (level >= 90) return <Battery6BarRoundedIcon fontSize="small" />;
    if (level >= 75) return <Battery5BarRoundedIcon fontSize="small" />;
    if (level >= 60) return <Battery4BarRoundedIcon fontSize="small" />;
    if (level >= 40) return <Battery3BarRoundedIcon fontSize="small" />;
    if (level >= 25) return <Battery2BarRoundedIcon fontSize="small" />;
    if (level >= 10) return <Battery1BarRoundedIcon fontSize="small" />;
    return <Battery0BarRoundedIcon fontSize="small" />;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={100}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data || data.devices.length === 0) {
    return <Alert severity="info">No Z-Wave thermostats found</Alert>;
  }

  return (
    <Stack spacing={2}>
      {data.devices.map((device) => (
        <Box
          key={device.nodeId}
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
          {/* Battery indicator - top left */}
          {device.batteryLevel !== undefined && (
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                zIndex: 10,
              }}
            >
              {getBatteryIcon(device.batteryLevel)}
              <Typography variant="caption">
                {device.batteryLevel}%
              </Typography>
            </Stack>
          )}

          {/* Circular temperature display with buttons at arc ends */}
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
              {/* Arc from 150° to 30° (240° total), centered at (120, 120) */}
              <path
                d="M 33 165 A 90 90 0 1 1 207 165"
                fill="none"
                stroke="rgba(100, 150, 220, 0.2)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              {/* Progress arc (based on temperature) */}
              {device.targetTemperature !== undefined && (
                <path
                  d="M 33 165 A 90 90 0 1 1 207 165"
                  fill="none"
                  stroke="url(#tempGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${((device.targetTemperature - 10) / 20) * 377} 377`}
                  style={{ transition: 'stroke-dasharray 0.3s ease' }}
                />
              )}
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
            {device.targetTemperature !== undefined && (
              <IconButton
                onClick={() => handleTemperatureChange(device.nodeId, -0.5)}
                disabled={updatingNode === device.nodeId}
                sx={{
                  position: 'absolute',
                  left: 4,
                  bottom: -30,
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
            )}

            {/* Plus button at right end of arc */}
            {device.targetTemperature !== undefined && (
              <IconButton
                onClick={() => handleTemperatureChange(device.nodeId, 0.5)}
                disabled={updatingNode === device.nodeId}
                sx={{
                  position: 'absolute',
                  right: 4,
                  bottom: -30,
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
            )}

            {/* Boost button at bottom center */}
            {device.targetTemperature !== undefined && (
              <IconButton
                onClick={() => handleBoost(device.nodeId)}
                disabled={updatingNode === device.nodeId || boostingNode === device.nodeId}
                sx={{
                  position: 'absolute',
                  left: '50%',
                  bottom: -35,
                  transform: 'translateX(-50%)',
                  width: 56,
                  height: 56,
                  border: '2px solid',
                  borderColor: boostingNode === device.nodeId ? 'warning.main' : 'divider',
                  backgroundColor: boostingNode === device.nodeId ? 'rgba(255, 152, 0, 0.1)' : 'background.paper',
                  '&:hover': {
                    backgroundColor: boostingNode === device.nodeId ? 'rgba(255, 152, 0, 0.2)' : 'action.hover',
                    borderColor: 'warning.main',
                  },
                }}
              >
                <WhatshotIcon sx={{ color: boostingNode === device.nodeId ? 'warning.main' : 'inherit' }} />
              </IconButton>
            )}

            {/* Center content */}
            <Stack alignItems="center" spacing={0} sx={{ zIndex: 1, mt: 12, mb: 1 }}>
              {/* Current temperature */}
              {device.currentTemperature !== undefined && (
                <Typography
                  variant="h2"
                  sx={{
                    fontWeight: 300,
                    fontSize: '3.5rem',
                    lineHeight: 1,
                  }}
                >
                  {device.currentTemperature.toFixed(1)}°
                </Typography>
              )}

              {/* Target temperature with loading indicator */}
              {device.targetTemperature !== undefined && (
                <Stack direction="row" alignItems="center" spacing={0}>
                  <Typography
                    variant="h6"
                    sx={{
                      color: 'text.secondary',
                      fontWeight: 400,
                      fontSize: '1.1rem',
                    }}
                  >
                    {device.targetTemperature.toFixed(1)}°
                  </Typography>
                  {updatingNode === device.nodeId && (
                    <CircularProgress size={12} thickness={6} sx={{ color: 'text.secondary' }} />
                  )}
                </Stack>
              )}

              {/* Last update time */}
              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(255, 255, 255, 0.15)',
                  fontSize: '0.65rem',
                }}
              >
                {getTimeAgo(device.lastSeen)}
              </Typography>
            </Stack>
          </Box>

          {/* Additional info at bottom */}
          {(device.mode || device.operatingState || device.humidity !== undefined) && (
            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              {device.operatingState && (
                <Typography variant="caption" color="text.secondary">
                  {device.operatingState}
                </Typography>
              )}
              {device.humidity !== undefined && (
                <Typography variant="caption" color="text.secondary">
                  {device.humidity}%
                </Typography>
              )}
            </Stack>
          )}
        </Box>
      ))}
    </Stack>
  );
}

