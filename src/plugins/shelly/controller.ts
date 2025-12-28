// ABOUTME: Provides RPC helpers for communicating with the Shelly Gen3 controller.
// ABOUTME: Normalizes connection settings, enforces allow lists, and executes controller methods.

import { createHash, randomBytes } from 'crypto';
import { logger } from '@lib/logger';
import { getSecret } from '@server/secrets';

export interface ShellyConnectionOptions {
  host: string;
  username?: string;
  password?: string;
  timeoutMs?: number;
}

export class ShellyRpcError extends Error {
  status?: number;
  code?: number;
  method?: string;

  constructor(message: string, options?: { status?: number; code?: number; method?: string }) {
    super(message);
    this.name = 'ShellyRpcError';
    this.status = options?.status;
    this.code = options?.code;
    this.method = options?.method;
  }
}

const DEFAULT_TIMEOUT_MS = 5000;

export const SHELLY_ALLOWED_METHODS = new Set<string>([
  'Shelly.GetDeviceInfo',
  'Shelly.GetComponents',
  'BluTrv.GetStatus',
  'BluTrv.GetRemoteStatus',
  'BluTrv.GetRemoteConfig',
  'BluTrv.SetConfig',
  'BluTrv.Call',
]);

function normalizeHost(rawHost?: string): string {
  const host = rawHost?.trim();
  if (!host) {
    return 'http://192.168.2.163';
  }

  if (/^https?:\/\//i.test(host)) {
    return host.replace(/\/?$/, '');
  }

  return `http://${host.replace(/\/?$/, '')}`;
}

export function resolveShellyConnectionOptions(overrides?: Partial<ShellyConnectionOptions>): ShellyConnectionOptions {
  const host = normalizeHost(overrides?.host ?? getSecret('SHELLY_HOST'));
  const username = overrides?.username ?? getSecret('SHELLY_USERNAME');
  const password = overrides?.password ?? getSecret('SHELLY_PASSWORD');
  const timeoutMs = overrides?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    host,
    username: username || undefined,
    password: password || undefined,
    timeoutMs,
  };
}

let rpcCounter = 0;

function buildBasicAuthorization(username?: string, password?: string): string | null {
  if (!username || !password) {
    return null;
  }
  const token = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${token}`;
}

function parseDigestChallenge(headerValue: string | null): Record<string, string> | null {
  if (!headerValue) {
    return null;
  }

  const trimmed = headerValue.trim();
  if (!trimmed.toLowerCase().startsWith('digest')) {
    return null;
  }

  const paramsSection = trimmed.slice(6).trim();
  const matchPattern = /([a-zA-Z0-9_]+)=("([^"]*)"|([^,]*))/g;
  const parameters: Record<string, string> = {};
  let match: RegExpExecArray | null;

  while ((match = matchPattern.exec(paramsSection)) !== null) {
    const key = match[1];
    const value = match[3] ?? match[4] ?? '';
    parameters[key] = value;
  }

  if (!parameters.realm || !parameters.nonce) {
    return null;
  }

  return parameters;
}

function md5(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function buildDigestAuthorization(
  options: ShellyConnectionOptions,
  challenge: Record<string, string>,
  requestPath: string,
  method: string
): string | null {
  if (!options.username || !options.password) {
    return null;
  }

  const realm = challenge.realm;
  const nonce = challenge.nonce;
  const qopList = (challenge.qop ?? 'auth').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  const qop = qopList.includes('auth') ? 'auth' : qopList[0] ?? undefined;
  const algorithm = (challenge.algorithm ?? 'MD5').toUpperCase();
  
  // Select hash function based on algorithm
  const hashFunc = algorithm === 'SHA-256' ? sha256 : md5;
  if (algorithm !== 'MD5' && algorithm !== 'SHA-256') {
    logger.warn('Shelly', `Unsupported digest algorithm ${algorithm}, falling back to MD5`);
  }

  const cnonce = randomBytes(8).toString('hex');
  const nc = '00000001';

  const ha1 = hashFunc(`${options.username}:${realm}:${options.password}`);
  const ha2 = hashFunc(`${method.toUpperCase()}:${requestPath}`);

  let response: string;
  if (qop) {
    response = hashFunc(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  } else {
    response = hashFunc(`${ha1}:${nonce}:${ha2}`);
  }

  const headerParts: string[] = [
    `username="${options.username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${requestPath}"`,
  ];

  if (qop) {
    headerParts.push(`qop=${qop}`);
    headerParts.push(`nc=${nc}`);
    headerParts.push(`cnonce="${cnonce}"`);
  }

  headerParts.push(`response="${response}"`);

  if (challenge.opaque) {
    headerParts.push(`opaque="${challenge.opaque}"`);
  }

  if (challenge.algorithm) {
    headerParts.push(`algorithm=${challenge.algorithm}`);
  }

  if (challenge.charset) {
    headerParts.push(`charset=${challenge.charset}`);
  }

  return `Digest ${headerParts.join(', ')}`;
}

async function sendShellyRequest(
  url: string,
  body: string,
  authorization: string | null,
  timeoutMs: number | undefined
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authorization) {
      headers.Authorization = authorization;
    }

    return await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function callShelly(
  method: string,
  params?: Record<string, unknown>,
  overrides?: Partial<ShellyConnectionOptions>
): Promise<any> {
  const options = resolveShellyConnectionOptions(overrides);
  const url = `${options.host}/rpc`;
  const requestId = ++rpcCounter;
  const requestBody = JSON.stringify({
    id: requestId,
    method,
    params: params ?? {},
  });

  const requestPath = '/rpc';

  let authorization = buildBasicAuthorization(options.username, options.password);
  let response: Response | null = null;

  try {
    response = await sendShellyRequest(url, requestBody, authorization, options.timeoutMs);

    if (response.status === 401) {
      const digestChallenge = parseDigestChallenge(response.headers.get('www-authenticate'));
      if (digestChallenge) {
  authorization = buildDigestAuthorization(options, digestChallenge, requestPath, 'POST');
        response = await sendShellyRequest(url, requestBody, authorization, options.timeoutMs);
      }
    }

    if (!response.ok) {
      throw new ShellyRpcError(`Shelly RPC HTTP ${response.status} ${response.statusText}`, {
        status: response.status,
        method,
      });
    }

    const payload = await response.json();

    if (payload?.error) {
      const message = typeof payload.error?.message === 'string' ? payload.error.message : 'Unknown error';
      const code = payload.error?.code;
      throw new ShellyRpcError(`Shelly RPC error${code !== undefined ? ` ${code}` : ''}: ${message}`,
        {
          status: response.status,
          code,
          method,
        }
      );
    }

    return payload?.result ?? null;
  } catch (error) {
    if (error instanceof ShellyRpcError) {
      if (error.status === 401 || error.status === 403) {
        logger.warn('Shelly', `RPC ${method} unauthorized`, error);
      } else if (error.code === 404) {
        // 404 errors are expected for unsupported methods - don't log stack trace
        logger.debug('Shelly', `RPC ${method} not found (code 404) - method not supported on this device`);
      } else {
        logger.error('Shelly', `RPC ${method} failed`, error);
      }
    } else {
      logger.error('Shelly', `RPC ${method} failed`, error);
    }
    throw error;
  }
}

export async function executeShellyRpc(
  method: string,
  params?: Record<string, unknown>,
  overrides?: Partial<ShellyConnectionOptions>
): Promise<any> {
  if (!SHELLY_ALLOWED_METHODS.has(method)) {
    throw new Error(`Shelly RPC method ${method} is not allowed`);
  }

  return callShelly(method, params, overrides);
}
