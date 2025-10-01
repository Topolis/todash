export const transitPlugin = {
  async fetchData(config) {
    const { cacheGet, cacheSet } = await import('../cache.js');
    const ttlMs = (process.env.CACHE_TTL_MS && Number(process.env.CACHE_TTL_MS)) || 5 * 60 * 1000;
    const url = (config && config.mvgApiUrl) || 'https://www.mvg.de/api/bgw-pt/v3/messages';
    const limit = config.limit || 20;
    const key = `transit:mvg:${url}`;
    const cached = cacheGet(key);
    if (!config.force && cached) return cached.slice(0, limit);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'todash-dashboard/0.1 Node.js',
        'Accept': 'application/json,text/plain,*/*'
      },
      // node-fetch v3 doesn't support timeout option directly; keep defaults
    });
    if (!res.ok) throw new Error(`MVG API error: ${res.status}`);
    const json = await res.json();

    function extractMessages(data) {
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object') {
        for (const k of ['messages', 'data', 'items', 'results']) {
          if (Array.isArray(data[k])) return data[k];
        }
        if ('type' in data) return [data];
      }
      return [];
    }

    const messages = extractMessages(json);
    const incidents = messages.filter(m => m)
      .map(m => ({
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
      const ta = typeof a.publication === 'number' ? a.publication : Date.parse(a.publication || '');
      const tb = typeof b.publication === 'number' ? b.publication : Date.parse(b.publication || '');
      const av = isNaN(ta) ? 0 : ta;
      const bv = isNaN(tb) ? 0 : tb;
      return bv - av; // newest first
    });

    cacheSet(key, incidents, ttlMs);
    return incidents.slice(0, limit);
  },
};
