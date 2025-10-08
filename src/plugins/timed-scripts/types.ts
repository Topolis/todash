/**
 * Script configuration
 */
export interface ScriptConfig {
  title: string;
  cron: string;
  enabled: boolean;
  script: Array<Record<string, any[]>>;
}

/**
 * Widget configuration
 */
export interface TimedScriptsConfig {
  scripts?: ScriptConfig[];
}

/**
 * Script status for display
 */
export interface ScriptStatus {
  title: string;
  cron: string;
  enabled: boolean;
  lastRun?: number; // Timestamp in milliseconds
  nextRun?: number; // Timestamp in milliseconds
}

/**
 * Widget data
 */
export interface TimedScriptsData {
  scripts: ScriptStatus[];
}

