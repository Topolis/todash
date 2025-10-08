/**
 * Widget configuration
 */
export interface TemperatureHistoryConfig {
  nodeId: number; // Sensor node ID
  hours?: number; // Hours of history to show (default: 48)
  refreshSeconds?: number;
}

/**
 * Temperature reading
 */
export interface TemperatureReading {
  nodeId: number; // Node ID that reported this temperature
  timestamp: number; // Unix timestamp in milliseconds
  temperature: number; // Temperature in °C
}

/**
 * Widget data
 */
export interface TemperatureHistoryData {
  nodeId: number;
  nodeName?: string;
  readings: TemperatureReading[];
  currentTemperature?: number;
  minTemperature?: number;
  maxTemperature?: number;
}

