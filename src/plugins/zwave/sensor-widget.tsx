import React, { useEffect, useState } from 'react';
import { Stack, Typography, CircularProgress, Alert, Box, Chip } from '@mui/material';
import SensorsIcon from '@mui/icons-material/Sensors';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import Battery60Icon from '@mui/icons-material/Battery60';
import Battery20Icon from '@mui/icons-material/Battery20';
import { retryingJson } from '@app/lib/retryFetch';
import type { PluginWidgetProps } from '@types/plugin';
import type { ZWaveSensorConfig, ZWaveSensorData } from './data';

export default function ZWaveSensorWidget(props: PluginWidgetProps<ZWaveSensorConfig, ZWaveSensorData>) {
  const { refreshSeconds = 30, refreshSignal, nodeIds, sensorTypes } = props;
  const [data, setData] = useState<ZWaveSensorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = () => {
      retryingJson<{ data: ZWaveSensorData }>(
        '/api/widget/zwave-sensor',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeIds, sensorTypes, refreshSeconds }),
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
    const seconds = Math.max(10, Number(refreshSeconds) || 30);
    const id = setInterval(load, seconds * 1000);

    // Listen for driver ready events
    const eventSource = new EventSource('/api/zwave/admin/events');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'driver-ready' && active) {
          console.log('[Z-Wave Sensor] Driver ready - reloading data');
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
  }, [refreshSeconds, refreshSignal, nodeIds, sensorTypes]);

  const getBatteryIcon = (level?: number) => {
    if (level === undefined) return null;
    if (level > 60) return <BatteryFullIcon fontSize="small" color="success" />;
    if (level > 20) return <Battery60Icon fontSize="small" color="warning" />;
    return <Battery20Icon fontSize="small" color="error" />;
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === '°C' || unit === '°F') {
      return `${value.toFixed(1)}${unit}`;
    }
    if (unit === '%') {
      return `${value.toFixed(0)}${unit}`;
    }
    return `${value.toFixed(2)} ${unit}`;
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
    return <Alert severity="info">No Z-Wave sensors found</Alert>;
  }

  // Group sensors by node ID
  const groupedByNode = data.devices.reduce((acc, device) => {
    if (!acc[device.nodeId]) {
      acc[device.nodeId] = [];
    }
    acc[device.nodeId].push(device);
    return acc;
  }, {} as Record<number, typeof data.devices>);

  return (
    <Stack spacing={2}>
      {Object.entries(groupedByNode).map(([nodeIdStr, sensors]) => {
        const nodeId = parseInt(nodeIdStr);
        const firstSensor = sensors[0];

        return (
          <Box
            key={nodeId}
            sx={{
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              backgroundColor: firstSensor.status === 'alive' ? 'background.paper' : 'action.disabledBackground',
            }}
          >
            <Stack spacing={1}>
              {/* Device name and status */}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <SensorsIcon />
                  <Typography variant="subtitle1" fontWeight="bold">
                    {firstSensor.name}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  {firstSensor.batteryLevel !== undefined && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {getBatteryIcon(firstSensor.batteryLevel)}
                      <Typography variant="caption">{firstSensor.batteryLevel}%</Typography>
                    </Stack>
                  )}
                  <Typography
                    variant="caption"
                    sx={{
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      backgroundColor:
                        firstSensor.status === 'alive' ? 'success.main' :
                        firstSensor.status === 'asleep' ? 'info.main' :
                        firstSensor.status === 'dead' ? 'error.main' : 'grey.500',
                      color: 'white',
                    }}
                  >
                    {firstSensor.status}
                  </Typography>
                </Stack>
              </Stack>

              {/* Sensor readings */}
              <Stack spacing={1}>
                {sensors.map((sensor, idx) => (
                  <Stack
                    key={idx}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{
                      p: 1,
                      backgroundColor: 'action.hover',
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {sensor.sensorType}
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {formatValue(sensor.value, sensor.unit)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              {/* Location */}
              {firstSensor.location && (
                <Typography variant="caption" color="text.secondary" textAlign="center">
                  {firstSensor.location}
                </Typography>
              )}

              {/* Manufacturer info */}
              {firstSensor.manufacturer && (
                <Typography variant="caption" color="text.secondary" textAlign="center">
                  {firstSensor.manufacturer} - {firstSensor.productLabel}
                </Typography>
              )}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}

