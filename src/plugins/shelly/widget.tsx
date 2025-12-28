// ABOUTME: Stub export maintained for compatibility with older imports.
// ABOUTME: Delegates to the Shelly thermostats widget implementation.

export { default } from './thermostats';

/*
// ABOUTME: React widget for controlling Shelly Gen3 thermostats, scripts, actions, and schedules.
// ABOUTME: Fetches aggregated controller data and provides RPC-backed controls.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
// ABOUTME: Stub export maintained for compatibility with older imports.
// ABOUTME: Delegates to the Shelly thermostats widget implementation.

export { default } from './thermostats';
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  backgroundColor: 'rgba(255,255,255,0.01)',
                }}
              >
                <Stack>
                  <Typography variant="subtitle2">{script.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    #{script.id} • {script.enabled ? 'Enabled' : 'Disabled'}{script.running ? ' • Running' : ''}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<PlayArrowIcon fontSize="small" />}
                    onClick={() => handleScriptAction(script.id, 'start')}
                    disabled={isPending(`script:start:${script.id}`)}
                  >
                    Start
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<StopIcon fontSize="small" />}
                    onClick={() => handleScriptAction(script.id, 'stop')}
                    disabled={isPending(`script:stop:${script.id}`)}
                  >
                    Stop
                  </Button>
                  <Button
                    size="small"
                    variant={script.enabled ? 'outlined' : 'contained'}
                    onClick={() => handleScriptAction(script.id, script.enabled ? 'disable' : 'enable')}
                    disabled={isPending(`script:${script.enabled ? 'disable' : 'enable'}:${script.id}`)}
                  >
                    {script.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>

      <Stack spacing={1}>
        <Typography variant="h6">Actions</Typography>
        {data.actions.length === 0 ? (
          <Alert severity="info">No actions configured</Alert>
        ) : (
          <Stack spacing={1}>
            {data.actions.map((action) => (
              <Stack
                key={action.id}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                }}
              >
                <Stack>
                  <Typography variant="subtitle2">{action.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {action.id}{action.group ? ` • ${action.group}` : ''}
                  </Typography>
                </Stack>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<BoltIcon fontSize="small" />}
                  onClick={() => handleActionRun(action.id)}
                  disabled={isPending(`action:run:${action.id}`)}
                >
                  Run
                </Button>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>

      <Stack spacing={1}>
        <Typography variant="h6">Schedules</Typography>
        {data.schedules.length === 0 ? (
          <Alert severity="info">No schedules found</Alert>
        ) : (
          <Stack spacing={1}>
            {data.schedules.map((schedule) => (
              <Stack
                key={schedule.id}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                }}
              >
                <Stack>
                  <Typography variant="subtitle2">{schedule.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    #{schedule.id} • {schedule.enabled ? 'Enabled' : 'Disabled'}
                    {schedule.nextRunTs ? ` • Next ${new Date(schedule.nextRunTs * 1000).toLocaleString()}` : ''}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant={schedule.enabled ? 'outlined' : 'contained'}
                    onClick={() => handleSchedule(schedule.id, schedule.enabled ? 'disable' : 'enable')}
                    disabled={isPending(`schedule:${schedule.enabled ? 'disable' : 'enable'}:${schedule.id}`)}
                  >
                    {schedule.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<LoopIcon fontSize="small" />}
                    onClick={() => handleSchedule(schedule.id, 'run')}
                    disabled={isPending(`schedule:run:${schedule.id}`)}
                  >
                    Run Now
                  </Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}

*/
