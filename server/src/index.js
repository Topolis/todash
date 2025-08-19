import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import Parser from 'rss-parser';
import si from 'systeminformation';
import fetch from 'node-fetch';
import Ajv from 'ajv';
import { dashboardSchema } from './schema.js';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDashboardsDir = path.resolve(__dirname, '../../dashboards');
const dashboardsDir = process.env.DASHBOARDS_DIR
  ? path.resolve(process.cwd(), process.env.DASHBOARDS_DIR)
  : defaultDashboardsDir;

// Simple in-memory TTL cache
const cache = new Map();
function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { cache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key, data, ttlMs) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// Secrets loader: prefer environment variables; optionally merge from JSON file referenced by SECRETS_FILE
let __SECRETS_CACHE = null;
function getSecret(name) {
  if (!__SECRETS_CACHE && process.env.SECRETS_FILE) {
    try {
      const p = path.resolve(process.cwd(), process.env.SECRETS_FILE);
      if (fs.existsSync(p)) __SECRETS_CACHE = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      console.warn('Failed to load secrets file:', e.message);
      __SECRETS_CACHE = {};
    }
  }
  return process.env[name] ?? (__SECRETS_CACHE ? __SECRETS_CACHE[name] : undefined);
}

// Schema validator
const ajv = new Ajv({ allErrors: true, strict: false });
const validateDashboard = ajv.compile(dashboardSchema);

function validateOrThrow(cfg) {
  const ok = validateDashboard(cfg);
  if (!ok) {
    const msg = validateDashboard.errors?.map(e => `${e.instancePath || '/'} ${e.message}`).join('; ');
    const err = new Error(`Invalid dashboard schema: ${msg}`);
    err.status = 400; throw err;
  }
  return cfg;
}

function loadDashboardConfig(name) {
  const pYaml = path.join(dashboardsDir, `${name}.yaml`);
  const pYml = path.join(dashboardsDir, `${name}.yml`);
  const pJson = path.join(dashboardsDir, `${name}.json`);
  if (fs.existsSync(pYaml)) return validateOrThrow(yaml.load(fs.readFileSync(pYaml, 'utf8')));
  if (fs.existsSync(pYml)) return validateOrThrow(yaml.load(fs.readFileSync(pYml, 'utf8')));
  if (fs.existsSync(pJson)) return validateOrThrow(JSON.parse(fs.readFileSync(pJson, 'utf8')));
  const err = new Error(`Dashboard config not found for ${name}`);
  err.status = 404; throw err;
}

// Plugin registry: define server-side data providers keyed by type
const rssParser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded'],
    ],
  },
  requestOptions: {
    headers: {
      'User-Agent': 'todash-dashboard/0.1 (+https://localhost) Node.js',
      'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8'
    },
    timeout: 10000,
  }
});
const plugins = {
  'rss-feed': {
    async fetchData(config) {
      const ttlMs = (process.env.CACHE_TTL_MS && Number(process.env.CACHE_TTL_MS)) || 5 * 60 * 1000;
      const limit = config.limit || 10; // total items after merge
      const urls = Array.isArray(config.urls) ? config.urls : (config.url ? [config.url] : []);
      if (urls.length === 0) throw new Error('rss-feed requires a url or urls');

      const resolveUrl = (u, base) => { try { return new URL(u, base).toString(); } catch { return u; } };

      const extractImage = (item) => {
        // Try common fields: enclosure, media:content, media:thumbnail, itunes:image, generic <img>
        if (item.enclosure && item.enclosure.url) return item.enclosure.url;
        if (item.itunes && item.itunes.image) return item.itunes.image;
        if (item.thumbnail && item.thumbnail.url) return item.thumbnail.url;
        if (Array.isArray(item.mediaContent) && item.mediaContent.length) {
          for (const mc of item.mediaContent) {
            const u = (mc && mc.$ && mc.$.url) || (mc && mc.url);
            if (u) return u;
          }
        }
        if (item.mediaThumbnail) {
          if (Array.isArray(item.mediaThumbnail)) {
            for (const mt of item.mediaThumbnail) {
              const u = (mt && mt.$ && mt.$.url) || (mt && mt.url);
              if (u) return u;
            }
          } else {
            if (item.mediaThumbnail.url) return item.mediaThumbnail.url;
            if (item.mediaThumbnail.$ && item.mediaThumbnail.$.url) return item.mediaThumbnail.$.url;
          }
        }
        const imgRe = /<img[^>]+src=["']([^"']+)["']/i;
        if (item.content && imgRe.test(item.content)) return resolveUrl(RegExp.$1, item.link || undefined);
        if (item.contentEncoded && imgRe.test(item.contentEncoded)) return resolveUrl(RegExp.$1, item.link || undefined);
        return null;
      };

      async function fetchRaw(url) {
        const key = `rssraw:${url}`;
        const cached = cacheGet(key);
        if (!config.force && cached) return cached;
        const feed = await rssParser.parseURL(url);
        const items = (feed.items || []).map(i => ({
          title: i.title,
          link: i.link,
          pubDate: i.pubDate,
          isoDate: i.isoDate,
          image: extractImage(i),
          contentSnippet: i.contentSnippet,
          sourceTitle: feed.title,
        }));
        const data = { sourceTitle: feed.title, items };
        cacheSet(key, data, ttlMs);
        return data;
      }

      const results = await Promise.allSettled(urls.map(u => fetchRaw(u)));
      const ok = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      if (ok.length === 0) {
        const reasons = results.map(r => r.status === 'rejected' ? r.reason?.message : '').filter(Boolean).join('; ');
        throw new Error(`Failed to fetch all RSS feeds${reasons ? `: ${reasons}` : ''}`);
      }
      const merged = ok.flatMap(r => r.items);
      merged.sort((a, b) => {
        const ta = Date.parse(a.isoDate || a.pubDate || '');
        const tb = Date.parse(b.isoDate || b.pubDate || '');
        const aValid = !isNaN(ta);
        const bValid = !isNaN(tb);
        if (aValid && bValid) return tb - ta; // newest first
        if (aValid && !bValid) return -1;
        if (!aValid && bValid) return 1;
        return 0;
      });

      return { title: config.title || 'Feeds', items: merged.slice(0, limit) };
    },
  },
  'weather': {
    async fetchData(config) {
      // Simple Open-Meteo (no key) example
      const { latitude, longitude } = config;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new Error('Weather requires numeric latitude and longitude');
      }
      const key = `weather:${latitude.toFixed(3)},${longitude.toFixed(3)}`;
      const ttlMs = (process.env.CACHE_TTL_MS && Number(process.env.CACHE_TTL_MS)) || 5 * 60 * 1000;
      const cached = cacheGet(key);
      if (!config.force && cached) return cached;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Weather API error');
      const json = await res.json();
      const data = json.current || json;
      cacheSet(key, data, ttlMs);
      return data;
    },
  },
  'weather-forecast': {
    async fetchData(config) {
      // Open-Meteo free forecast
      const { latitude, longitude, hourly = ['temperature_2m','precipitation_probability','weather_code'], daily = ['temperature_2m_max','temperature_2m_min','precipitation_probability_max','weather_code'] } = config;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') throw new Error('Weather forecast requires numeric latitude and longitude');
      const key = `forecast:${latitude.toFixed(3)},${longitude.toFixed(3)}:${hourly.join(',')}:${daily.join(',')}`;
      const ttlMs = (process.env.CACHE_TTL_MS && Number(process.env.CACHE_TTL_MS)) || 10 * 60 * 1000;
      const cached = cacheGet(key);
      if (!config.force && cached) return cached;
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        hourly: hourly.join(','),
        daily: daily.join(','),
        timezone: 'auto'
      });
      const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Forecast API error');
      const json = await res.json();
      cacheSet(key, json, ttlMs);
      return json;
    }
  },
  'project-status': {
    async fetchData(config) {
      // Basic info: version from package.json and uptime
      const rootPkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
      // Try to enrich with git info if available
      let git = null;
      try {
        const rev = fs.readFileSync(path.resolve(process.cwd(), '.git/HEAD'), 'utf8').trim();
        let ref = rev;
        if (rev.startsWith('ref:')) {
          const refPath = rev.split(' ')[1];
          const full = path.resolve(process.cwd(), '.git', refPath);
          const sha = fs.existsSync(full) ? fs.readFileSync(full, 'utf8').trim() : null;
          git = { ref: refPath, commit: sha };
        } else {
          git = { commit: rev };
        }
      } catch {}

      return {
        name: rootPkg.name,
        version: rootPkg.version || '0.0.0',
        serverTime: new Date().toISOString(),
        uptimeSec: process.uptime(),
        git,
      };
    },
  },
  'system-stats': {
    async fetchData(config) {
      const [cpu, mem, osInfo, currentLoad] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.osInfo(),
        si.currentLoad(),
      ]);
      return {
        cpu: { manufacturer: cpu.manufacturer, brand: cpu.brand, cores: cpu.cores },
        load: currentLoad.currentLoad,
        mem: { total: mem.total, free: mem.free, used: mem.used },
        os: { platform: osInfo.platform, distro: osInfo.distro, release: osInfo.release },
      };
    },
  },
  'transit-incidents': {
    async fetchData(config) {
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
  },
  'email': {
    async fetchData(config) {
      const action = config.action || 'list';
      const host = config.host || getSecret('IMAP_HOST');
      const port = Number(config.port || getSecret('IMAP_PORT') || 993);
      const secure = (typeof config.secure === 'boolean') ? config.secure : String(getSecret('IMAP_SECURE') || 'true') === 'true';
      const user = config.user || getSecret('IMAP_USER');
      const pass = config.password || getSecret('IMAP_PASSWORD');
      const mailbox = config.mailbox || getSecret('IMAP_MAILBOX') || 'INBOX';
      const limit = Number(config.limit || 20);
      if (!host || !user || !pass) throw new Error('IMAP credentials missing. Provide via env/SECRETS_FILE or widget props.');

      let ImapFlow;
      try { ({ ImapFlow } = await import('imapflow')); }
      catch { throw new Error('Missing dependency imapflow. Please install it with: npm --workspace server install imapflow'); }

      const client = new ImapFlow({ host, port, secure, auth: { user, pass } });
      try {
        await client.connect();
        await client.mailboxOpen(mailbox);

        if (action === 'markRead') {
          if (!config.uid) throw new Error('markRead requires uid');
          await client.messageFlagsAdd({ uid: Number(config.uid) }, ['\\Seen']);
          return { ok: true };
        }

        if (action === 'getBody') {
          if (!config.uid) throw new Error('getBody requires uid');
          let raw = '';
// Save layout endpoint: writes <name>.local.yaml with replaced widgets and returns newName
app.post('/api/layout', (req, res) => {
  try {
    const { name, widgets } = req.body || {};
    if (!name || !Array.isArray(widgets)) return res.status(400).json({ error: 'name and widgets are required' });
    // Basic name sanitization: allow letters, numbers, dash, underscore, dot
    if (!/^[A-Za-z0-9._-]+$/.test(name)) return res.status(400).json({ error: 'invalid dashboard name' });

    // Load base config to preserve title/settings/grid; fall back if missing
    let base;
    try { base = loadDashboardConfig(name); } catch { base = { title: name, settings: {}, grid: { columns: 12, gap: 12, rowHeight: 120 }, widgets: [] }; }

    const newName = name.endsWith('.local') ? name : `${name}.local`;
    const cfg = { ...base, widgets };
    // Validate before writing
    validateOrThrow(cfg);

    const outPath = path.join(dashboardsDir, `${newName}.yaml`);
    const yamlStr = yaml.dump(cfg, { noRefs: true, lineWidth: 120 });
    fs.writeFileSync(outPath, yamlStr, 'utf8');
    res.json({ ok: true, newName });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

          for await (const msg of client.fetch({ uid: Number(config.uid) }, { source: true, envelope: true, internalDate: true })) {
            const chunks = [];
            for await (const chunk of msg.source) chunks.push(chunk);
            raw = Buffer.concat(chunks).toString('utf8');
            const env = msg.envelope;
            let parsed = { text: null, html: null };
            try {
              const mp = await import('mailparser');
              const parsedMail = await mp.simpleParser(raw);
              parsed = { text: parsedMail.text || null, html: parsedMail.html || null };
            } catch {}
            return {
              uid: Number(config.uid),
              subject: env?.subject || '',
              from: env?.from?.map(a => a.address || a.name).join(', ') || '',
              date: msg.internalDate,
              ...parsed,
              raw: parsed.html || parsed.text ? undefined : raw.slice(0, 20000),
            };
          }
          return { uid: Number(config.uid) };
        }

        // List unread messages
        const uids = await client.search({ seen: false });
        const u = uids.slice(-limit).reverse();
        const out = [];
        for await (const msg of client.fetch(u, { uid: true, envelope: true, internalDate: true, flags: true })) {
          const env = msg.envelope;
          out.push({
            uid: msg.uid,
            subject: env?.subject || '(no subject)',
            from: (env?.from || []).map(a => a.name || a.address).filter(Boolean).join(', '),
            date: msg.internalDate,
            seen: (msg.flags || []).includes('\\Seen'),
          });
        }
        return out;
      } finally {
        try { await client.logout(); } catch {}
      }
    }
  },
  'youtube-subscriptions': {
    async fetchData(config) {
      const limit = Number(config.limit || 20);
      const clientId = config.clientId || getSecret('YT_CLIENT_ID');
      const clientSecret = config.clientSecret || getSecret('YT_CLIENT_SECRET');
      const refreshToken = config.refreshToken || getSecret('YT_REFRESH_TOKEN');
      if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('YouTube credentials missing. Provide YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN');
      }
      let google;
      try { ({ google } = await import('googleapis')); }
      catch { throw new Error('Missing dependency googleapis. Please install it with: npm --workspace server install googleapis'); }

      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      // Get channel IDs from subscriptions
      const subs = await youtube.subscriptions.list({ part: ['snippet','contentDetails'], mine: true, maxResults: 50 });
      const channels = (subs.data.items || []).map(it => it.snippet?.resourceId?.channelId).filter(Boolean);
      // Fetch recent uploads per channel via search (faster than playlist traversal for a quick sample)
      const items = [];
      for (const ch of channels) {
        const res = await youtube.search.list({ part: ['snippet'], channelId: ch, order: 'date', maxResults: 2, type: ['video'] });
        for (const v of res.data.items || []) {
          items.push({
            videoId: v.id?.videoId,
            title: v.snippet?.title,
            channelTitle: v.snippet?.channelTitle,
            publishedAt: v.snippet?.publishedAt,
            thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url,
            url: v.id?.videoId ? `https://www.youtube.com/watch?v=${v.id.videoId}` : null,
          });
        }
        if (items.length >= limit * 2) break; // early cutoff
      }
      // Merge, sort by publishedAt desc, deduplicate by videoId
      const seen = new Set();
      const merged = items
        .sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt))
        .filter(it => { if (!it.videoId || seen.has(it.videoId)) return false; seen.add(it.videoId); return true; })
        .slice(0, limit);
      return merged;
    }
  },
  'calendar-ics': {
    async fetchData(config) {
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
  },
  'aqi': {
    async fetchData(config) {
      const { latitude, longitude } = config;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new Error('aqi requires numeric latitude and longitude');
      }
      const key = `aqi:${latitude.toFixed(3)},${longitude.toFixed(3)}`;
      const ttlMs = (process.env.CACHE_TTL_MS && Number(process.env.CACHE_TTL_MS)) || 5 * 60 * 1000;
      const cached = cacheGet(key);
      if (!config.force && cached) return cached;
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        hourly: ['european_aqi','pm2_5','pm10','nitrogen_dioxide','ozone','sulphur_dioxide','carbon_monoxide'].join(','),
        timezone: 'auto'
      });
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('AQI API error');
      const json = await res.json();
      const h = json.hourly || {};
      const times = h.time || [];
      const idx = times.length - 1;
      const data = idx >= 0 ? {
        time: times[idx],
        european_aqi: h.european_aqi?.[idx] ?? null,
        pm2_5: h.pm2_5?.[idx] ?? null,
        pm10: h.pm10?.[idx] ?? null,
        no2: h.nitrogen_dioxide?.[idx] ?? null,
        o3: h.ozone?.[idx] ?? null,
        so2: h.sulphur_dioxide?.[idx] ?? null,
        co: h.carbon_monoxide?.[idx] ?? null,
      } : null;
      cacheSet(key, data, ttlMs);
      return data;
    }
  },
  'email': {
    async fetchData(config) {
      const action = config.action || 'list';
      const host = config.host || getSecret('IMAP_HOST');
      const port = Number(config.port || getSecret('IMAP_PORT') || 993);
      const secure = (typeof config.secure === 'boolean') ? config.secure : String(getSecret('IMAP_SECURE') || 'true') === 'true';
      const user = config.user || getSecret('IMAP_USER');
      const pass = config.password || getSecret('IMAP_PASSWORD');
      const mailbox = config.mailbox || getSecret('IMAP_MAILBOX') || 'INBOX';
      const limit = Number(config.limit || 20);
      if (!host || !user || !pass) throw new Error('IMAP credentials missing. Provide via env/SECRETS_FILE or widget props.');

      let ImapFlow;
      try { ({ ImapFlow } = await import('imapflow')); }
      catch { throw new Error('Missing dependency imapflow. Please install it with: npm --workspace server install imapflow'); }

      const client = new ImapFlow({ host, port, secure, auth: { user, pass } });
      try {
        await client.connect();
        await client.mailboxOpen(mailbox);

        if (action === 'markRead') {
          if (!config.uid) throw new Error('markRead requires uid');
          await client.messageFlagsAdd({ uid: Number(config.uid) }, ['\\Seen']);
          return { ok: true };
        }

        if (action === 'getBody') {
          if (!config.uid) throw new Error('getBody requires uid');
          let raw = '';
          for await (const msg of client.fetch({ uid: Number(config.uid) }, { source: true, envelope: true, internalDate: true })) {
            const chunks = [];
            for await (const chunk of msg.source) chunks.push(chunk);
            raw = Buffer.concat(chunks).toString('utf8');
            const env = msg.envelope;
            let parsed = { text: null, html: null };
            try {
              const mp = await import('mailparser');
              const parsedMail = await mp.simpleParser(raw);
              parsed = { text: parsedMail.text || null, html: parsedMail.html || null };
            } catch {}
            return {
              uid: Number(config.uid),
              subject: env?.subject || '',
              from: env?.from?.map(a => a.address || a.name).join(', ') || '',
              date: msg.internalDate,
              ...parsed,
              raw: parsed.html || parsed.text ? undefined : raw.slice(0, 20000),
            };
          }
          return { uid: Number(config.uid) };
        }

        // List unread messages
        const uids = await client.search({ seen: false });
        const u = uids.slice(-limit).reverse();
        const out = [];
        for await (const msg of client.fetch(u, { uid: true, envelope: true, internalDate: true, flags: true })) {
          const env = msg.envelope;
          out.push({
            uid: msg.uid,
            subject: env?.subject || '(no subject)',
            from: (env?.from || []).map(a => a.name || a.address).filter(Boolean).join(', '),
            date: msg.internalDate,
            seen: (msg.flags || []).includes('\\Seen'),
          });
        }
        return out;
      } finally {
        try { await client.logout(); } catch {}
      }
    }
  },
  'youtube-subscriptions': {
    async fetchData(config) {
      const limit = Number(config.limit || 20);
      const clientId = config.clientId || getSecret('YT_CLIENT_ID');
      const clientSecret = config.clientSecret || getSecret('YT_CLIENT_SECRET');
      const refreshToken = config.refreshToken || getSecret('YT_REFRESH_TOKEN');
      if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('YouTube credentials missing. Provide YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN');
      }
      let google;
      try { ({ google } = await import('googleapis')); }
      catch { throw new Error('Missing dependency googleapis. Please install it with: npm --workspace server install googleapis'); }

      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      // Get channel IDs from subscriptions
      const subs = await youtube.subscriptions.list({ part: ['snippet','contentDetails'], mine: true, maxResults: 50 });
      const channels = (subs.data.items || []).map(it => it.snippet?.resourceId?.channelId).filter(Boolean);
      // Fetch recent uploads per channel via search (faster than playlist traversal for a quick sample)
      const items = [];
      for (const ch of channels) {
        const res = await youtube.search.list({ part: ['snippet'], channelId: ch, order: 'date', maxResults: 2, type: ['video'] });
        for (const v of res.data.items || []) {
          items.push({
            videoId: v.id?.videoId,
            title: v.snippet?.title,
            channelTitle: v.snippet?.channelTitle,
            publishedAt: v.snippet?.publishedAt,
            thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url,
            url: v.id?.videoId ? `https://www.youtube.com/watch?v=${v.id.videoId}` : null,
          });
        }
        if (items.length >= limit * 2) break; // early cutoff
      }
      // Merge, sort by publishedAt desc, deduplicate by videoId
      const seen = new Set();
      const merged = items
        .sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt))
        .filter(it => { if (!it.videoId || seen.has(it.videoId)) return false; seen.add(it.videoId); return true; })
        .slice(0, limit);
      return merged;
    }
  },
};

app.get('/api/dashboards', (req, res) => {
  try {
    const files = fs.readdirSync(dashboardsDir)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json'))
      .map(f => f.replace(/\.(yaml|yml|json)$/i, ''));
    res.json({ dashboards: files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dashboards/:name', (req, res) => {
  try {
    const cfg = loadDashboardConfig(req.params.name);
    res.json(cfg);
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// Data endpoint for widgets: /api/widget/:type
app.post('/api/widget/:type', async (req, res) => {
  try {
    const type = req.params.type;
    const plugin = plugins[type];
    if (!plugin) return res.status(404).json({ error: 'Unknown widget type' });
    const data = await plugin.fetchData(req.body || {});
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// In production, optionally serve built frontend
if (process.env.SERVE_WEB === 'true') {
  const distDir = path.resolve(process.cwd(), 'web', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

