import type { PluginDefinition } from '@types/plugin';
import LinksWidget from './widget';
import { fetchLinksData, type LinksConfig, type LinksData } from './data';

export const linksPlugin: PluginDefinition<LinksConfig, LinksData> = {
  name: 'links-list',
  displayName: 'Links',
  description: 'Display a list of quick links',
  widget: LinksWidget,
  dataProvider: fetchLinksData,
  serverSide: false, // No server-side data needed
  defaultConfig: {
    items: [],
    allowEdit: true,
    layout: 'list',
  },
};
