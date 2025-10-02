/**
 * Pi-hole Plugin - Value Functions for Pi-hole v6 API
 *
 * This plugin provides value functions for Pi-hole v6 statistics
 * using the new REST API with session-based authentication.
 */

import { registerValueFunction } from '@server/valueFunctions';
import { logger } from '../../lib/logger';
import https from 'https';
import http from 'http';

const DEBUG = true;

// Cache TTLs
const SUMMARY_TTL_MS = 10_000; // 10 seconds
const SESSION_TTL_MS = 25 * 60 * 1000; // 25 minutes (Pi-hole sessions last 30 min)

// Caches
const summaryCache = new Map<string, { data: any; expiresAt: number }>();
const sessionCache = new Map<string, { sid: string; csrf: string; expiresAt: number }>();
// Cache authentication failures to avoid repeated failed attempts (treated as "disabled")
const authFailureCache = new Map<string, { failed: boolean; expiresAt: number }>();
// In-flight request tracking to prevent duplicate concurrent fetches
const summaryInflight = new Map<string, Promise<any>>();
const sessionInflight = new Map<string, Promise<{ sid: string; csrf: string } | null>>();

// HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

/**
 * Make HTTP/HTTPS request
 */
async function makeRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Promise<{ data: string; headers: Record<string, string | string[]> }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      agent: isHttps ? httpsAgent : undefined,
    };

    const req = client.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          data,
          headers: res.headers as Record<string, string | string[]>,
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

/**
 * Authenticate with Pi-hole v6 API and get session
 */
async function getSession(
  baseUrl: string,
  password: string
): Promise<{ sid: string; csrf: string } | null> {
  const cacheKey = `${baseUrl}|${password}`;

  try {
    const now = Date.now();

    // Check if authentication previously failed
    const authFailure = authFailureCache.get(cacheKey);
    if (authFailure && authFailure.expiresAt > now) {
      if (DEBUG) logger.debug('Pi-hole v6', 'Skipping auth - previous failure cached');
      return null;
    }

    const cached = sessionCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      logger.debug('Pi-hole v6', 'Using cached session');
      return { sid: cached.sid, csrf: cached.csrf };
    }

    // Check if there's already an in-flight request for this session
    const inflight = sessionInflight.get(cacheKey);
    if (inflight) {
      logger.debug('Pi-hole v6', 'Waiting for in-flight session request');
      return await inflight;
    }

    logger.info('Pi-hole v6', `Authenticating to ${baseUrl}`);

    // Create the promise for this request and track it
    const requestPromise = (async () => {
      try {
        // Ensure baseUrl ends with /
        const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        const authUrl = `${base}api/auth`;

        const response = await makeRequest(authUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password }),
        });

        const json = JSON.parse(response.data);

        if (json.session?.valid && json.session?.sid && json.session?.csrf) {
          const session = {
            sid: json.session.sid,
            csrf: json.session.csrf,
            expiresAt: Date.now() + SESSION_TTL_MS,
          };

          sessionCache.set(cacheKey, session);
          logger.info('Pi-hole v6', 'Authentication successful');

          return { sid: session.sid, csrf: session.csrf };
        }

        // Cache authentication failure for 5 minutes
        logger.error('Pi-hole v6', 'Authentication failed', json);
        authFailureCache.set(cacheKey, {
          failed: true,
          expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        });
        return null;
      } catch (e) {
        // Cache authentication error for 5 minutes
        logger.error('Pi-hole v6', 'Authentication error', e);
        authFailureCache.set(cacheKey, {
          failed: true,
          expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        });
        return null;
      } finally {
        // Remove from in-flight tracking
        sessionInflight.delete(cacheKey);
      }
    })();

    // Track this request
    sessionInflight.set(cacheKey, requestPromise);
    return await requestPromise;
  } catch (e) {
    // Outer catch for any unexpected errors
    logger.error('Pi-hole v6', 'Unexpected error in getSession', e);
    sessionInflight.delete(cacheKey);
    return null;
  }
}

/**
 * Get Pi-hole v6 summary data
 */
async function getSummary(
  baseUrl: string,
  password: string
): Promise<any> {
  const cacheKey = `${baseUrl}|${password}`;

  try {
    const now = Date.now();
    const cached = summaryCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      logger.debug('Pi-hole v6', 'Using cached summary');
      return cached.data;
    }

    // Check if there's already an in-flight request for this summary
    const inflight = summaryInflight.get(cacheKey);
    if (inflight) {
      logger.debug('Pi-hole v6', 'Waiting for in-flight summary request');
      return await inflight;
    }

    logger.debug('Pi-hole v6', 'Fetching new summary data');

    // Create the promise for this request and track it
    const requestPromise = (async () => {
      try {
        // Get session
        const session = await getSession(baseUrl, password);
        if (!session) {
          logger.error('Pi-hole v6', 'Failed to get session');
          return {};
        }

        // Fetch summary
        const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        const summaryUrl = `${base}api/stats/summary`;

        logger.debug('Pi-hole v6', `Fetching summary from ${summaryUrl}`);

        const response = await makeRequest(summaryUrl, {
          method: 'GET',
          headers: {
            Cookie: `sid=${session.sid}`,
            'X-CSRF-Token': session.csrf,
          },
        });

        const json = JSON.parse(response.data);

        if (json.error) {
          logger.error('Pi-hole v6', 'API error', json.error);
          return {};
        }

        logger.debug('Pi-hole v6', 'Summary fetched successfully', { keys: Object.keys(json) });

        summaryCache.set(cacheKey, {
          data: json,
          expiresAt: Date.now() + SUMMARY_TTL_MS,
        });

        return json;
      } catch (e) {
        logger.error('Pi-hole v6', 'Error fetching summary', e);
        return {};
      } finally {
        // Remove from in-flight tracking
        summaryInflight.delete(cacheKey);
      }
    })();

    // Track this request
    summaryInflight.set(cacheKey, requestPromise);
    return await requestPromise;
  } catch (e) {
    // Outer catch for any unexpected errors
    logger.error('Pi-hole v6', 'Unexpected error in getSummary', e);
    summaryInflight.delete(cacheKey);
    return {};
  }
}

/**
 * Convert value to number
 */
function numify(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number' && isFinite(v)) return v;
  const s = String(v).replace(/[,\s]/g, '');
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

// Register Pi-hole v6 value functions

registerValueFunction('pihole-ads-blocked-today', async ({ baseUrl, token }) => {
  const s = await getSummary(baseUrl, token);
  const result = numify(s?.queries?.blocked);
  logger.debug('Pi-hole v6', 'ads-blocked-today', result);
  return result;
});

registerValueFunction('pihole-dns-queries-today', async ({ baseUrl, token }) => {
  const s = await getSummary(baseUrl, token);
  const result = numify(s?.queries?.total);
  logger.debug('Pi-hole v6', 'dns-queries-today', result);
  return result;
});

registerValueFunction('pihole-ads-percentage-today', async ({ baseUrl, token }) => {
  const s = await getSummary(baseUrl, token);
  const result = Math.round(numify(s?.queries?.percent_blocked));
  logger.debug('Pi-hole v6', 'ads-percentage-today', result);
  return result;
});

registerValueFunction('pihole-domains-being-blocked', async ({ baseUrl, token }) => {
  const s = await getSummary(baseUrl, token);
  const result = numify(s?.gravity?.domains_being_blocked);
  logger.debug('Pi-hole v6', 'domains-being-blocked', result);
  return result;
});

registerValueFunction('pihole-unique-clients', async ({ baseUrl, token }) => {
  const s = await getSummary(baseUrl, token);
  const result = numify(s?.clients?.active);
  logger.debug('Pi-hole v6', 'unique-clients', result);
  return result;
});

registerValueFunction('pihole-queries-forwarded', async ({ baseUrl, token }) => {
  const s = await getSummary(baseUrl, token);
  const result = numify(s?.queries?.forwarded);
  logger.debug('Pi-hole v6', 'queries-forwarded', result);
  return result;
});

registerValueFunction('pihole-queries-cached', async ({ baseUrl, token }) => {
  const s = await getSummary(baseUrl, token);
  const result = numify(s?.queries?.cached);
  logger.debug('Pi-hole v6', 'queries-cached', result);
  return result;
});

registerValueFunction('pihole-status-enabled', async ({ baseUrl, token }) => {
  const s = await getSummary(baseUrl, token);
  // Pi-hole v6 doesn't have a simple enabled/disabled status in summary
  // We'll assume if we can fetch data, it's enabled
  const result = s && Object.keys(s).length > 0 ? 'Enabled' : 'Disabled';
  logger.debug('Pi-hole v6', 'status-enabled', result);
  return result;
});

export {};

