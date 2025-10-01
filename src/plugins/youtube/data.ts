import { getSecret } from '@server/secrets';

export interface YouTubeConfig {
  limit?: number;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  thumbnail?: string;
  url: string;
}

export type YouTubeData = YouTubeVideo[];

export async function fetchYouTubeData(config: YouTubeConfig): Promise<YouTubeData> {
  const limit = Number(config.limit || 20);
  const clientId = config.clientId || getSecret('YT_CLIENT_ID');
  const clientSecret = config.clientSecret || getSecret('YT_CLIENT_SECRET');
  const refreshToken = config.refreshToken || getSecret('YT_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('YouTube credentials missing. Provide YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN');
  }

  let google: any;
  try {
    const module = await import('googleapis');
    google = module.google;
  } catch {
    throw new Error('Missing dependency googleapis. Please install it with: npm install googleapis');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  // Get channel IDs from subscriptions
  const subs = await youtube.subscriptions.list({
    part: ['snippet', 'contentDetails'],
    mine: true,
    maxResults: 50,
  });

  const channels = (subs.data.items || [])
    .map((it: any) => it.snippet?.resourceId?.channelId)
    .filter(Boolean);

  // Fetch recent uploads per channel via search (faster than playlist traversal for a quick sample)
  const items: YouTubeVideo[] = [];

  for (const ch of channels) {
    const res = await youtube.search.list({
      part: ['snippet'],
      channelId: ch,
      order: 'date',
      maxResults: 2,
      type: ['video'],
    });

    for (const v of res.data.items || []) {
      items.push({
        videoId: v.id?.videoId || '',
        title: v.snippet?.title || '',
        channelTitle: v.snippet?.channelTitle || '',
        publishedAt: v.snippet?.publishedAt || '',
        thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url,
        url: v.id?.videoId ? `https://www.youtube.com/watch?v=${v.id.videoId}` : '',
      });
    }

    if (items.length >= limit * 2) break; // early cutoff
  }

  // Merge, sort by publishedAt desc, deduplicate by videoId
  const seen = new Set<string>();
  const merged = items
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .filter((it) => {
      if (!it.videoId || seen.has(it.videoId)) return false;
      seen.add(it.videoId);
      return true;
    })
    .slice(0, limit);

  return merged;
}
