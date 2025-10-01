export const calendarPlugin = {
  async fetchData(config) {
    const { cacheGet, cacheSet } = await import('../cache.js');
    const ttlMs = (process.env.CACHE_TTL_MS && Number(process.env.CACHE_TTL_MS)) || 10 * 60 * 1000;
    // Backward-compat: allow urls: string[] and new sources: ({url,color,label}|string)[]
    const sources = Array.isArray(config.sources) && config.sources.length
      ? config.sources.map(s => (typeof s === 'string' ? { url: s } : s)).filter(s => s && s.url)
      : (Array.isArray(config.urls) ? config.urls.map(u => ({ url: u })) : []);
    const lookAheadDays = Number(config.lookAheadDays || 14);
    const limit = Number(config.limit || 20);
    if (sources.length === 0) return [];

    function unfold(str) {
      // RFC5545: lines may be folded with CRLF followed by space/tab
      return str.replace(/\r?\n[\t ]/g, '');
    }
    function parseDate(val) {
      // Handles forms like 20250109T120000Z or 20250109T120000
      if (!val) return null;
      // If date-only (YYYYMMDD), treat as start of day UTC
      if (/^\d{8}$/.test(val)) {
        const y = val.slice(0,4), m = val.slice(4,6), d = val.slice(6,8);
        return new Date(`${y}-${m}-${d}T00:00:00Z`).toISOString();
      }
      const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?Z?$/);
      if (m) {
        const [_, y, mo, d, hh, mm, ss] = m;
        const iso = `${y}-${mo}-${d}T${hh}:${mm}:${ss || '00'}${val.endsWith('Z') ? 'Z' : ''}`;
        const dt = new Date(iso);
        return isNaN(dt) ? null : dt.toISOString();
      }
      const dt = new Date(val);
      return isNaN(dt) ? null : dt.toISOString();
    }

    async function fetchIcs(url) {
      const key = `ics:${url}`;
      const cached = cacheGet(key);
      if (!config.force && cached) return cached;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`ICS fetch failed: ${res.status}`);
      const text = unfold(await res.text());
      const lines = text.split(/\r?\n/);
      const events = [];
      let inEvent = false; let ev = null;
      for (const raw of lines) {
        const line = raw.trimEnd();
        if (line === 'BEGIN:VEVENT') { inEvent = true; ev = {}; continue; }
        if (line === 'END:VEVENT') { if (ev) events.push(ev); inEvent = false; ev = null; continue; }
        if (!inEvent) continue;
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        const lhs = line.slice(0, idx);
        const rhs = line.slice(idx + 1);
        const key = lhs.split(';')[0].toUpperCase();
        if (key === 'DTSTART') { ev.start = parseDate(rhs); }
        else if (key === 'DTEND') { ev.end = parseDate(rhs); }
        else if (key === 'SUMMARY') { ev.title = rhs; }
        else if (key === 'LOCATION') { ev.location = rhs; }
        else if (key === 'DESCRIPTION') { ev.description = rhs; }
        else if (key === 'URL') { ev.url = rhs; }
      }
      cacheSet(key, events, ttlMs);
      return events;
    }

    // Fetch per-source and annotate with color/label and source index
    const results = await Promise.allSettled(sources.map(async (src, i) => {
      const items = await fetchIcs(src.url);
      const color = src.color || null;
      const sourceLabel = src.label || null;
      return items.map(ev => ({ ...ev, color, sourceLabel, __src: i }));
    }));
    const eventsMerged = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value || []);
    // Build initial status with total parsed items per source
    let sourcesStatus = sources.map((src, i) => {
      const r = results[i];
      if (r && r.status === 'fulfilled') {
        const count = Array.isArray(r.value) ? r.value.length : 0;
        return { url: src.url, label: src.label || null, color: src.color || null, ok: true, count, windowDays: lookAheadDays };
      } else {
        const reason = r && r.status === 'rejected' ? (r.reason?.message || String(r.reason)) : 'Unknown error';
        return { url: src.url, label: src.label || null, color: src.color || null, ok: false, error: reason };
      }
    });

    const now = Date.now();
    const horizon = now + lookAheadDays * 24 * 60 * 60 * 1000;
    const filtered = eventsMerged.filter(ev => {
      const start = Date.parse(ev.start || '');
      const end = Date.parse(ev.end || ev.start || '');
      if (isNaN(start) && isNaN(end)) return false;
      const s = isNaN(start) ? end : start;
      const e = isNaN(end) ? s : end;
      return s <= horizon && e >= now;
    });
    filtered.sort((a, b) => new Date(a.start || a.end) - new Date(b.start || b.end));
    // Compute in-window counts by source
    const inWindowCounts = new Array(sources.length).fill(0);
    for (const ev of filtered) {
      if (typeof ev.__src === 'number') inWindowCounts[ev.__src]++;
      delete ev.__src;
    }
    sourcesStatus = sourcesStatus.map((s, i) => ({ ...s, inWindow: inWindowCounts[i] || 0 }));
    return { events: filtered.slice(0, limit), sources: sourcesStatus };
  }
};
