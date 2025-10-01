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
  
  // Additional settings
  [key: string]: any;
}

/**
 * Complete dashboard configuration
 */
export interface DashboardConfig {
  // Dashboard name/identifier
  name?: string;

  // Grid layout configuration
  grid?: GridConfig;

  // List of panels
  panels?: any[]; // Import from panel.ts to avoid circular dependency

  // Dashboard-wide settings
  settings?: DashboardSettings;
}

/**
 * API response for dashboard list
 */
export interface DashboardListResponse {
  dashboards: string[];
}

/**
 * API response for dashboard data
 */
export interface DashboardDataResponse {
  config: DashboardConfig;
}
