import { WidgetConfig } from './dashboard';

/**
 * Base panel configuration shared by all panel types
 */
export interface BasePanelConfig {
  // Panel type discriminator
  panelType: 'single' | 'tabbed' | 'stacked' | 'grid';
  
  // Grid position (1-based)
  x?: number;
  y?: number;
  
  // Grid span
  w?: number;
  h?: number;
  
  // Additional properties for future extensions
  [key: string]: any;
}

/**
 * Single widget panel - 1:1 widget to panel relationship
 * This is the current default behavior
 */
export interface SinglePanelConfig extends BasePanelConfig {
  panelType: 'single';
  
  // The single widget to display
  widget: WidgetConfig;
}

/**
 * Tabbed panel - Multiple widgets displayed as tabs
 * Tabs are shown in the panel header, only one widget visible at a time
 */
export interface TabbedPanelConfig extends BasePanelConfig {
  panelType: 'tabbed';
  
  // Array of widgets to display as tabs
  widgets: WidgetConfig[];
  
  // Index of the default active tab (0-based)
  defaultTab?: number;
  
  // Optional: persist active tab in local storage
  persistActiveTab?: boolean;
}

/**
 * Stacked panel - Multiple widgets stacked vertically
 * (Future implementation)
 */
export interface StackedPanelConfig extends BasePanelConfig {
  panelType: 'stacked';
  
  // Array of widgets to stack vertically
  widgets: WidgetConfig[];
  
  // Optional: spacing between stacked widgets
  spacing?: number;
}

/**
 * Grid panel - Multiple widgets in a sub-grid layout
 * (Future implementation)
 */
export interface GridPanelConfig extends BasePanelConfig {
  panelType: 'grid';
  
  // Array of widgets with their own grid positions
  widgets: (WidgetConfig & {
    // Position within the panel's sub-grid
    gridX?: number;
    gridY?: number;
    gridW?: number;
    gridH?: number;
  })[];
  
  // Sub-grid configuration
  gridConfig?: {
    columns?: number;
    rows?: number;
    gap?: number;
  };
}

/**
 * Union type for all panel configurations
 */
export type PanelConfig = 
  | SinglePanelConfig 
  | TabbedPanelConfig 
  | StackedPanelConfig 
  | GridPanelConfig;

/**
 * Type guard to check if a panel is a single widget panel
 */
export function isSinglePanel(panel: PanelConfig): panel is SinglePanelConfig {
  return panel.panelType === 'single';
}

/**
 * Type guard to check if a panel is a tabbed panel
 */
export function isTabbedPanel(panel: PanelConfig): panel is TabbedPanelConfig {
  return panel.panelType === 'tabbed';
}

/**
 * Type guard to check if a panel is a stacked panel
 */
export function isStackedPanel(panel: PanelConfig): panel is StackedPanelConfig {
  return panel.panelType === 'stacked';
}

/**
 * Type guard to check if a panel is a grid panel
 */
export function isGridPanel(panel: PanelConfig): panel is GridPanelConfig {
  return panel.panelType === 'grid';
}

/**
 * Helper to get all widgets from any panel type
 */
export function getPanelWidgets(panel: PanelConfig): WidgetConfig[] {
  switch (panel.panelType) {
    case 'single':
      return [panel.widget];
    case 'tabbed':
    case 'stacked':
      return panel.widgets;
    case 'grid':
      return panel.widgets;
    default:
      return [];
  }
}

/**
 * Helper to migrate a widget config to a single panel config
 */
export function widgetToPanelConfig(widget: WidgetConfig): SinglePanelConfig {
  const { x, y, w, h, ...widgetProps } = widget;
  return {
    panelType: 'single',
    x,
    y,
    w,
    h,
    widget: widgetProps,
  };
}

/**
 * Helper to migrate an array of widgets to panel configs
 */
export function widgetsToPanelConfigs(widgets: WidgetConfig[]): PanelConfig[] {
  return widgets.map(widgetToPanelConfig);
}

