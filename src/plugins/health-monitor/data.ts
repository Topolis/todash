// ABOUTME: Server-side data provider for health monitoring plugin
// Performs HTTP health checks on configured services

import { logger } from '../../lib/logger';

/**
 * Service health check configuration
 */
export interface HealthService {
  title: string;
  url: string;
  checkInterval?: number; // seconds between checks
  expectedStatus?: number; // expected HTTP status code (default: 200-299 range)
  method?: 'HEAD' | 'GET' | 'POST'; // HTTP method (default: HEAD)
  bodyRegex?: string | string[]; // regex pattern(s) to match in response body - all must match
  timeout?: number; // timeout in ms for this specific service
}

/**
 * Health monitor plugin configuration
 */
export interface HealthMonitorConfig {
  services: HealthService[];
  timeout?: number; // global timeout in ms (default: 5000)
  retries?: number; // number of retries on failure (default: 1)
  refreshSeconds?: number; // widget refresh interval
}

/**
 * Service health check result
 */
export interface HealthCheckResult {
  title: string;
  url: string;
  status: 'up' | 'down' | 'degraded';
  statusCode?: number;
  responseTime?: number; // in ms
  lastCheck: string; // ISO timestamp
  error?: string;
  checkInterval?: number;
}

/**
 * Health monitor data response
 */
export interface HealthMonitorData {
  services: HealthCheckResult[];
  timestamp: string;
}

interface CachedHealthCheck {
  result: HealthCheckResult;
  checkedAtMs: number;
}

const serviceCheckCache = new Map<string, CachedHealthCheck>();
const serviceCheckInFlight = new Map<string, Promise<HealthCheckResult>>();

function getServiceCacheKey(service: HealthService, globalTimeout: number, retries: number): string {
  return JSON.stringify({
    title: service.title,
    url: service.url,
    method: service.method || 'HEAD',
    expectedStatus: service.expectedStatus,
    bodyRegex: service.bodyRegex,
    timeout: service.timeout || globalTimeout,
    checkInterval: service.checkInterval,
    retries,
  });
}

function getIntervalMs(service: HealthService): number {
  const intervalSeconds = Number(service.checkInterval);
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    return 0;
  }
  return Math.floor(intervalSeconds * 1000);
}

/**
 * Perform a single health check on a service
 */
async function checkService(
  service: HealthService,
  globalTimeout: number,
  retries: number
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const timeout = service.timeout || globalTimeout;
  const method = service.method || 'HEAD';
  const expectedStatus = service.expectedStatus;

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(service.url, {
        method,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Todash-Health-Monitor/1.0',
        },
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const statusCode = response.status;

      // Check status code
      const statusOk = expectedStatus
        ? statusCode === expectedStatus
        : statusCode >= 200 && statusCode < 300;

      // Check body regex if provided
      let bodyOk = true;
      if (service.bodyRegex && (method === 'GET' || method === 'POST')) {
        try {
          const body = await response.text();
          const patterns = Array.isArray(service.bodyRegex) ? service.bodyRegex : [service.bodyRegex];
          
          // All patterns must match
          for (const pattern of patterns) {
            const regex = new RegExp(pattern, 'i'); // case-insensitive
            if (!regex.test(body)) {
              bodyOk = false;
              logger.warn('health-monitor', `Body regex check failed for ${service.title}: pattern "${pattern}" not found`);
              break;
            }
          }
        } catch (e) {
          logger.error('health-monitor', `Error checking body regex for ${service.title}`, e);
          bodyOk = false;
        }
      } else if (service.bodyRegex && method === 'HEAD') {
        logger.warn('health-monitor', `Cannot check body regex with HEAD method for ${service.title}, use GET instead`);
      }

      const status = statusOk && bodyOk ? 'up' : 'degraded';

      return {
        title: service.title,
        url: service.url,
        status,
        statusCode,
        responseTime,
        lastCheck: new Date().toISOString(),
        checkInterval: service.checkInterval,
        error: statusOk && bodyOk ? undefined : `Status: ${statusCode}${!bodyOk ? ', body regex mismatch' : ''}`,
      };
    } catch (error: any) {
      lastError = error;
      attempt++;

      if (attempt <= retries) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // All retries failed
  const responseTime = Date.now() - startTime;
  const errorMessage = lastError?.name === 'AbortError'
    ? `Timeout after ${timeout}ms`
    : lastError?.message || 'Unknown error';

  logger.warn('health-monitor', `Health check failed for ${service.title}: ${errorMessage}`);

  return {
    title: service.title,
    url: service.url,
    status: 'down',
    responseTime,
    lastCheck: new Date().toISOString(),
    checkInterval: service.checkInterval,
    error: errorMessage,
  };
}

async function checkServiceWithInterval(
  service: HealthService,
  globalTimeout: number,
  retries: number
): Promise<HealthCheckResult> {
  const intervalMs = getIntervalMs(service);
  const cacheKey = getServiceCacheKey(service, globalTimeout, retries);
  const now = Date.now();

  if (intervalMs > 0) {
    const cached = serviceCheckCache.get(cacheKey);
    if (cached && now - cached.checkedAtMs < intervalMs) {
      return cached.result;
    }
  }

  const inFlight = serviceCheckInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const nextCheck = checkService(service, globalTimeout, retries)
    .then((result) => {
      serviceCheckCache.set(cacheKey, {
        result,
        checkedAtMs: Date.parse(result.lastCheck) || Date.now(),
      });
      return result;
    })
    .finally(() => {
      serviceCheckInFlight.delete(cacheKey);
    });

  serviceCheckInFlight.set(cacheKey, nextCheck);
  return nextCheck;
}

/**
 * Fetch health monitor data
 */
export async function fetchHealthMonitorData(
  config: HealthMonitorConfig
): Promise<HealthMonitorData> {
  const { services = [], timeout = 5000, retries = 1 } = config;

  // Perform all health checks in parallel
  const results = await Promise.all(
    services.map(service => checkServiceWithInterval(service, timeout, retries))
  );

  return {
    services: results,
    timestamp: new Date().toISOString(),
  };
}
