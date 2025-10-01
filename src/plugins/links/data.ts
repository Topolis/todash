/**
 * Links plugin - no server-side data needed
 * All data comes from the configuration
 */

export interface LinkItem {
  label?: string;
  url: string;
  icon?: string;
}

export interface LinkGroup {
  label?: string;
  items: LinkItem[];
}

export interface LinksConfig {
  items?: LinkItem[];
  groups?: LinkGroup[];
  allowEdit?: boolean;
  layout?: 'list' | 'square';
  squareMin?: number;
  squareGap?: number;
}

export interface LinksData {
  // No server-side data needed
  config: LinksConfig;
}

/**
 * Links plugin doesn't need server-side data fetching
 * It just displays static links from the configuration
 */
export async function fetchLinksData(config: LinksConfig): Promise<LinksData> {
  return { config };
}
