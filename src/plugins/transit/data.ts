import { cacheGet, cacheSet } from '@server/cache';

export interface TransitLine {
  label?: string;
  name?: string;
  id?: string;
  transportType?: string;
}

export interface TransitConfig {
  mvgApiUrl?: string;
  apiUrl?: string;
  limit?: number;
  force?: boolean;
  favorites?: string[];
}

export interface TransitIncident {
  title: string;
  description: string;
  publication: number | string | null;
  validFrom?: string | null;
  validTo?: string | null;
  type: string | null;
  lines: (TransitLine | string)[];
  provider: string;
  link?: string | null;
}

export type TransitData = TransitIncident[];

function extractMessages(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const k of ['messages', 'data', 'items', 'results']) {
      if (Array.isArray(data[k])) return data[k];
    }
    if ('type' in data) return [data];
  }
  return [];
}

export async function fetchTransitData(config: TransitConfig): Promise<TransitData> {
  const ttlMs = (process.env.CACHE_TTL_MS && Number(process.env.CACHE_TTL_MS)) || 5 * 60 * 1000;
  const url = config?.mvgApiUrl || config?.apiUrl || 'https://www.mvg.de/api/bgw-pt/v3/messages';
  const limit = config.limit || 20;
  const key = `transit:mvg:${url}`;

  const cached = cacheGet<TransitIncident[]>(key);
  if (!config.force && cached) return cached.slice(0, limit);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'todash-dashboard/0.2 Node.js',
      Accept: 'application/json,text/plain,*/*',
    },
  });

  if (!res.ok) throw new Error(`MVG API error: ${res.status}`);
  const json = await res.json();

  const messages = extractMessages(json);
  const incidents: TransitIncident[] = messages
    .filter((m) => m)
    .map((m) => ({
      title: m.title || m.header || m.headline || 'Meldung',
      description: m.description || m.text || m.subtitle || '',
      publication: m.publication ?? m.published ?? m.publicationDate ?? m.timestamp ?? null,
      validFrom: m.validFrom ?? null,
      validTo: m.validTo ?? null,
      type: m.type || m.category || null,
      lines: m.lines || m.affectedLines || [],
      provider: 'MVG',
      link: m.link || m.url || null,
    }));

  incidents.sort((a, b) => {
    const ta = typeof a.publication === 'number' ? a.publication : Date.parse(String(a.publication || ''));
    const tb = typeof b.publication === 'number' ? b.publication : Date.parse(String(b.publication || ''));
    const av = isNaN(ta) ? 0 : ta;
    const bv = isNaN(tb) ? 0 : tb;
    return bv - av; // newest first
  });

  cacheSet(key, incidents, ttlMs);
  return incidents.slice(0, limit);
}
