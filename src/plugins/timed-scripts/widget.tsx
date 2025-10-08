import React, { useEffect, useState } from 'react';
import { Stack, Typography, CircularProgress, Alert, Box, Switch, IconButton, Tooltip } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { retryingJson } from '@app/lib/retryFetch';
import type { PluginWidgetProps } from '@types/plugin';
import type { TimedScriptsConfig, TimedScriptsData } from './types';

export default function TimedScriptsWidget(props: PluginWidgetProps<TimedScriptsConfig, TimedScriptsData>) {
  const { refreshSeconds = 30, refreshSignal } = props;
  const [data, setData] = useState<TimedScriptsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0); // Force re-render every second for time ago
  const [togglingScript, setTogglingScript] = useState<string | null>(null);
  const [triggeringScript, setTriggeringScript] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = () => {
      retryingJson<{ data: TimedScriptsData }>(
        '/api/widget/timed-scripts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(props),
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
    const seconds = Math.max(5, Number(refreshSeconds) || 30);
    const id = setInterval(load, seconds * 1000);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [refreshSeconds, refreshSignal, props]);

  // Update display every second to refresh "time ago"
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Helper to calculate time ago from timestamp
  const getTimeAgo = (timestampMs?: number): string => {
    if (!timestampMs || isNaN(timestampMs)) return 'never';
    
    const now = Date.now();
    const diffMs = now - timestampMs;
    
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

  const handleToggle = async (title: string, enabled: boolean) => {
    setTogglingScript(title);
    
    try {
      const response = await fetch('/api/timed-scripts/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle script');
      }

      // Update local state optimistically
      if (data) {
        setData({
          ...data,
          scripts: data.scripts.map(s =>
            s.title === title ? { ...s, enabled } : s
          ),
        });
      }
    } catch (e) {
      setError(`Failed to toggle script: ${e}`);
    } finally {
      setTogglingScript(null);
    }
  };

  const handleTrigger = async (title: string) => {
    setTriggeringScript(title);
    
    try {
      const response = await fetch('/api/timed-scripts/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger script');
      }

      // Reload data to get updated last run time
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (e) {
      setError(`Failed to trigger script: ${e}`);
    } finally {
      setTriggeringScript(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data || data.scripts.length === 0) {
    return (
      <Alert severity="info">
        No scripts configured. Add scripts to your dashboard YAML configuration.
      </Alert>
    );
  }

  return (
    <Stack spacing={1.5}>
      {data.scripts.map((script) => (
        <Box
          key={script.title}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1.5,
            borderRadius: 1,
            backgroundColor: 'action.hover',
            '&:hover': {
              backgroundColor: 'action.selected',
            },
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {script.title}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '0.7rem',
              }}
            >
              Last run: {getTimeAgo(script.lastRun)}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Run now">
              <span>
                <IconButton
                  size="small"
                  onClick={() => handleTrigger(script.title)}
                  disabled={triggeringScript === script.title}
                  sx={{ opacity: triggeringScript === script.title ? 0.5 : 1 }}
                >
                  {triggeringScript === script.title ? (
                    <CircularProgress size={20} />
                  ) : (
                    <PlayArrowIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>

            <Switch
              checked={script.enabled}
              onChange={(e) => handleToggle(script.title, e.target.checked)}
              disabled={togglingScript === script.title}
              size="small"
            />
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

