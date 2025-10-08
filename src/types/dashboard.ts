/**
 * Grid configuration for dashboard layout
 */
export interface GridConfig {
  columns?: number;
  gap?: number;
  rowHeight?: number;
}

/**
 * Widget placement and configuration
 */
export interface WidgetConfig {
  // Widget type (must match plugin name)
  type: string;
  
  // Display title
  title?: string;
  
  // Display subtitle
  subtitle?: string;
  
  // Grid position (1-based)
  x?: number;
  y?: number;
  
  // Grid span
  w?: number;
  h?: number;
  
  // Refresh interval in seconds (overrides plugin default)
  refreshSeconds?: number;
  
  // Widget-specific configuration
  props?: Record<string, any>;
  
  // Additional properties
  [key: string]: any;
}

/**
 * Dashboard settings
 */
export interface DashboardSettings {
  // Date format string (e.g., "DD.MM.YYYY HH:mm")
  dateFormat?: string;

  // Default location for weather widgets
  defaultLocation?: {
    latitude: number;
    longitude: number;
  };

  // API keys for external services
  apiKeys?: {
    unsplash?: string;
    [key: string]: string | undefined;
  };

  // Additional settings
  [key: string]: any;
}

/**
 * Dashboard theme configuration
 */
export interface DashboardTheme {
  panel?: {
    opacity?: number;
    background?: string;
  };
}

/**
 * Complete dashboard configuration
 */
export interface DashboardConfig {
  // Dashboard title (from YAML)
  title?: string;

  // Dashboard name/identifier (deprecated, use title)
  name?: string;

  // Whether this dashboard is enabled (shows in selector)
  enabled?: boolean;

  // Grid layout configuration
  grid?: GridConfig;

  // List of panels
  panels?: any[]; // Import from panel.ts to avoid circular dependency

  // Dashboard-wide settings
  settings?: DashboardSettings;

  // Theme configuration
  theme?: DashboardTheme;

  // Wallpaper configuration
  wallpaper?: {
    type: string;
    props?: any;
  };
}

/**
 * Dashboard list item
 */
export interface DashboardListItem {
  filename: string;
  title?: string;
  enabled?: boolean;
}

/**
 * API response for dashboard list
 */
export interface DashboardListResponse {
  dashboards: DashboardListItem[];
}

/**
 * API response for dashboard data
 */
export interface DashboardDataResponse {
  config: DashboardConfig;
}
