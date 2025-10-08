import React, { useEffect, useState } from 'react';
import { Stack, Typography, CircularProgress, Alert, Box, Switch, Slider } from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import PowerIcon from '@mui/icons-material/Power';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import Battery60Icon from '@mui/icons-material/Battery60';
import Battery20Icon from '@mui/icons-material/Battery20';
import { retryingJson } from '@app/lib/retryFetch';
import type { PluginWidgetProps } from '@types/plugin';
import type { ZWaveSwitchConfig, ZWaveSwitchData } from './data';

export default function ZWaveSwitchWidget(props: PluginWidgetProps<ZWaveSwitchConfig, ZWaveSwitchData>) {
  const { refreshSeconds = 10, refreshSignal, nodeIds } = props;
  const [data, setData] = useState<ZWaveSwitchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingNode, setUpdatingNode] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const load = () => {
      retryingJson<{ data: ZWaveSwitchData }>(
        '/api/widget/zwave-switch',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeIds, refreshSeconds }),
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

    // Listen for driver ready events
    const eventSource = new EventSource('/api/zwave/admin/events');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'driver-ready' && active) {
          console.log('[Z-Wave Switch] Driver ready - reloading data');
          load();
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
  }, [refreshSeconds, refreshSignal, nodeIds]);

  const handleSwitchToggle = async (nodeId: number, isOn: boolean) => {
    if (!data) return;

    setUpdatingNode(nodeId);

    try {
      const response = await fetch('/api/zwave/switch/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, isOn }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle switch');
      }

      // Update local state optimistically
      setData({
        ...data,
        devices: data.devices.map(d =>
          d.nodeId === nodeId ? { ...d, isOn, level: isOn ? (d.level || 99) : 0 } : d
        ),
      });
    } catch (e) {
      setError(`Failed to toggle switch: ${e}`);
    } finally {
      setUpdatingNode(null);
    }
  };

  const handleDimmerChange = async (nodeId: number, level: number) => {
    if (!data) return;

    setUpdatingNode(nodeId);

    try {
      const response = await fetch('/api/zwave/dimmer/level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, level }),
      });

      if (!response.ok) {
        throw new Error('Failed to set dimmer level');
      }

      // Update local state optimistically
      setData({
        ...data,
        devices: data.devices.map(d =>
          d.nodeId === nodeId ? { ...d, level, isOn: level > 0 } : d
        ),
      });
    } catch (e) {
      setError(`Failed to set dimmer level: ${e}`);
    } finally {
      setUpdatingNode(null);
    }
  };

  const getBatteryIcon = (level?: number) => {
    if (level === undefined) return null;
    if (level > 60) return <BatteryFullIcon fontSize="small" color="success" />;
    if (level > 20) return <Battery60Icon fontSize="small" color="warning" />;
    return <Battery20Icon fontSize="small" color="error" />;
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
    return <Alert severity="info">No Z-Wave switches found</Alert>;
  }

  return (
    <Stack spacing={2}>
      {data.devices.map((device) => {
        const isDimmer = device.level !== undefined;

        return (
          <Box
            key={device.nodeId}
            sx={{
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              backgroundColor: device.status === 'alive' ? 'background.paper' : 'action.disabledBackground',
            }}
          >
            <Stack spacing={1}>
              {/* Device name and status */}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  {isDimmer ? <LightbulbIcon /> : <PowerIcon />}
                  <Typography variant="subtitle1" fontWeight="bold">
                    {device.name}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  {device.batteryLevel !== undefined && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {getBatteryIcon(device.batteryLevel)}
                      <Typography variant="caption">{device.batteryLevel}%</Typography>
                    </Stack>
                  )}
                  <Typography
                    variant="caption"
                    sx={{
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      backgroundColor:
                        device.status === 'alive' ? 'success.main' :
                        device.status === 'asleep' ? 'info.main' :
                        device.status === 'dead' ? 'error.main' : 'grey.500',
                      color: 'white',
                    }}
                  >
                    {device.status}
                  </Typography>
                </Stack>
              </Stack>

              {/* Switch control */}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">
                  {device.isOn ? 'ON' : 'OFF'}
                </Typography>
                <Switch
                  checked={device.isOn}
                  onChange={(e) => handleSwitchToggle(device.nodeId, e.target.checked)}
                  disabled={updatingNode === device.nodeId}
                />
              </Stack>

              {/* Dimmer slider */}
              {isDimmer && (
                <Box sx={{ px: 1 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Level: {device.level}%
                  </Typography>
                  <Slider
                    value={device.level || 0}
                    onChange={(_, value) => handleDimmerChange(device.nodeId, value as number)}
                    disabled={updatingNode === device.nodeId}
                    min={0}
                    max={100}
                    valueLabelDisplay="auto"
                  />
                </Box>
              )}

              {/* Power/Energy info */}
              {(device.power !== undefined || device.energy !== undefined) && (
                <Stack direction="row" spacing={2} justifyContent="space-around">
                  {device.power !== undefined && (
                    <Typography variant="caption" color="text.secondary">
                      Power: {device.power.toFixed(1)}W
                    </Typography>
                  )}
                  {device.energy !== undefined && (
                    <Typography variant="caption" color="text.secondary">
                      Energy: {device.energy.toFixed(2)}kWh
                    </Typography>
                  )}
                </Stack>
              )}

              {/* Location */}
              {device.location && (
                <Typography variant="caption" color="text.secondary" textAlign="center">
                  {device.location}
                </Typography>
              )}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}

