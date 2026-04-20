// ABOUTME: Verifies health-monitor respects per-service check intervals.
// ABOUTME: Ensures server-side checks are cached between widget refreshes.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchHealthMonitorData } from '@plugins/health-monitor/data';

function okResponse(status = 200): Response {
  return {
    status,
    text: async () => '',
  } as unknown as Response;
}

describe('fetchHealthMonitorData checkInterval behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reuses cached service result before checkInterval elapses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const config = {
      services: [
        {
          title: 'Cached Service',
          url: 'https://example.com/cached',
          checkInterval: 600,
          method: 'HEAD' as const,
        },
      ],
      timeout: 5000,
      retries: 0,
    };

    const first = await fetchHealthMonitorData(config);

    vi.setSystemTime(new Date('2026-04-20T10:01:00.000Z'));
    const second = await fetchHealthMonitorData(config);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.services[0].lastCheck).toBe(first.services[0].lastCheck);
  });

  it('runs a new health check after checkInterval elapses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const config = {
      services: [
        {
          title: 'Expiring Service',
          url: 'https://example.com/expiring',
          checkInterval: 60,
          method: 'HEAD' as const,
        },
      ],
      timeout: 5000,
      retries: 0,
    };

    const first = await fetchHealthMonitorData(config);

    vi.setSystemTime(new Date('2026-04-20T10:01:01.000Z'));
    const second = await fetchHealthMonitorData(config);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second.services[0].lastCheck).not.toBe(first.services[0].lastCheck);
  });
});
