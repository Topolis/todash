import type { PluginDefinition } from '@types/plugin';
import RSSWidget from './widget';

export type { RSSConfig, RSSData, RSSItem } from './data';

export const rssPlugin: PluginDefinition<any, any> = {
  name: 'rss-feed',
  displayName: 'RSS Feed',
  description: 'Display RSS feed items from one or more feeds',
  widget: RSSWidget as any,
  serverSide: true,
  defaultRefreshInterval: 300,
  defaultConfig: {
    limit: 10,
    layout: 'list',
  },
};
