import Parser from 'rss-parser';

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

export const rssPlugin = {
  async fetchData(config) {
    const { cacheGet, cacheSet } = await import('../cache.js');
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
};
