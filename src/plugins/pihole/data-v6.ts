/**
 * Pi-hole Plugin - Value Functions for Pi-hole v6 API
 * 
 * This plugin provides value functions for Pi-hole v6 statistics
 * using the new REST API with session-based authentication.
 */

import { registerValueFunction } from '@server/valueFunctions';
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
  try {
    const cacheKey = `${baseUrl}|${password}`;
    const now = Date.now();

    // Check if authentication previously failed
    const authFailure = authFailureCache.get(cacheKey);
    if (authFailure && authFailure.expiresAt > now) {
      if (DEBUG) console.log('[Pi-hole v6] Skipping auth - previous failure cached');
      return null;
    }

    const cached = sessionCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      console.log('[Pi-hole v6] Using cached session');
      return { sid: cached.sid, csrf: cached.csrf };
    }

    console.log(`[Pi-hole v6] Authenticating to ${baseUrl}`);

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
        expiresAt: now + SESSION_TTL_MS,
      };

      sessionCache.set(cacheKey, session);
      console.log('[Pi-hole v6] Authentication successful');

      return { sid: session.sid, csrf: session.csrf };
    }

    // Cache authentication failure for 5 minutes
    console.error('[Pi-hole v6] Authentication failed:', json);
    authFailureCache.set(cacheKey, {
      failed: true,
      expiresAt: now + 5 * 60 * 1000, // 5 minutes
    });
    return null;
  } catch (e) {
    const cacheKey = `${baseUrl}|${password}`;
    const now = Date.now();

    // Cache authentication error for 5 minutes
    console.error('[Pi-hole v6] Authentication error:', e);
    authFailureCache.set(cacheKey, {
      failed: true,
      expiresAt: now + 5 * 60 * 1000, // 5 minutes
    });
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
  try {
    const cacheKey = `${baseUrl}|${password}`;
    const now = Date.now();
    const cached = summaryCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      console.log('[Pi-hole v6] Using cached summary');
      return cached.data;
    }

    // Get session
    const session = await getSession(baseUrl, password);
    if (!session) {
      console.error('[Pi-hole v6] Failed to get session');
      return {};
    }

    // Fetch summary
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const summaryUrl = `${base}api/stats/summary`;

    console.log(`[Pi-hole v6] Fetching summary from ${summaryUrl}`);

    const response = await makeRequest(summaryUrl, {
      method: 'GET',
      headers: {
        Cookie: `sid=${session.sid}`,
        'X-CSRF-Token': session.csrf,
      },
    });

    const json = JSON.parse(response.data);

    if (json.error) {
      console.error('[Pi-hole v6] API error:', json.error);
      return {};
    }

    console.log('[Pi-hole v6] Summary fetched successfully. Keys:', Object.keys(json));

    summaryCache.set(cacheKey, {
      data: json,
      expiresAt: now + SUMMARY_TTL_MS,
    });

    return json;
  } catch (e) {
    console.error('[Pi-hole v6] Error fetching summary:', e);
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
  console.log('[Pi-hole v6] ads-blocked-today:', result);
  return result;
});

registerValueFunction('pihole-dns-queries-today', async ({ baseUrl, token }) => {
  const s = await getSummary(baseUrl, token);
  const result = numify(s?.queries?.total);
  console.log('[Pi-hole v6] dns-queries-today:', result);
  return result;
});

registerValueFunction('pihole-ads-percentage-today', async ({ baseUrl, token }) => {
  const s = await getSummary(baseUrl, token);
  const result = Math.round(numify(s?.queries?.percent_blocked));
  console.log('[Pi-hole v6] ads-percentage-today:', result);
  return result;
});

registerValueFunction('pihole-domains-being-blocked', async ({ baseUrl, token }) => {
  const s = await getSummary(baseUrl, token);
  const result = numify(s?.gravity?.domains_being_blocked);
  console.log('[Pi-hole v6] domains-being-blocked:', result);
  return result;
});

registerValueFunction('pihole-unique-clients', async ({ baseUrl, token }) => {
  const s = await getSummary(baseUrl, token);
  const result = numify(s?.clients?.active);
  console.log('[Pi-hole v6] unique-clients:', result);
  return result;
});

registerValueFunction('pihole-queries-forwarded', async ({ baseUrl, token }) => {
  const s = await getSummary(baseUrl, token);
  const result = numify(s?.queries?.forwarded);
  console.log('[Pi-hole v6] queries-forwarded:', result);
  return result;
});

registerValueFunction('pihole-queries-cached', async ({ baseUrl, token }) => {
  const s = await getSummary(baseUrl, token);
  const result = numify(s?.queries?.cached);
  console.log('[Pi-hole v6] queries-cached:', result);
  return result;
});

registerValueFunction('pihole-status-enabled', async ({ baseUrl, token }) => {
  const s = await getSummary(baseUrl, token);
  // Pi-hole v6 doesn't have a simple enabled/disabled status in summary
  // We'll assume if we can fetch data, it's enabled
  const result = s && Object.keys(s).length > 0 ? 'Enabled' : 'Disabled';
  console.log('[Pi-hole v6] status-enabled:', result);
  return result;
});

export {};

