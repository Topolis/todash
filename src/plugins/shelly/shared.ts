// ABOUTME: Provides shared hooks and helpers for Shelly client-side widgets.
// ABOUTME: Handles data fetching, RPC calls, and UI formatting utilities.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { retryingJson } from '@app/lib/retryFetch';
import type { ShellyWidgetConfig, ShellyWidgetData, ShellyThermostatState } from './data';

export interface UseShellyDataOptions {
  widgetType: string;
  config?: ShellyWidgetConfig;
  refreshSeconds?: number;
  refreshSignal?: number;
  initialData?: ShellyWidgetData | null;
  initialError?: string | null;
}

export interface UseShellyDataResult {
  data: ShellyWidgetData | null;
  loading: boolean;
  error: string | null;
  setError: (value: string | null) => void;
  reload: () => Promise<void>;
}

export function useShellyData(options: UseShellyDataOptions): UseShellyDataResult {
  const { widgetType, config, refreshSeconds = 15, refreshSignal, initialData = null, initialError = null } = options;
  const [data, setData] = useState<ShellyWidgetData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(initialError);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const requestConfig = useMemo(() => config ?? {}, [config]);

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner && mountedRef.current) {
        setLoading(true);
      }
      try {
        const payload = await retryingJson<{ data: ShellyWidgetData }>(
          `/api/widget/${widgetType}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestConfig),
          }
        );
        if (!mountedRef.current) {
          return;
        }
        setData(payload.data);
        setError(null);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load Shelly data';
        if (mountedRef.current) {
          setError(message);
        }
      } finally {
        if (showSpinner && mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [requestConfig, widgetType]
  );

  useEffect(() => {
    let active = true;

    const initialLoad = async () => {
      if (!active) return;
      await load(true);
    };

    initialLoad();

    const seconds = Math.max(5, Number(refreshSeconds) || 15);
    const timer = setInterval(() => {
      load(false);
    }, seconds * 1000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load, refreshSeconds, refreshSignal]);

  const reload = useCallback(async () => {
    await load(true);
  }, [load]);

  return { data, loading, error, setError, reload };
}

export async function callShellyRpc(method: string, params?: Record<string, unknown>) {
  const response = await fetch('/api/shelly/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  if (payload?.error) {
    const message = typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error);
    throw new Error(message);
  }

  return payload?.result;
}

export function formatTemperature(value?: number): string {
  if (value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(1)}°C`;
}

export function clampTemperature(value: number): number {
  const rounded = Math.round(value * 2) / 2;
  return Number(rounded.toFixed(1));
}

const SUGGESTED_MODES = ['manual', 'heat', 'eco', 'auto', 'off'];

export function deriveCandidateModes(state: ShellyThermostatState): string[] {
  const modes = new Set<string>();
  if (state.mode) modes.add(state.mode);
  for (const mode of SUGGESTED_MODES) {
    modes.add(mode);
  }
  return Array.from(modes);
}

export function formatDuration(seconds?: number): string {
  if (!seconds || Number.isNaN(seconds)) {
    return 'unknown';
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);

  return parts.length ? parts.join(' ') : `${Math.floor(seconds)}s`;
}

export function getCurrentDashboardName(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('dashboard') || 'sample';
  } catch {
    return 'sample';
  }
}
