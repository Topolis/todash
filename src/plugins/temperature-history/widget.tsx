import React, { useEffect, useState } from 'react';
import { Box, Typography, Stack, CircularProgress } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import type { PluginWidgetProps } from '@types/plugin';
import type { TemperatureHistoryConfig, TemperatureHistoryData } from './types';
import { retryingJson } from '@app/lib/retryFetch';

export default function TemperatureHistoryWidget(props: PluginWidgetProps<TemperatureHistoryConfig, TemperatureHistoryData>) {
  const { refreshSeconds = 300, refreshSignal, nodeId, hours = 48 } = props;

  const [data, setData] = useState<TemperatureHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = () => {
      retryingJson<{ data: TemperatureHistoryData }>(
        '/api/widget/temperature-history',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId, hours }),
        }
      )
        .then((result) => {
          if (active) {
            setData(result.data);
            setLoading(false);
            setError(null);
          }
        })
        .catch((e) => {
          if (active) {
            setError(e.message);
            setLoading(false);
          }
        });
    };

    load();
    const seconds = Math.max(60, Number(refreshSeconds) || 300);
    const id = setInterval(load, seconds * 1000);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [refreshSeconds, refreshSignal, nodeId, hours]);

  if (loading && !data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  if (!data || data.readings.length === 0) {
    return (
      <Box p={2}>
        <Typography color="text.secondary">No temperature data available</Typography>
      </Box>
    );
  }

  // Prepare chart data
  const xData = data.readings.map(r => new Date(r.timestamp));
  const yData = data.readings.map(r => r.temperature);

  // Calculate Y-axis range with some padding
  const minTemp = data.minTemperature || Math.min(...yData);
  const maxTemp = data.maxTemperature || Math.max(...yData);
  const padding = (maxTemp - minTemp) * 0.1 || 1;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', px: 1, mt: -1 }}>
      {/* Header with stats */}
      <Stack direction="row" spacing={2} alignItems="center" mb={0.5} justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center">
          <ThermostatIcon />
          <Typography variant="h6">{data.nodeName}</Typography>
        </Stack>

        {data.currentTemperature !== undefined && (
          <Stack direction="row" spacing={2}>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              Current: <strong>{data.currentTemperature.toFixed(1)}°C</strong>
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
              Min: {minTemp.toFixed(1)}°C
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
              Max: {maxTemp.toFixed(1)}°C
            </Typography>
          </Stack>
        )}
      </Stack>

      {/* Chart */}
      <Box sx={{ flexGrow: 1, minHeight: 0, ml: -2, mr: -1 }}>
        <LineChart
          margin={{ top: 5, right: 5, bottom: -5, left: 5 }}
          xAxis={[
            {
              data: xData,
              scaleType: 'time',
              valueFormatter: (date: Date) => {
                const now = new Date();
                const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

                if (diffHours < 24) {
                  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                } else {
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }
              },
            },
          ]}
          series={[
            {
              data: yData,
              color: '#3b82f6',
              showMark: false,
              curve: 'monotoneX',
            },
          ]}
          yAxis={[
            {
              min: minTemp - padding,
              max: maxTemp + padding,
              valueFormatter: (value: number) => `${value.toFixed(1)}°C`,
            },
          ]}
          grid={{ vertical: true, horizontal: true }}
          sx={{
            '& .MuiLineElement-root': {
              strokeWidth: 2,
            },
            '& .MuiChartsAxis-line': {
              stroke: 'rgba(255, 255, 255, 0.1)',
            },
            '& .MuiChartsAxis-tick': {
              stroke: 'rgba(255, 255, 255, 0.1)',
            },
            '& .MuiChartsAxis-tickLabel': {
              fill: 'rgba(255, 255, 255, 0.5)',
              fontSize: '0.75rem',
            },
            '& .MuiChartsGrid-line': {
              stroke: 'rgba(255, 255, 255, 0.05)',
            },
            '& .MuiChartsLegend-series text': {
              fill: 'rgba(255, 255, 255, 0.7) !important',
            },
          }}
        />
      </Box>
    </Box>
  );
}

