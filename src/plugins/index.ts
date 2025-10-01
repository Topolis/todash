import type { PluginDefinition, PluginRegistry } from '@types/plugin';

/**
 * Plugin registry
 * Plugins are registered here and can be accessed by type name
 */
const plugins: PluginRegistry = {};

/**
 * Register a plugin
 */
export function registerPlugin(plugin: PluginDefinition<any, any>): void {
  plugins[plugin.name] = plugin;
}

/**
 * Get a plugin by type name
 */
export function getPlugin(typeName: string): PluginDefinition | undefined {
  return plugins[typeName];
}

/**
 * Get all registered plugins
 */
export function getAllPlugins(): PluginRegistry {
  return { ...plugins };
}

/**
 * Get all plugin type names
 */
export function getPluginNames(): string[] {
  return Object.keys(plugins);
}

/**
 * Check if a plugin is registered
 */
export function hasPlugin(typeName: string): boolean {
  return typeName in plugins;
}

// Export plugin registry for direct access (read-only)
export { plugins };
