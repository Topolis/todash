/**
 * Centralized logging system for both client and server
 * Stores logs in memory and provides API to retrieve them
 *
 * Log Rotation:
 * - Automatically keeps only the last 100 log entries
 * - Prevents memory bloat and system flooding
 * - Oldest logs are discarded first (FIFO)
 * - Adjust maxLogs below to change the limit
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];

  /**
   * Maximum number of log entries to keep in memory
   * Increase this if you need more history, but be aware of memory usage
   * 100 logs ≈ 10-50 KB of memory depending on data size
   */
  private maxLogs = 100;

  private listeners: Set<(entry: LogEntry) => void> = new Set();

  log(level: LogLevel, category: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(entry);

    // Trim old logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(entry));

    // Also log to console
    const consoleMethod = level === 'error' ? console.error : 
                         level === 'warn' ? console.warn : 
                         level === 'info' ? console.info : 
                         console.log;
    
    const prefix = `[${category}]`;
    if (data !== undefined) {
      consoleMethod(prefix, message, data);
    } else {
      consoleMethod(prefix, message);
    }
  }

  debug(category: string, message: string, data?: any) {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: any) {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: any) {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: any) {
    this.log('error', category, message, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  subscribe(listener: (entry: LogEntry) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get logger statistics
   */
  getStats() {
    return {
      currentCount: this.logs.length,
      maxCount: this.maxLogs,
      utilizationPercent: Math.round((this.logs.length / this.maxLogs) * 100),
      oldestTimestamp: this.logs.length > 0 ? this.logs[0].timestamp : null,
      newestTimestamp: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null,
    };
  }
}

// Singleton instance
export const logger = new Logger();

