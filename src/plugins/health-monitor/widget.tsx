// ABOUTME: React widget component for displaying service health status

import React, { useEffect, useState } from 'react';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import { retryingJson } from '@app/lib/retryFetch';
import type { PluginWidgetProps } from '@types/plugin';
import type { HealthMonitorConfig, HealthMonitorData, HealthCheckResult } from './data';

/**
 * Get status color based on service health
 */
function getStatusColor(status: string): 'success' | 'error' | 'warning' {
  switch (status) {
    case 'up':
      return 'success';
    case 'down':
      return 'error';
    case 'degraded':
      return 'warning';
    default:
      return 'error';
  }
}

/**
 * Get status icon based on service health
 */
function getStatusIcon(status: string) {
  switch (status) {
    case 'up':
      return <CheckCircleIcon fontSize="small" />;
    case 'down':
      return <ErrorIcon fontSize="small" />;
    case 'degraded':
      return <WarningIcon fontSize="small" />;
    default:
      return <ErrorIcon fontSize="small" />;
  }
}

/**
 * Format time ago from ISO timestamp
 */
function formatTimeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}

/**
 * Service health row component
 */
function ServiceRow({ service }: { service: HealthCheckResult }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 1.5,
        borderRadius: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
        },
      }}
    >
      {/* Status indicator */}
      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 90 }}>
        <Chip
          icon={getStatusIcon(service.status)}
          label={service.status.toUpperCase()}
          color={getStatusColor(service.status)}
          size="small"
          sx={{ fontWeight: 600 }}
        />
      </Box>

      {/* Service info */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
          {service.title}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(200, 210, 230, 0.7)',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {service.url}
        </Typography>
        {service.error && (
          <Typography
            variant="caption"
            sx={{
              color: 'error.light',
              display: 'block',
              mt: 0.5,
            }}
          >
            {service.error}
          </Typography>
        )}
      </Box>

      {/* Response time and last check */}
      <Box sx={{ textAlign: 'right', minWidth: 100 }}>
        {service.responseTime !== undefined && (
          <Typography variant="caption" sx={{ display: 'block', color: 'rgba(200, 210, 230, 0.85)' }}>
            {service.responseTime}ms
          </Typography>
        )}
        {service.statusCode !== undefined && (
          <Typography variant="caption" sx={{ display: 'block', color: 'rgba(200, 210, 230, 0.7)' }}>
            HTTP {service.statusCode}
          </Typography>
        )}
        <Typography variant="caption" sx={{ display: 'block', color: 'rgba(200, 210, 230, 0.6)' }}>
          {formatTimeAgo(service.lastCheck)}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Health Monitor Widget
 */
export default function HealthMonitorWidget(
  props: PluginWidgetProps<HealthMonitorConfig, HealthMonitorData>
) {
  const {
    services = [],
    timeout = 5000,
    retries = 1,
    refreshSeconds = 30,
    refreshSignal,
  } = props;
  const [data, setData] = useState<HealthMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = () => {
      setLoading(true);
      setError(null);

      // Health checks are executed on Todash server via this API call.
      retryingJson<{ data: HealthMonitorData }>(
        '/api/widget/health-monitor',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: {
              services,
              timeout,
              retries,
              refreshSeconds,
            },
          }),
        },
        { retries: 1, backoffMs: 400 }
      )
        .then(({ data: next }) => {
          if (!active) return;
          setData(next);
        })
        .catch((e) => {
          if (!active) return;
          setError(String(e));
        })
        .finally(() => {
          if (!active) return;
          setLoading(false);
        });
    };

    load();
    const id = setInterval(load, Math.max(2, Number(refreshSeconds) || 30) * 1000);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [JSON.stringify(services), timeout, retries, refreshSeconds, refreshSignal]);

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (loading || !data) {
    return <Typography variant="body2">Checking services...</Typography>;
  }

  // Calculate summary statistics
  const total = data.services.length;
  const up = data.services.filter(s => s.status === 'up').length;
  const down = data.services.filter(s => s.status === 'down').length;
  const degraded = data.services.filter(s => s.status === 'degraded').length;

  return (
    <Stack spacing={2}>
      {/* Summary header */}
      {total > 1 && (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            pb: 1,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Chip
            label={`${up} Up`}
            color="success"
            size="small"
            variant="outlined"
          />
          {degraded > 0 && (
            <Chip
              label={`${degraded} Degraded`}
              color="warning"
              size="small"
              variant="outlined"
            />
          )}
          {down > 0 && (
            <Chip
              label={`${down} Down`}
              color="error"
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      )}

      {/* Service list */}
      <Stack spacing={1}>
        {data.services.map((service, index) => (
          <ServiceRow key={index} service={service} />
        ))}
      </Stack>

      {/* Last updated timestamp */}
      {data.timestamp && (
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(200, 210, 230, 0.5)',
            textAlign: 'center',
            pt: 1,
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          Last updated: {formatTimeAgo(data.timestamp)}
        </Typography>
      )}
    </Stack>
  );
}
