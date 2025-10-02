# Log Rotation

## Overview

The Todash logging system includes automatic log rotation to prevent memory bloat and ensure the system doesn't get flooded with terabytes of log messages.

## How It Works

### Automatic Rotation

- **Maximum entries**: 100 logs (configurable)
- **Strategy**: FIFO (First In, First Out)
- **Automatic**: No manual intervention required
- **Applies to**: Both client and server logs

When the 101st log entry is added:
1. The oldest log (entry #1) is automatically discarded
2. The new log becomes entry #100
3. The buffer maintains exactly 100 entries

### Memory Usage

With 100 log entries:
- **Minimal logs** (simple messages): ~5-10 KB
- **Average logs** (with some data): ~20-30 KB
- **Heavy logs** (with large data objects): ~50-100 KB

This is negligible compared to system memory and prevents unbounded growth.

## Configuration

### Changing the Limit

Edit `src/lib/logger.ts`:

```typescript
class Logger {
  /**
   * Maximum number of log entries to keep in memory
   * Increase this if you need more history, but be aware of memory usage
   * 100 logs ≈ 10-50 KB of memory depending on data size
   */
  private maxLogs = 100; // Change this number
```

**Recommended values:**
- **Development**: 100-200 (more history for debugging)
- **Production**: 50-100 (minimal memory footprint)
- **High-traffic**: 50 (frequent rotation, less memory)

### Monitoring

The log viewer shows rotation statistics:

- **Current count**: Number of logs currently stored
- **Max count**: Maximum logs before rotation
- **Utilization**: Percentage of buffer used
- **Warning indicator**: Shows when buffer is ≥80% full

## Best Practices

### 1. Don't Log Everything

**Bad:**
```typescript
// Logs on every render (hundreds per second)
useEffect(() => {
  logger.debug('Component', 'Rendering');
});
```

**Good:**
```typescript
// Logs only important events
useEffect(() => {
  logger.info('Component', 'Mounted');
  return () => logger.info('Component', 'Unmounted');
}, []);
```

### 2. Use Appropriate Log Levels

- **debug**: Development only, filtered out in production
- **info**: Normal operations, important events
- **warn**: Potential issues
- **error**: Actual problems

### 3. Limit Data Size

**Bad:**
```typescript
// Logs entire large object
logger.info('API', 'Response received', hugeResponseObject);
```

**Good:**
```typescript
// Logs only relevant data
logger.info('API', 'Response received', { 
  status: response.status,
  itemCount: response.data.length 
});
```

### 4. Clear Logs Periodically

If you're debugging and generating lots of logs:
1. Open the log viewer
2. Click the "Clear" button
3. Reproduce the issue
4. Review fresh logs

## Technical Details

### Rotation Algorithm

```typescript
log(level: LogLevel, category: string, message: string, data?: any) {
  const entry: LogEntry = { timestamp, level, category, message, data };
  
  this.logs.push(entry);
  
  // Automatic rotation
  if (this.logs.length > this.maxLogs) {
    this.logs = this.logs.slice(-this.maxLogs); // Keep last N entries
  }
}
```

### Performance Impact

- **Time complexity**: O(1) for most operations, O(n) when rotation occurs
- **Space complexity**: O(n) where n = maxLogs
- **Rotation frequency**: Only when buffer is full
- **Memory allocation**: Minimal, uses array slicing

### Client vs Server

Both client and server use the same logger implementation:
- **Client**: Logs stored in browser memory
- **Server**: Logs stored in Node.js process memory
- **Independent**: Each has its own 100-entry buffer
- **Merged view**: Log viewer combines both for display

## Troubleshooting

### Logs disappearing too quickly

**Cause**: High log volume causing rapid rotation

**Solutions:**
1. Increase `maxLogs` in `src/lib/logger.ts`
2. Reduce logging frequency
3. Use higher log levels (info/warn/error instead of debug)
4. Clear logs and reproduce issue to capture fresh logs

### Memory concerns

**Cause**: Worried about memory usage

**Solutions:**
1. Current limit (100) is very safe (~10-50 KB)
2. Monitor with `logger.getStats()`
3. Reduce limit if needed (e.g., to 50)
4. Avoid logging large objects

### Can't find old logs

**Cause**: Logs rotated out of buffer

**Solutions:**
1. Logs are not persisted to disk (by design)
2. For persistent logs, use server-side file logging
3. Increase buffer size if you need more history
4. Export/save important logs before they rotate out

## Future Enhancements

Potential improvements for the logging system:

1. **Persistent storage**: Option to save logs to disk
2. **Log levels per category**: Different verbosity for different components
3. **Export functionality**: Download logs as JSON/CSV
4. **Remote logging**: Send logs to external service
5. **Compression**: Compress old logs before rotation
6. **Configurable rotation**: Per-category rotation limits

## Summary

The log rotation system:
- ✅ Prevents memory bloat
- ✅ Maintains recent history (100 entries)
- ✅ Automatic and transparent
- ✅ Configurable if needed
- ✅ Minimal performance impact
- ✅ Safe for production use

No action required - it just works!

