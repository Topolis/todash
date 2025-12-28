// ABOUTME: Shared utilities and hooks for HiFi Control widget
// ABOUTME: Provides common functions and React hooks used by widget components

import { useState, useEffect, useCallback } from 'react';
import type { HifiControlConfig, HifiControlData } from './types';
import { logger } from '@lib/logger';

interface UseHifiDataOptions {
  widgetType: string;
  config?: HifiControlConfig;
  refreshSeconds?: number;
  refreshSignal?: number;
  initialData: HifiControlData | null;
  initialError: string | null;
  dashboardSettings?: any;
}

interface UseHifiDataResult {
  data: HifiControlData | null;
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  reload: () => Promise<void>;
}

export function useHifiData(options: UseHifiDataOptions): UseHifiDataResult {
  const {
    widgetType,
    config,
    refreshSeconds,
    refreshSignal,
    initialData,
    initialError,
    dashboardSettings,
  } = options;

  const [data, setData] = useState<HifiControlData | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/widget/${widgetType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, dashboardSettings }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      logger.error('HiFi Control', 'Data fetch failed', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [widgetType, config, dashboardSettings]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshSeconds || refreshSeconds <= 0) return;

    const interval = setInterval(reload, refreshSeconds * 1000);
    return () => clearInterval(interval);
  }, [refreshSeconds, reload]);

  // Manual refresh signal
  useEffect(() => {
    if (refreshSignal) {
      reload();
    }
  }, [refreshSignal, reload]);

  return { data, loading, error, setError, reload };
}

export async function sendHifiCommand(
  command: string,
  params?: any,
  dashboardSettings?: any
): Promise<void> {
  logger.debug('HiFi Control', `Sending command: ${command}`, params);

  const response = await fetch('/api/hifi-control/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, params, dashboardSettings }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Command failed');
  }
}

export function formatVolume(volumePercent: number): string {
  return `${volumePercent}%`;
}

export function formatVolumeDb(volumeDb?: string): string {
  return volumeDb || '';
}
