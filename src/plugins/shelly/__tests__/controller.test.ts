import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeShellyRpc, callShelly, SHELLY_ALLOWED_METHODS } from '@plugins/shelly/controller';

const originalEnv = { ...process.env };

function mockFetchSuccess(result: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 1, result }),
  });
}

describe('Shelly controller RPC helpers', () => {
  beforeEach(() => {
    process.env.SHELLY_HOST = '192.168.2.163';
    process.env.SHELLY_USERNAME = 'admin';
    process.env.SHELLY_PASSWORD = 'shellyrats';
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends RPC requests with expected headers and body', async () => {
    const mockedFetch = mockFetchSuccess({ scripts: [] });
    vi.stubGlobal('fetch', mockedFetch);

    const result = await callShelly('Script.List');

    expect(result).toEqual({ scripts: [] });
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('http://192.168.2.163/rpc');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/json',
        Authorization: 'Basic YWRtaW46c2hlbGx5cmF0cw==',
      })
    );

    const body = init?.body as string;
    const parsed = JSON.parse(body);
    expect(parsed.method).toBe('Script.List');
    expect(parsed.id).toBeDefined();
  });

  it('throws when Shelly returns an error object', async () => {
    const mockedFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, error: { code: 401, message: 'Unauthorized' } }),
    });
    vi.stubGlobal('fetch', mockedFetch);

    await expect(callShelly('Script.List')).rejects.toThrow('Shelly RPC error');
  });

  it('blocks methods that are not allow-listed', async () => {
    expect(SHELLY_ALLOWED_METHODS.size).toBeGreaterThan(0);
    await expect(executeShellyRpc('Bad.Method', {})).rejects.toThrow('not allowed');
  });

  it('delegates to callShelly for allowed methods', async () => {
    const mockedFetch = mockFetchSuccess({ ok: true });
    vi.stubGlobal('fetch', mockedFetch);

    await executeShellyRpc('Script.Start', { id: 1 });

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockedFetch.mock.calls[0];
    expect(init).toBeDefined();
    const body = JSON.parse(String(init?.body));
    expect(body.method).toBe('Script.Start');
    expect(body.params).toEqual({ id: 1 });
  });
});
