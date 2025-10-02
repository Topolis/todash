/**
 * Pi-hole Plugin - Value Functions Only
 *
 * This plugin provides value functions for Pi-hole statistics
 * to be used in status widgets. No widget component is provided.
 */

import { registerValueFunction } from '@server/valueFunctions';
import { logger } from '../../lib/logger';

const DEBUG = process.env.DEBUG_PIHOLE === '1';

// Simple in-memory caches with 60s TTL to avoid overwhelming Pi-hole
const summaryCache = new Map<string, { data: any; expiresAt: number }>();
const statusCache = new Map<string, { value: number; expiresAt: number }>();
// In-flight request tracking to prevent duplicate concurrent fetches
const summaryInflight = new Map<string, Promise<any>>();
const statusInflight = new Map<string, Promise<number>>();
const SUMMARY_TTL_MS = 60000;
const STATUS_TTL_MS = 60000;

/**
 * Convert value to number, handling various formats
 */
function numify(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number' && isFinite(v)) return v;
  const s = String(v).replace(/[,\s]/g, '');
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

/**
 * Build candidate URLs for Pi-hole API endpoints
 */
function buildCandidates(baseUrl: string, params: Record<string, any> = {}): string[] {
  const base = new URL(baseUrl);
  const q = { ...params };
  const apiPath = q.apiPath;
  delete q.apiPath;
  const urls: string[] = [];

  const add = (p: string) => {
    const u = new URL(p, base);
    for (const [k, v] of Object.entries(q)) {
      if (v === true) u.searchParams.set(k, '1');
      else if (v != null) u.searchParams.set(k, String(v));
    }
    urls.push(u.toString());
  };

  if (apiPath) {
    const p = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    add(p);
    return urls;
  }

  const paths = new Set<string>();
  const pn = base.pathname.replace(/\/$/, '');
  if (/\/admin(\/|$)/.test(pn)) {
    paths.add(`${pn.endsWith('/') ? pn : pn + '/'}api.php`);
  } else {
    if (pn && pn !== '/') {
      paths.add(`${pn}/admin/api.php`);
      paths.add(`${pn}/api.php`);
    }
  }
  paths.add('/admin/api.php');
  paths.add('/api.php');
  paths.add('/pihole/admin/api.php');
  paths.add('/pihole/api.php');

  for (const p of paths) add(p);
  return urls;
}

/**
 * Try fetching JSON from candidate URLs
 */
async function fetchJsonFromCandidates(candidates: string[]): Promise<any> {
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        /* not JSON */
      }
    } catch {
      /* try next */
    }
  }
  throw new Error('All Pi-hole JSON candidates failed');
}

/**
 * Try fetching text from candidate URLs
 */
async function fetchTextFromCandidates(candidates: string[]): Promise<string> {
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return await res.text();
    } catch {
      /* try next */
    }
  }
  throw new Error('All Pi-hole text candidates failed');
}

/**
 * Get Pi-hole summary data with caching
 */
async function getSummary(baseUrl: string, token?: string, apiPath?: string): Promise<any> {
  const key = `${String(baseUrl || '')}|${token || ''}|${apiPath || ''}`;

  try {
    const now = Date.now();
    const cached = summaryCache.get(key);
    if (cached && cached.expiresAt > now) {
      logger.debug('Pi-hole', 'Using cached summary data');
      return cached.data;
    }

    // Check if there's already an in-flight request for this summary
    const inflight = summaryInflight.get(key);
    if (inflight) {
      logger.debug('Pi-hole', 'Waiting for in-flight summary request');
      return await inflight;
    }

    logger.debug('Pi-hole', `Fetching summary from ${baseUrl} (apiPath: ${apiPath})`);

    // Create the promise for this request and track it
    const requestPromise = (async () => {
      try {
        const paramCombos = [
          { summaryRaw: 1, auth: token, apiPath },
          { summaryRaw: 1, apiPath },
          { summary: 1, auth: token, apiPath },
          { summary: 1, apiPath },
        ];

        let lastErr: Error | null = null;
        for (const params of paramCombos) {
          const candidates = buildCandidates(baseUrl, params);
          logger.debug('Pi-hole', 'Trying candidates', candidates);
          try {
            const json = await fetchJsonFromCandidates(candidates);
            logger.debug('Pi-hole', `Summary OK via ${candidates[0]}`, { keys: Object.keys(json) });
            summaryCache.set(key, { data: json, expiresAt: Date.now() + SUMMARY_TTL_MS });
            return json;
          } catch (e) {
            lastErr = e as Error;
            logger.warn('Pi-hole', 'Failed to fetch from candidates', (e as Error).message);
            continue;
          }
        }
        logger.error('Pi-hole', `Summary failed for all candidates: ${baseUrl}`, lastErr?.message);
        return {};
      } catch (e) {
        logger.error('Pi-hole', 'Error in getSummary', e);
        return {};
      } finally {
        // Remove from in-flight tracking
        summaryInflight.delete(key);
      }
    })();

    // Track this request
    summaryInflight.set(key, requestPromise);
    return await requestPromise;
  } catch (e) {
    // Outer catch for any unexpected errors
    logger.error('Pi-hole', 'Unexpected error in getSummary', e);
    summaryInflight.delete(key);
    return {};
  }
}

/**
 * Get Pi-hole status (enabled/disabled) with caching
 */
async function getStatus(baseUrl: string, token?: string, apiPath?: string): Promise<number> {
  const key = `${String(baseUrl || '')}|${token || ''}|${apiPath || ''}`;

  try {
    const now = Date.now();
    const cached = statusCache.get(key);
    if (cached && cached.expiresAt > now) return cached.value;

    // Check if there's already an in-flight request for this status
    const inflight = statusInflight.get(key);
    if (inflight) {
      logger.debug('Pi-hole', 'Waiting for in-flight status request');
      return await inflight;
    }

    // Create the promise for this request and track it
    const requestPromise = (async () => {
      try {
        const paramCombos = [
          { status: 1, auth: token, apiPath },
          { status: 1, apiPath },
        ];
        for (const params of paramCombos) {
          const candidates = buildCandidates(baseUrl, params);
          try {
            const text = await fetchTextFromCandidates(candidates);
            let val: number;
            try {
              const j = JSON.parse(text);
              const s = (j && (j.status || j.enable || j.disabled)) || text;
              val = /enabled/i.test(String(s)) ? 1 : 0;
            } catch {
              val = /enabled/i.test(text) ? 1 : 0;
            }
            statusCache.set(key, { value: val, expiresAt: Date.now() + STATUS_TTL_MS });
            return val;
          } catch {
            continue;
          }
        }
        if (DEBUG) logger.warn('Pi-hole', `status failed for all candidates: ${baseUrl}`);
        return 0;
      } catch (e) {
        return 0;
      } finally {
        // Remove from in-flight tracking
        statusInflight.delete(key);
      }
    })();

    // Track this request
    statusInflight.set(key, requestPromise);
    return await requestPromise;
  } catch (e) {
    // Outer catch for any unexpected errors
    logger.error('Pi-hole', 'Unexpected error in getStatus', e);
    statusInflight.delete(key);
    return 0;
  }
}

// Register all Pi-hole value functions

registerValueFunction('pihole-ads-blocked-today', async ({ baseUrl, token, apiPath }) => {
  logger.debug('Pi-hole', 'pihole-ads-blocked-today called', { baseUrl, token: token ? '***' : undefined, apiPath });
  const s = await getSummary(baseUrl, token, apiPath);
  const result = numify(s?.ads_blocked_today);
  logger.debug('Pi-hole', 'pihole-ads-blocked-today result', { result, raw: s?.ads_blocked_today });
  return result;
});

registerValueFunction('pihole-dns-queries-today', async ({ baseUrl, token, apiPath }) => {
  const s = await getSummary(baseUrl, token, apiPath);
  const result = numify(s?.dns_queries_today);
  logger.debug('Pi-hole', 'pihole-dns-queries-today result', result);
  return result;
});

registerValueFunction('pihole-ads-percentage-today', async ({ baseUrl, token, apiPath }) => {
  const s = await getSummary(baseUrl, token, apiPath);
  const result = Math.round(numify(s?.ads_percentage_today));
  logger.debug('Pi-hole', 'pihole-ads-percentage-today result', result);
  return result;
});

registerValueFunction('pihole-domains-being-blocked', async ({ baseUrl, token, apiPath }) => {
  const s = await getSummary(baseUrl, token, apiPath);
  const result = numify(s?.domains_being_blocked);
  logger.debug('Pi-hole', 'pihole-domains-being-blocked result', result);
  return result;
});

registerValueFunction('pihole-unique-clients', async ({ baseUrl, token, apiPath }) => {
  const s = await getSummary(baseUrl, token, apiPath);
  const result = numify(s?.unique_clients);
  logger.debug('Pi-hole', 'pihole-unique-clients result', result);
  return result;
});

registerValueFunction('pihole-queries-forwarded', async ({ baseUrl, token, apiPath }) => {
  const s = await getSummary(baseUrl, token, apiPath);
  const result = numify(s?.queries_forwarded);
  logger.debug('Pi-hole', 'pihole-queries-forwarded result', result);
  return result;
});

registerValueFunction('pihole-queries-cached', async ({ baseUrl, token, apiPath }) => {
  const s = await getSummary(baseUrl, token, apiPath);
  const result = numify(s?.queries_cached);
  logger.debug('Pi-hole', 'pihole-queries-cached result', result);
  return result;
});

registerValueFunction('pihole-status-enabled', async ({ baseUrl, token, apiPath }) => {
  logger.debug('Pi-hole', 'pihole-status-enabled called', { baseUrl, token: token ? '***' : undefined, apiPath });
  // Prefer summary.status to avoid another call
  const s = await getSummary(baseUrl, token, apiPath);
  if (s && typeof s.status === 'string') {
    const result = /enabled/i.test(s.status) ? 'Enabled' : 'Disabled';
    logger.debug('Pi-hole', 'pihole-status-enabled result from summary', result);
    return result;
  }
  const val = await getStatus(baseUrl, token, apiPath);
  const result = val === 1 ? 'Enabled' : 'Disabled';
  logger.debug('Pi-hole', 'pihole-status-enabled result from status', result);
  return result;
});

