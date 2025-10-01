import { ComponentType } from 'react';

/**
 * Generic plugin configuration
 */
export interface PluginConfig {
  [key: string]: any;
}

/**
 * Data provider function that fetches data for a plugin
 */
export interface PluginDataProvider<TConfig = PluginConfig, TData = any> {
  (config: TConfig): Promise<TData>;
}

/**
 * Props passed to plugin widget components
 */
export interface PluginWidgetProps<TConfig = PluginConfig, TData = any> {
  // Configuration from YAML
  config?: TConfig;
  
  // Data fetched from data provider
  data?: TData;
  
  // Loading state
  loading?: boolean;
  
  // Error message if data fetch failed
  error?: string | null;
  
  // Signal to trigger refresh (incremented on manual refresh)
  refreshSignal?: number;
  
  // Callback to trigger refresh
  onRefresh?: () => void;
  
  // Widget ID for event handling
  wid?: string;
  
  // Callback to persist prop changes
  onChangePropsPersist?: (newProps: Partial<TConfig>) => void;
  
  // Any additional props from YAML config
  [key: string]: any;
}

/**
 * Complete plugin definition
 */
export interface PluginDefinition<TConfig = PluginConfig, TData = any> {
  // Unique plugin identifier (matches YAML type)
  name: string;
  
  // Human-readable display name
  displayName: string;
  
  // Plugin description
  description?: string;
  
  // React component to render the widget
  widget: ComponentType<PluginWidgetProps<TConfig, TData>>;

  // Data provider function (optional - can be added on server side)
  dataProvider?: PluginDataProvider<TConfig, TData>;

  // Whether data provider must run on server (true) or can run in browser (false)
  serverSide: boolean;
  
  // Default configuration values
  defaultConfig?: Partial<TConfig>;
  
  // JSON schema for config validation
  configSchema?: any;
  
  // Refresh interval in seconds (0 = no auto-refresh)
  defaultRefreshInterval?: number;
}

/**
 * Plugin registry mapping type names to definitions
 */
export interface PluginRegistry {
  [typeName: string]: PluginDefinition<any, any>;
}

/**
 * Value function for status widget
 */
export interface ValueFunction {
  (config: any): Promise<any>;
}

/**
 * Value functions registry
 */
export interface ValueFunctionsRegistry {
  [name: string]: ValueFunction;
}
