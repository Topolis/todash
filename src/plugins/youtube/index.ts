import type { PluginDefinition } from '@types/plugin';
import YouTubeWidget from './widget';

export type { YouTubeConfig, YouTubeData, YouTubeVideo } from './data';

export const youtubePlugin: PluginDefinition<any, any> = {
  name: 'youtube-subscriptions',
  displayName: 'YouTube Subscriptions',
  description: 'Display recent videos from YouTube subscriptions',
  widget: YouTubeWidget as any,
  serverSide: true,
  defaultRefreshInterval: 600,
  defaultConfig: {
    limit: 12,
  },
};
