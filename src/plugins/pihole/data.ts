/**
 * Pi-hole Plugin - Value Functions Only
 * 
 * This plugin provides value functions for Pi-hole statistics
 * to be used in status widgets. No widget component is provided.
 */

import { registerValueFunction } from '@server/valueFunctions';

const DEBUG = process.env.DEBUG_PIHOLE === '1';

// Simple in-memory caches with 60s TTL to avoid overwhelming Pi-hole
const summaryCache = new Map<string, { data: any; expiresAt: number }>();
const statusCache = new Map<string, { value: number; expiresAt: number }>();
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
  try {
    const key = `${String(baseUrl || '')}|${token || ''}|${apiPath || ''}`;
    const now = Date.now();
    const cached = summaryCache.get(key);
    if (cached && cached.expiresAt > now) return cached.data;

    const paramCombos = [
      { summaryRaw: 1, auth: token, apiPath },
      { summaryRaw: 1, apiPath },
      { summary: 1, auth: token, apiPath },
      { summary: 1, apiPath },
    ];

    let lastErr: Error | null = null;
    for (const params of paramCombos) {
      const candidates = buildCandidates(baseUrl, params);
      try {
        const json = await fetchJsonFromCandidates(candidates);
        if (DEBUG) console.log('[Pi-hole] summary OK via', candidates[0]);
        summaryCache.set(key, { data: json, expiresAt: now + SUMMARY_TTL_MS });
        return json;
      } catch (e) {
        lastErr = e as Error;
        continue;
      }
    }
    if (DEBUG) console.warn('[Pi-hole] summary failed for all candidates', baseUrl, lastErr?.message);
    return {};
  } catch (e) {
    return {};
  }
}

/**
 * Get Pi-hole status (enabled/disabled) with caching
 */
async function getStatus(baseUrl: string, token?: string, apiPath?: string): Promise<number> {
  try {
    const key = `${String(baseUrl || '')}|${token || ''}|${apiPath || ''}`;
    const now = Date.now();
    const cached = statusCache.get(key);
    if (cached && cached.expiresAt > now) return cached.value;

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
        statusCache.set(key, { value: val, expiresAt: now + STATUS_TTL_MS });
        return val;
      } catch {
        continue;
      }
    }
    if (DEBUG) console.warn('[Pi-hole] status failed for all candidates', baseUrl);
    return 0;
  } catch (e) {
    return 0;
  }
}

// Register all Pi-hole value functions

registerValueFunction('pihole-ads-blocked-today', async ({ baseUrl, token, apiPath }) => {
  const s = await getSummary(baseUrl, token, apiPath);
  return numify(s?.ads_blocked_today);
});

registerValueFunction('pihole-dns-queries-today', async ({ baseUrl, token, apiPath }) => {
  const s = await getSummary(baseUrl, token, apiPath);
  return numify(s?.dns_queries_today);
});

registerValueFunction('pihole-ads-percentage-today', async ({ baseUrl, token, apiPath }) => {
  const s = await getSummary(baseUrl, token, apiPath);
  return Math.round(numify(s?.ads_percentage_today));
});

registerValueFunction('pihole-domains-being-blocked', async ({ baseUrl, token, apiPath }) => {
  const s = await getSummary(baseUrl, token, apiPath);
  return numify(s?.domains_being_blocked);
});

registerValueFunction('pihole-unique-clients', async ({ baseUrl, token, apiPath }) => {
  const s = await getSummary(baseUrl, token, apiPath);
  return numify(s?.unique_clients);
});

registerValueFunction('pihole-queries-forwarded', async ({ baseUrl, token, apiPath }) => {
  const s = await getSummary(baseUrl, token, apiPath);
  return numify(s?.queries_forwarded);
});

registerValueFunction('pihole-queries-cached', async ({ baseUrl, token, apiPath }) => {
  const s = await getSummary(baseUrl, token, apiPath);
  return numify(s?.queries_cached);
});

registerValueFunction('pihole-status-enabled', async ({ baseUrl, token, apiPath }) => {
  // Prefer summary.status to avoid another call
  const s = await getSummary(baseUrl, token, apiPath);
  if (s && typeof s.status === 'string') return /enabled/i.test(s.status) ? 1 : 0;
  return await getStatus(baseUrl, token, apiPath); // fallback
});

