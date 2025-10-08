import { Driver } from 'zwave-js';
import { getSecret } from '@server/secrets';
import { logger } from '@lib/logger';

/**
 * Shared Z-Wave service singleton
 * Manages a single Z-Wave driver instance shared across all widgets
 */

let driverInstance: Driver | null = null;
let driverInitializing = false;
let initializationPromise: Promise<Driver> | null = null;
let lastAddedNodeId: number | null = null;
let lastAddedNodeTime: number | null = null;
let driverReadyCallbacks: Array<() => void> = [];
let valueUpdateCallbacks: Array<(nodeId: number) => void> = [];

export interface ZWaveConfig {
  serialPort?: string;
  networkKey?: string;
  securityKeys?: {
    S0_Legacy?: string;
    S2_Unauthenticated?: string;
    S2_Authenticated?: string;
    S2_AccessControl?: string;
  };
}

/**
 * Get Z-Wave configuration from secrets or environment
 */
function getZWaveConfig(): ZWaveConfig {
  const serialPort = getSecret('ZWAVE_SERIAL_PORT');
  const networkKey = getSecret('ZWAVE_NETWORK_KEY');

  const config: ZWaveConfig = {
    serialPort,
  };

  // Legacy S0 key
  if (networkKey) {
    config.networkKey = networkKey;
  }

  // S2 security keys (optional)
  const s2Keys = {
    S0_Legacy: getSecret('ZWAVE_S0_KEY'),
    S2_Unauthenticated: getSecret('ZWAVE_S2_UNAUTH_KEY'),
    S2_Authenticated: getSecret('ZWAVE_S2_AUTH_KEY'),
    S2_AccessControl: getSecret('ZWAVE_S2_ACCESS_KEY'),
  };

  // Only add security keys if at least one is defined
  if (Object.values(s2Keys).some(k => k)) {
    config.securityKeys = s2Keys as any;
  }

  return config;
}

/**
 * Initialize the Z-Wave driver
 */
async function initializeDriver(): Promise<Driver> {
  if (driverInstance) {
    return driverInstance;
  }

  if (driverInitializing && initializationPromise) {
    logger.info('ZWave', 'Driver initialization already in progress, waiting...');
    return initializationPromise;
  }

  driverInitializing = true;
  
  initializationPromise = (async () => {
    try {
      const config = getZWaveConfig();

      if (!config.serialPort) {
        const error = new Error('Z-Wave serial port not configured. Set ZWAVE_SERIAL_PORT in secrets.json or environment variable.');
        logger.warn('ZWave', 'Z-Wave driver not initialized: No serial port configured');
        logger.warn('ZWave', 'To use Z-Wave features, set ZWAVE_SERIAL_PORT in secrets.json (e.g., "/dev/ttyUSB0" or "/dev/ttyACM0")');
        driverInitializing = false;
        initializationPromise = null;
        throw error;
      }

      logger.info('ZWave', `Initializing Z-Wave driver on ${config.serialPort}`);

      const driverConfig: any = {
        port: config.serialPort,
        logConfig: {
          enabled: true,
          level: 'info',
          logToFile: false,
        },
      };

      // Add security keys if configured
      if (config.networkKey) {
        driverConfig.securityKeys = {
          S0_Legacy: Buffer.from(config.networkKey, 'hex'),
        };
      }

      if (config.securityKeys) {
        driverConfig.securityKeys = driverConfig.securityKeys || {};
        if (config.securityKeys.S2_Unauthenticated) {
          driverConfig.securityKeys.S2_Unauthenticated = Buffer.from(config.securityKeys.S2_Unauthenticated, 'hex');
        }
        if (config.securityKeys.S2_Authenticated) {
          driverConfig.securityKeys.S2_Authenticated = Buffer.from(config.securityKeys.S2_Authenticated, 'hex');
        }
        if (config.securityKeys.S2_AccessControl) {
          driverConfig.securityKeys.S2_AccessControl = Buffer.from(config.securityKeys.S2_AccessControl, 'hex');
        }
      }

      const driver = new Driver(config.serialPort, driverConfig);

      // Set up error handlers
      driver.on('error', (error) => {
        logger.error('ZWave', 'Driver error', error);
      });

      // Set up driver ready handler BEFORE starting
      driver.on('driver ready', () => {
        logger.info('ZWave', 'Driver ready');

        // Set up controller event listeners NOW (controller is ready)
        const controller = driver.controller;

        // Listen for node added events (during inclusion)
        controller.on('node added', (node) => {
          lastAddedNodeId = node.id;
          lastAddedNodeTime = Date.now();
          logger.info('ZWave', `✓ New device found! Node ${node.id} added to network`, {
            nodeId: node.id,
            manufacturer: node.deviceConfig?.manufacturer,
            label: node.deviceConfig?.label,
          });
        });

        // Listen for inclusion started
        controller.on('inclusion started', (secure) => {
          logger.info('ZWave', `Inclusion mode started (secure: ${secure})`);
        });

        // Listen for inclusion stopped
        controller.on('inclusion stopped', () => {
          logger.info('ZWave', 'Inclusion mode stopped');
        });

        // Listen for inclusion failed
        controller.on('inclusion failed', () => {
          logger.warn('ZWave', 'Inclusion failed - no device responded');
        });

        // Listen for value updates on all nodes
        for (const [nodeId, node] of controller.nodes.entries()) {
          node.on('value updated', () => {
            // Notify all registered callbacks
            valueUpdateCallbacks.forEach(callback => {
              try {
                callback(nodeId);
              } catch (e) {
                logger.error('ZWave', 'Error in value update callback', e);
              }
            });
          });
        }

        // Notify all registered callbacks
        driverReadyCallbacks.forEach(callback => {
          try {
            callback();
          } catch (e) {
            logger.error('ZWave', 'Error in driver ready callback', e);
          }
        });
      });

      // Start the driver
      try {
        await driver.start();
        logger.info('ZWave', 'Driver started successfully');
      } catch (startError: any) {
        // Check if it's a port error
        if (startError.code === 100) {
          if (startError.message?.includes('No such file or directory')) {
            logger.warn('ZWave', `Serial port ${config.serialPort} not found. Is the USB device attached?`);
          } else if (startError.message?.includes('Cannot lock port')) {
            logger.warn('ZWave', 'Serial port is locked. Try restarting the application.');
          } else {
            logger.error('ZWave', 'Failed to open serial port', startError);
          }
        }
        throw startError;
      }

      driverInstance = driver;
      driverInitializing = false;
      
      return driver;
    } catch (error: any) {
      driverInitializing = false;
      initializationPromise = null;
      // Don't log error if it's already been logged above (port errors)
      if (error?.code !== 100) {
        logger.error('ZWave', 'Failed to initialize driver', error);
      }
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Get the Z-Wave driver instance (initializes if needed)
 */
export async function getDriver(): Promise<Driver> {
  if (driverInstance) {
    return driverInstance;
  }
  return initializeDriver();
}

/**
 * Shutdown the Z-Wave driver
 */
export async function shutdownDriver(): Promise<void> {
  if (driverInstance) {
    logger.info('ZWave', 'Shutting down driver');
    await driverInstance.destroy();
    driverInstance = null;
    driverInitializing = false;
    initializationPromise = null;
  }
}

/**
 * Check if driver is ready (controller is accessible)
 */
export function isDriverReady(): boolean {
  if (!driverInstance) {
    return false;
  }

  try {
    // Try to access controller - this will throw if not ready
    const _ = driverInstance.controller;
    return true;
  } catch {
    return false;
  }
}

/**
 * Get last added node info (for inclusion feedback)
 */
export function getLastAddedNode(): { nodeId: number; timestamp: number } | null {
  if (lastAddedNodeId === null || lastAddedNodeTime === null) {
    return null;
  }
  return {
    nodeId: lastAddedNodeId,
    timestamp: lastAddedNodeTime,
  };
}

/**
 * Clear last added node info
 */
export function clearLastAddedNode(): void {
  lastAddedNodeId = null;
  lastAddedNodeTime = null;
}

/**
 * Register a callback to be called when driver becomes ready
 */
export function onDriverReady(callback: () => void): () => void {
  driverReadyCallbacks.push(callback);

  // Return unsubscribe function
  return () => {
    const index = driverReadyCallbacks.indexOf(callback);
    if (index > -1) {
      driverReadyCallbacks.splice(index, 1);
    }
  };
}

/**
 * Register a callback to be called when a node value is updated
 */
export function onValueUpdate(callback: (nodeId: number) => void): () => void {
  valueUpdateCallbacks.push(callback);

  // Return unsubscribe function
  return () => {
    const index = valueUpdateCallbacks.indexOf(callback);
    if (index > -1) {
      valueUpdateCallbacks.splice(index, 1);
    }
  };
}

// Graceful shutdown on process exit
process.on('SIGINT', async () => {
  await shutdownDriver();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdownDriver();
  process.exit(0);
});

// Hot Module Replacement (HMR) cleanup for development
if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    logger.info('ZWave', 'HMR: Cleaning up driver before reload');
    await shutdownDriver();
  });
}

