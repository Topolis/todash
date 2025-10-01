import type { WidgetConfig } from '@types/dashboard';
import type { PanelConfig, SinglePanelConfig } from '@types/panel';

/**
 * Migrate a widget config to a single panel config
 */
export function widgetToPanel(widget: WidgetConfig): SinglePanelConfig {
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
 * Migrate an array of widgets to panel configs
 */
export function widgetsToPanels(widgets: WidgetConfig[]): PanelConfig[] {
  return widgets.map(widgetToPanel);
}

/**
 * Normalize dashboard config to use panels
 * Handles both old (widgets) and new (panels) formats
 */
export function normalizeDashboardConfig(config: any): PanelConfig[] {
  // If panels exist, use them
  if (config.panels && Array.isArray(config.panels)) {
    return config.panels;
  }
  
  // If widgets exist, convert them to panels
  if (config.widgets && Array.isArray(config.widgets)) {
    return widgetsToPanels(config.widgets);
  }
  
  // No widgets or panels
  return [];
}

/**
 * Check if a config item is a panel (has panelType) or a widget
 */
export function isPanel(item: any): item is PanelConfig {
  return item && typeof item === 'object' && 'panelType' in item;
}

/**
 * Check if a config item is a widget (has type but no panelType)
 */
export function isWidget(item: any): item is WidgetConfig {
  return item && typeof item === 'object' && 'type' in item && !('panelType' in item);
}

/**
 * Normalize a mixed array of widgets and panels
 */
export function normalizeMixedLayout(items: any[]): PanelConfig[] {
  return items.map(item => {
    if (isPanel(item)) {
      return item;
    }
    if (isWidget(item)) {
      return widgetToPanel(item);
    }
    // Unknown item type, skip it
    console.warn('Unknown layout item type:', item);
    return null;
  }).filter((item): item is PanelConfig => item !== null);
}

