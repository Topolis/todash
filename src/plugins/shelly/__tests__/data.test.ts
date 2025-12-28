import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShellyWidgetConfig } from '@plugins/shelly/data';
import { fetchShellyData } from '@plugins/shelly/data';
import * as controllerModule from '@plugins/shelly/controller';

describe('fetchShellyData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SHELLY_HOST = 'http://192.168.2.163';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SHELLY_HOST;
  });

  it('aggregates thermostats, scripts, actions, and schedules', async () => {
    const config: ShellyWidgetConfig = {
      thermostats: [{ id: 'trv-1', label: 'Living Room' }],
    };

    const callShellySpy = vi.spyOn(controllerModule, 'callShelly');

    callShellySpy.mockImplementation(async (...args: unknown[]) => {
      const [method, params] = args as [string, Record<string, any> | undefined];
      if (method === 'Shelly.GetDeviceInfo') {
        return { name: 'Shelly Blue Gen3', model: 'SBG3', fw_id: '2025.1.0', uptime: 3600 };
      }

      if (method === 'Script.List') {
        return {
          scripts: [
            { id: 1, name: 'Warm Morning', enable: true, running: false, last_run: 1710000000 },
          ],
        };
      }

      if (method === 'Actions.List') {
        return {
          actions: [
            { id: 'boost', name: 'Boost Heating', enabled: true, group: 'Heating' },
          ],
        };
      }

      if (method === 'Schedule.List') {
        return {
          schedules: [
            { id: 5, name: 'Weekday', enable: true, next_run_ts: 1710003600 },
          ],
        };
      }

      if (method === 'Thermostat.GetStatus') {
        expect(params).toEqual({ id: 'trv-1' });
        return {
          id: 'trv-1',
          status: 'ok',
          mode: 'heat',
          target_t: 22,
          current_t: 21.5,
          battery: { percent: 85 },
          valve: { position: 40 },
          room: 'Living Room',
        };
      }

      throw new Error(`Unexpected method ${method}`);
    });

    const data = await fetchShellyData(config);

    expect(data.controller).toEqual({
      name: 'Shelly Blue Gen3',
      model: 'SBG3',
      firmware: '2025.1.0',
      uptimeSeconds: 3600,
      url: 'http://192.168.2.163',
    });

    expect(data.controllerUrl).toBe('http://192.168.2.163');
  expect(data.authError).toBeNull();

    expect(data.thermostats).toHaveLength(1);
    expect(data.thermostats[0]).toMatchObject({
      id: 'trv-1',
      label: 'Living Room',
      currentTemperature: 21.5,
      targetTemperature: 22,
      battery: 85,
      valvePosition: 40,
      mode: 'heat',
      status: 'ok',
    });

    expect(data.scripts).toHaveLength(1);
    expect(data.scripts[0]).toMatchObject({
      id: 1,
      name: 'Warm Morning',
      enabled: true,
      running: false,
      lastRunTs: 1710000000,
    });

    expect(data.actions).toHaveLength(1);
    expect(data.actions[0]).toMatchObject({
      id: 'boost',
      name: 'Boost Heating',
      enabled: true,
      group: 'Heating',
    });

    expect(data.schedules).toHaveLength(1);
    expect(data.schedules[0]).toMatchObject({
      id: 5,
      name: 'Weekday',
      enabled: true,
      nextRunTs: 1710003600,
    });
  });

  it('surfaces auth errors when the controller rejects credentials', async () => {
    const config: ShellyWidgetConfig = {};
    const callShellySpy = vi.spyOn(controllerModule, 'callShelly');

    callShellySpy.mockImplementation(async (method: string) => {
      if (method === 'Shelly.GetDeviceInfo') {
        return { name: 'Shelly Blue Gen3', model: 'SBG3' };
      }
  throw new controllerModule.ShellyRpcError('Shelly RPC HTTP 401 Unauthorized', { status: 401, method });
    });

    const data = await fetchShellyData(config);

    expect(data.authError).toContain('Shelly controller rejected the configured credentials');
    expect(data.scripts).toHaveLength(0);
    expect(data.actions).toHaveLength(0);
    expect(data.schedules).toHaveLength(0);
  });
});
