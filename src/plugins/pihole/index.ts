/**
 * Pi-hole Plugin
 * 
 * This plugin provides value functions for Pi-hole statistics only.
 * It does not provide a widget component - use the status widget
 * to display Pi-hole data.
 * 
 * Available value functions:
 * - pihole-ads-blocked-today
 * - pihole-dns-queries-today
 * - pihole-ads-percentage-today
 * - pihole-domains-being-blocked
 * - pihole-unique-clients
 * - pihole-queries-forwarded
 * - pihole-queries-cached
 * - pihole-status-enabled
 * 
 * All value functions accept config parameters:
 * - baseUrl: Pi-hole base URL (e.g., "http://192.168.1.1")
 * - token: Optional API token for authentication
 * - apiPath: Optional custom API path (e.g., "/admin/api.php")
 */

// This plugin only provides value functions, no widget
// The data provider is imported in src/server/plugins.ts

