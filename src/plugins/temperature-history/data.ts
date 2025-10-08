import type { TemperatureHistoryConfig, TemperatureHistoryData, TemperatureReading } from './types.js';
import { getDriver } from '../zwave/service.js';
import { logger } from '../../lib/logger.js';
import * as fs from 'fs';
import * as path from 'path';

// Storage directory - use project-local var folder
const STORAGE_DIR = path.resolve(process.cwd(), 'var', 'temperature-history');

// In-memory storage for temperature history
// Map: nodeId -> array of readings
const temperatureHistory = new Map<number, TemperatureReading[]>();

// Maximum readings to keep per node (48h at 5min intervals = 576 readings)
const MAX_READINGS = 600;

// Ensure storage directory exists
function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    logger.info('TemperatureHistory', `Created storage directory: ${STORAGE_DIR}`);
  }
}

// Get file path for a node
function getNodeFilePath(nodeId: number): string {
  return path.join(STORAGE_DIR, `node-${nodeId}.json`);
}

// Load history from disk for a specific node
function loadNodeHistory(nodeId: number): void {
  try {
    const filePath = getNodeFilePath(nodeId);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      const readings: TemperatureReading[] = JSON.parse(data);
      temperatureHistory.set(nodeId, readings);
      logger.info('TemperatureHistory', `Loaded ${readings.length} readings for node ${nodeId}`);
    }
  } catch (error) {
    logger.error('TemperatureHistory', `Failed to load history for node ${nodeId}`, error);
  }
}

// Save history to disk for a specific node
function saveNodeHistory(nodeId: number): void {
  try {
    ensureStorageDir();
    const readings = temperatureHistory.get(nodeId) || [];
    const filePath = getNodeFilePath(nodeId);
    fs.writeFileSync(filePath, JSON.stringify(readings, null, 2), 'utf-8');
  } catch (error) {
    logger.error('TemperatureHistory', `Failed to save history for node ${nodeId}`, error);
  }
}

// Initialize: load all existing history files
function initializeStorage(): void {
  try {
    ensureStorageDir();
    if (fs.existsSync(STORAGE_DIR)) {
      const files = fs.readdirSync(STORAGE_DIR);
      for (const file of files) {
        const match = file.match(/^node-(\d+)\.json$/);
        if (match) {
          const nodeId = parseInt(match[1], 10);
          loadNodeHistory(nodeId);
        }
      }
    }
  } catch (error) {
    logger.error('TemperatureHistory', 'Failed to initialize storage', error);
  }
}

// Initialize on module load
initializeStorage();

// Periodically save all data to disk (every 5 minutes)
setInterval(() => {
  for (const nodeId of temperatureHistory.keys()) {
    saveNodeHistory(nodeId);
  }
}, 5 * 60 * 1000);

/**
 * Record a temperature reading
 */
export function recordTemperature(nodeId: number, temperature: number): void {
  const timestamp = Date.now();

  if (!temperatureHistory.has(nodeId)) {
    temperatureHistory.set(nodeId, []);
    // Load existing history from disk if available
    loadNodeHistory(nodeId);
  }

  const readings = temperatureHistory.get(nodeId)!;
  readings.push({ nodeId, timestamp, temperature });

  // Keep only the most recent readings
  if (readings.length > MAX_READINGS) {
    readings.splice(0, readings.length - MAX_READINGS);
  }

  // Save to disk immediately (async, non-blocking)
  setImmediate(() => saveNodeHistory(nodeId));
}

/**
 * Get temperature history for a node
 */
export function getTemperatureHistory(nodeId: number, hours: number = 48): TemperatureReading[] {
  const readings = temperatureHistory.get(nodeId) || [];
  const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
  
  return readings.filter(r => r.timestamp >= cutoffTime);
}

/**
 * Fetch data for the widget
 */
export async function fetchTemperatureHistoryData(config: TemperatureHistoryConfig): Promise<TemperatureHistoryData> {
  const { nodeId, hours = 48 } = config;
  
  try {
    const driver = await getDriver();
    const node = driver.controller.nodes.get(nodeId);
    
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    
    // Get current temperature
    const currentTemp = node.getValue({ commandClass: 0x31, property: 'Air temperature' });
    const currentTemperature = typeof currentTemp === 'number' ? currentTemp : undefined;
    
    // Record current reading if available
    if (currentTemperature !== undefined) {
      recordTemperature(nodeId, currentTemperature);
    }
    
    // Get historical readings
    const readings = getTemperatureHistory(nodeId, hours);
    
    // Calculate min/max
    let minTemperature: number | undefined;
    let maxTemperature: number | undefined;
    
    if (readings.length > 0) {
      minTemperature = Math.min(...readings.map(r => r.temperature));
      maxTemperature = Math.max(...readings.map(r => r.temperature));
    }
    
    return {
      nodeId,
      nodeName: node.name || node.deviceConfig?.label || `Node ${nodeId}`,
      readings,
      currentTemperature,
      minTemperature,
      maxTemperature,
    };
  } catch (error) {
    logger.error('TemperatureHistory', `Error fetching data for node ${nodeId}`, error);
    throw error;
  }
}

