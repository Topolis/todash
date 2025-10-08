import { CronJob } from 'cron';
import { logger } from '@lib/logger';
import type { ScriptConfig, TimedScriptsConfig, ScriptStatus, TimedScriptsData } from './types';

// Re-export types for convenience
export type { ScriptConfig, TimedScriptsConfig, ScriptStatus, TimedScriptsData };

// Store active cron jobs and their status
const activeCronJobs = new Map<string, { job: CronJob; lastRun?: number }>();
const scriptConfigs = new Map<string, ScriptConfig>();

/**
 * Command registry - maps command names to handler functions
 */
const commandHandlers = new Map<string, (params: any[]) => Promise<void>>();

/**
 * Register a command handler
 */
export function registerCommand(name: string, handler: (params: any[]) => Promise<void>) {
  commandHandlers.set(name, handler);
  logger.info('TimedScripts', `Registered command: ${name}`);
}

/**
 * Execute a single command
 */
async function executeCommand(commandName: string, params: any[]): Promise<void> {
  const handler = commandHandlers.get(commandName);
  if (!handler) {
    throw new Error(`Unknown command: ${commandName}`);
  }
  
  logger.info('TimedScripts', `Executing command: ${commandName}`, { params });
  await handler(params);
}

/**
 * Execute a script (array of commands)
 */
export async function executeScript(script: Array<Record<string, any[]>>): Promise<void> {
  for (const commandObj of script) {
    const [commandName, params] = Object.entries(commandObj)[0];
    await executeCommand(commandName, params);
  }
}

/**
 * Get unique key for a script
 */
function getScriptKey(config: ScriptConfig): string {
  return `${config.title}:${config.cron}`;
}

/**
 * Start a cron job for a script
 */
function startCronJob(config: ScriptConfig, force: boolean = false): void {
  const key = getScriptKey(config);

  // Check if job already exists and config hasn't changed
  const existingConfig = scriptConfigs.get(key);
  if (!force && existingConfig &&
      existingConfig.enabled === config.enabled &&
      JSON.stringify(existingConfig.script) === JSON.stringify(config.script)) {
    // Job already exists with same config, no need to restart
    return;
  }

  // Stop existing job if any
  stopCronJob(key);

  if (!config.enabled) {
    return;
  }

  try {
    const job = new CronJob(
      config.cron,
      async () => {
        logger.info('TimedScripts', `Running scheduled script: ${config.title}`);
        const jobInfo = activeCronJobs.get(key);

        try {
          await executeScript(config.script);
          logger.info('TimedScripts', `Script "${config.title}" completed successfully`);

          // Update last run time
          if (jobInfo) {
            jobInfo.lastRun = Date.now();
          }
        } catch (error) {
          logger.error('TimedScripts', `Script "${config.title}" failed`, error);
        }
      },
      null, // onComplete
      true, // start immediately
      'Europe/Berlin' // timezone - adjust as needed
    );

    activeCronJobs.set(key, { job });
    scriptConfigs.set(key, config);

    logger.info('TimedScripts', `Scheduled script: ${config.title} (${config.cron})`);
  } catch (error) {
    logger.error('TimedScripts', `Failed to schedule script: ${config.title}`, error);
  }
}

/**
 * Stop a cron job
 */
function stopCronJob(key: string): void {
  const existing = activeCronJobs.get(key);
  if (existing) {
    existing.job.stop();
    activeCronJobs.delete(key);
    scriptConfigs.delete(key);
  }
}

/**
 * Initialize/update cron jobs based on configuration
 */
export function updateCronJobs(configs: ScriptConfig[]): void {
  // Get current keys
  const newKeys = new Set(configs.map(getScriptKey));
  const existingKeys = new Set(activeCronJobs.keys());
  
  // Stop jobs that are no longer in config
  for (const key of existingKeys) {
    if (!newKeys.has(key)) {
      logger.info('TimedScripts', `Removing script: ${key}`);
      stopCronJob(key);
    }
  }
  
  // Start/update jobs
  for (const config of configs) {
    startCronJob(config);
  }
}

/**
 * Fetch timed scripts data
 */
export async function fetchTimedScriptsData(config: TimedScriptsConfig): Promise<TimedScriptsData> {
  const scripts: ScriptStatus[] = [];
  
  if (!config.scripts) {
    return { scripts };
  }
  
  // Update cron jobs based on current config
  updateCronJobs(config.scripts);
  
  // Build status for each script
  for (const scriptConfig of config.scripts) {
    const key = getScriptKey(scriptConfig);
    const jobInfo = activeCronJobs.get(key);
    
    let nextRun: number | undefined;
    if (jobInfo && scriptConfig.enabled) {
      try {
        const nextDate = jobInfo.job.nextDate();
        if (nextDate) {
          nextRun = nextDate.toMillis();
        }
      } catch (e) {
        // Ignore errors getting next run time
      }
    }
    
    scripts.push({
      title: scriptConfig.title,
      cron: scriptConfig.cron,
      enabled: scriptConfig.enabled,
      lastRun: jobInfo?.lastRun,
      nextRun,
    });
  }
  
  return { scripts };
}

/**
 * Toggle a script on/off
 */
export async function toggleScript(title: string, enabled: boolean): Promise<void> {
  // Find the script config
  for (const [key, config] of scriptConfigs.entries()) {
    if (config.title === title) {
      config.enabled = enabled;
      
      if (enabled) {
        startCronJob(config);
      } else {
        stopCronJob(key);
      }
      
      logger.info('TimedScripts', `Script "${title}" ${enabled ? 'enabled' : 'disabled'}`);
      return;
    }
  }
  
  throw new Error(`Script not found: ${title}`);
}

/**
 * Manually trigger a script
 */
export async function triggerScript(title: string): Promise<void> {
  for (const config of scriptConfigs.values()) {
    if (config.title === title) {
      logger.info('TimedScripts', `Manually triggering script: ${title}`);
      await executeScript(config.script);
      
      // Update last run time
      const key = getScriptKey(config);
      const jobInfo = activeCronJobs.get(key);
      if (jobInfo) {
        jobInfo.lastRun = Date.now();
      }
      
      return;
    }
  }
  
  throw new Error(`Script not found: ${title}`);
}

/**
 * Shutdown all cron jobs
 */
export function shutdownCronJobs(): void {
  logger.info('TimedScripts', 'Shutting down all cron jobs');
  for (const key of activeCronJobs.keys()) {
    stopCronJob(key);
  }
}

// Graceful shutdown (server-side only)
if (typeof process !== 'undefined') {
  process.on('SIGINT', () => {
    shutdownCronJobs();
  });

  process.on('SIGTERM', () => {
    shutdownCronJobs();
  });
}

