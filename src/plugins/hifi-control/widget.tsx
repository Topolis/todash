// ABOUTME: HiFi Control widget component
// ABOUTME: Displays AV receiver controls with power, volume, input selection

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  IconButton,
  Slider,
  Stack,
  Tooltip,
  Typography,
  Chip,
} from '@mui/material';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import StopIcon from '@mui/icons-material/Stop';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import { Icon } from '@iconify/react';
import type { PluginWidgetProps } from '../../types/plugin';
import type { HifiControlConfig, HifiControlData } from './types';
import { useHifiData, sendHifiCommand, formatVolume, formatVolumeDb } from './shared';

export default function HifiControlWidget(
  props: PluginWidgetProps<HifiControlConfig, HifiControlData>
) {
  const {
    refreshSeconds,
    refreshSignal,
    data: initialData,
    error: initialError,
    showPower = true,
    showVolume = true,
    showInputs = true,
    showSurroundMode = false,
    showZone2 = false,
    showZone3 = false,
    inputMapping,
    ...rest
  } = props;
  const dashboardSettings = (props as any).dashboardSettings;

  // Build config from props (memoized to prevent reload loops)
  const config = useMemo<HifiControlConfig>(() => ({
    refreshSeconds,
    showPower,
    showVolume,
    showInputs,
    showSurroundMode,
    showZone2,
    showZone3,
    inputMapping,
  }), [refreshSeconds, showPower, showVolume, showInputs, showSurroundMode, showZone2, showZone3, inputMapping]);

  const { data, loading, error, setError, reload } = useHifiData({
    widgetType: 'hifi-control',
    config,
    refreshSeconds: refreshSeconds ?? 5,
    refreshSignal,
    initialData: initialData ?? null,
    initialError: initialError ?? null,
    dashboardSettings,
  });

  const [pendingOps, setPendingOps] = useState<Set<string>>(new Set());
  const [tempVolume, setTempVolume] = useState<number | null>(null);

  const markPending = useCallback((key: string, isPending: boolean) => {
    setPendingOps((prev) => {
      const next = new Set(prev);
      if (isPending) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const isPending = useCallback((key: string) => pendingOps.has(key), [pendingOps]);

  const handleCommand = useCallback(
    async (command: string, params?: any, key?: string) => {
      const opKey = key || `cmd:${command}`;
      markPending(opKey, true);
      try {
        await sendHifiCommand(command, params, dashboardSettings);
        await reload();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Command failed';
        setError(message);
      } finally {
        markPending(opKey, false);
      }
    },
    [markPending, reload, setError, dashboardSettings]
  );

  const handleVolumeChange = useCallback(
    (_event: Event, newValue: number | number[]) => {
      const volume = Array.isArray(newValue) ? newValue[0] : newValue;
      setTempVolume(volume);
    },
    []
  );

  const handleVolumeCommit = useCallback(
    async (_event: any, newValue: number | number[]) => {
      const volumePercent = Array.isArray(newValue) ? newValue[0] : newValue;
      const volume = Math.round((volumePercent / 100) * 98); // Convert to Denon range
      setTempVolume(null);
      await handleCommand('setVolume', { volume }, 'volume-slider');
    },
    [handleCommand]
  );

  const currentVolume = useMemo(() => {
    if (tempVolume !== null) return tempVolume;
    return data?.status?.volumePercent ?? 0;
  }, [tempVolume, data?.status?.volumePercent]);

  // Apply custom input mapping if configured (must be before early returns)
  const displayInputs = useMemo(() => {
    if (!data?.capabilities?.availableInputs) return [];
    
    return data.capabilities.availableInputs
      .filter(input => {
        const customMapping = config?.inputMapping?.[input.id];
        // Filter out inputs explicitly set to false
        return customMapping !== false;
      })
      .map(input => {
        const customMapping = config?.inputMapping?.[input.id];
        if (customMapping && typeof customMapping === 'object') {
          return {
            ...input,
            label: customMapping.label ?? input.label,
            icon: customMapping.icon ?? input.icon,
          };
        }
        return input;
      });
  }, [data?.capabilities?.availableInputs, config?.inputMapping]);

  // Get current input label with custom mapping (must be before early returns)
  const currentInputLabel = useMemo(() => {
    if (!data?.status) return '';
    const customMapping = config?.inputMapping?.[data.status.currentInput];
    if (customMapping?.label) {
      return customMapping.label;
    }
    return data.status.currentInputLabel || data.status.currentInput;
  }, [data?.status?.currentInput, data?.status?.currentInputLabel, config?.inputMapping, data?.status]);

  if (loading && !data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!data) {
    return <Alert severity="info">No data from HiFi device yet</Alert>;
  }

  const { status, capabilities } = data;

  return (
    <Stack spacing={2}>
      {/* Transport controls + Input buttons */}
      <Stack direction="row" spacing={1} alignItems="center">
        {/* Transport controls */}
        <Stack direction="row" spacing={0.5} sx={{ mr: 2 }}>
          <IconButton size="small" onClick={() => handleCommand('transportPrevious', undefined, 'prev')}>
            <SkipPreviousIcon />
          </IconButton>
          <IconButton 
            onClick={() => handleCommand('transportPlayPause', undefined, 'play')}
            sx={{ 
              width: 48, 
              height: 48,
              color: 'primary.main'
            }}
          >
            {status.power === 'on' ? <PauseIcon sx={{ fontSize: 32 }} /> : <PlayArrowIcon sx={{ fontSize: 32 }} />}
          </IconButton>
          <IconButton size="small" onClick={() => handleCommand('transportStop', undefined, 'stop')}>
            <StopIcon />
          </IconButton>
          <IconButton size="small" onClick={() => handleCommand('transportNext', undefined, 'next')}>
            <SkipNextIcon />
          </IconButton>
        </Stack>

        {/* Input buttons - compact */}
        {showInputs && capabilities.supportsInputs && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ flex: 1 }}>
            {displayInputs.map((input) => {
              const isActive = status.currentInput === input.id;
              const key = `input:${input.id}`;

              return (
                <Button
                  key={input.id}
                  variant={isActive ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => handleCommand('setInput', { inputId: input.id }, key)}
                  disabled={isPending(key)}
                  sx={{ 
                    minWidth: 'auto',
                    px: 1.5,
                    py: 0.5,
                    fontSize: '0.75rem'
                  }}
                >
                  {input.label}
                </Button>
              );
            })}
          </Stack>
        )}
      </Stack>

      {/* Display info */}
      {(status.displayLine1 || status.displayInfo) && (
        <Box sx={{ textAlign: 'center', py: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {status.displayLine1 || status.displayInfo}
          </Typography>
          {status.displayLine2 && (
            <Typography variant="caption" color="text.secondary" display="block">
              {status.displayLine2}
            </Typography>
          )}
        </Box>
      )}

      {/* Volume control */}
      {showVolume && capabilities.supportsVolume && (
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            size="small"
            onClick={() => handleCommand('volumeDown', undefined, 'vol-down')}
            disabled={isPending('vol-down')}
          >
            <RemoveIcon />
          </IconButton>

          <Box sx={{ flex: 1 }}>
            <Slider
              value={currentVolume}
              onChange={handleVolumeChange}
              onChangeCommitted={handleVolumeCommit}
              min={0}
              max={100}
              disabled={isPending('volume-slider')}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}%`}
            />
          </Box>

          <IconButton
            size="small"
            onClick={() => handleCommand('volumeUp', undefined, 'vol-up')}
            disabled={isPending('vol-up')}
          >
            <AddIcon />
          </IconButton>

          <Button
            variant={status.muted ? 'contained' : 'outlined'}
            size="small"
            color={status.muted ? 'error' : 'inherit'}
            onClick={() => handleCommand('toggleMute', undefined, 'mute')}
            disabled={isPending('mute')}
            sx={{ minWidth: 80 }}
          >
            Mute
          </Button>

          {showPower && (
            <IconButton
              color={status.power === 'on' ? 'success' : 'default'}
              onClick={() => handleCommand('powerToggle', undefined, 'power')}
              disabled={isPending('power')}
              size="small"
            >
              <PowerSettingsNewIcon />
            </IconButton>
          )}
        </Stack>
      )}

      {/* Surround mode */}
      {showSurroundMode &&
        capabilities.supportsSurroundModes &&
        capabilities.availableSurroundModes &&
        capabilities.availableSurroundModes.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {capabilities.availableSurroundModes.map((mode) => {
              const isActive = status.currentSurroundMode === mode;
              const key = `surround:${mode}`;

              return (
                <Button
                  key={mode}
                  variant={isActive ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => handleCommand('setSurroundMode', { mode }, key)}
                  disabled={isPending(key)}
                  sx={{ 
                    minWidth: 'auto',
                    px: 1.5,
                    py: 0.5,
                    fontSize: '0.7rem'
                  }}
                >
                  {mode}
                </Button>
              );
            })}
          </Stack>
        )}

      {/* Zone 2 Control */}
      {showZone2 && capabilities.supportsMultiZone && capabilities.zones && capabilities.zones >= 2 && (
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2">Zone 2</Typography>
              <IconButton
                size="small"
                color={status.zone2Power ? 'success' : 'default'}
                onClick={() => handleCommand('setZone2Power', { on: !status.zone2Power }, 'zone2-power')}
                disabled={isPending('zone2-power')}
              >
                <PowerSettingsNewIcon fontSize="small" />
              </IconButton>
            </Stack>
            {status.zone2Power && (
              <Slider
                value={status.zone2Volume || 0}
                onChange={(_, val) => {
                  const volume = Array.isArray(val) ? val[0] : val;
                  handleCommand('setZone2Volume', { volume }, 'zone2-volume');
                }}
                min={0}
                max={98}
                size="small"
                disabled={isPending('zone2-volume')}
                valueLabelDisplay="auto"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Status indicator */}
      <Typography variant="caption" color="text.secondary" textAlign="center">
        {status.power === 'on' ? '● Connected' : '○ Standby'}
      </Typography>
    </Stack>
  );
}
