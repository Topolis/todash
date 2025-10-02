# Logging System

Todash includes a centralized logging system that captures logs from both the client and server, making debugging much easier.

## Features

- **Unified Logging**: Single logger for both client and server code
- **Log Viewer UI**: Built-in dialog to view all logs in real-time
- **Filtering**: Filter by log level (debug, info, warn, error) and search text
- **Auto-scroll**: Automatically scroll to newest logs
- **Log Rotation**: Automatically keeps only the last 100 log entries (prevents memory bloat)
- **Real-time**: Updates automatically as new logs arrive

## Using the Log Viewer

### Opening the Log Viewer

Click the bug icon (🐛) button in the top-left corner of the dashboard, next to the lock icon.

### Log Viewer Features

- **Filter by text**: Search for specific messages or categories
- **Filter by level**: Toggle debug/info/warn/error buttons to show/hide log levels
- **Auto-scroll**: Enable/disable automatic scrolling to newest logs
- **Refresh**: Manually refresh logs from server
- **Clear**: Clear all logs (both client and server)

### Log Entry Format

Each log entry shows:
- **Timestamp**: Precise time (HH:MM:SS.mmm) - 80px fixed width
- **Level**: DEBUG, INFO, WARN, or ERROR (color-coded) - 60px fixed width
- **Category**: Component or module that generated the log - 100px fixed width
- **Message**: Log message - flexible width
- **Expand icon**: Click to show/hide additional data (if present)

**Additional Data:**
- Collapsed by default to keep the log view clean
- Click the chevron icon (▶) on the right to expand
- Click again (▼) to collapse
- Shows JSON objects, error details, or other structured data

## Using the Logger in Code

### Import the Logger

```typescript
import { logger } from '../lib/logger';
```

### Log Methods

```typescript
// Debug - detailed information for debugging
logger.debug('Category', 'Debug message', optionalData);

// Info - general informational messages
logger.info('Category', 'Info message', optionalData);

// Warn - warning messages
logger.warn('Category', 'Warning message', optionalData);

// Error - error messages
logger.error('Category', 'Error message', optionalData);
```

### Examples

```typescript
// Simple message
logger.info('App', 'Application starting');

// With data
logger.info('Unsplash', 'Fetching photos', { query: 'nature', count: 30 });

// Error with exception
try {
  // ... code
} catch (error) {
  logger.error('Widget', 'Failed to load data', error);
}

// Debug with object
logger.debug('API', 'Request details', { 
  url: '/api/data', 
  method: 'POST',
  body: requestData 
});
```

### Category Naming

Use descriptive category names that identify the component or module:

- **App**: Main application
- **Widget**: Widget-related code
- **API**: API calls and responses
- **Unsplash**: Unsplash wallpaper
- **Dashboard**: Dashboard loading/configuration
- **Layout**: Layout changes and persistence

## Best Practices

### When to Log

**DO log:**
- Application lifecycle events (startup, shutdown)
- API calls and responses
- Data fetching operations
- User actions (dashboard changes, layout saves)
- Errors and exceptions
- Important state changes

**DON'T log:**
- Every render cycle
- Mouse movements or frequent UI events
- Sensitive data (passwords, API keys)
- Excessive debug information in production

### Log Levels

- **debug**: Detailed information for debugging (development only)
- **info**: General informational messages (normal operations)
- **warn**: Warning messages (potential issues)
- **error**: Error messages (actual problems)

### Example: Adding Logging to a Component

```typescript
import { logger } from '../lib/logger';

export default function MyWidget(props: WidgetProps) {
  const [data, setData] = useState(null);

  useEffect(() => {
    logger.info('MyWidget', 'Widget mounted', { widgetId: props.id });
    
    fetchData()
      .then(result => {
        logger.info('MyWidget', 'Data loaded successfully');
        setData(result);
      })
      .catch(error => {
        logger.error('MyWidget', 'Failed to load data', error);
      });
      
    return () => {
      logger.debug('MyWidget', 'Widget unmounted');
    };
  }, []);

  // ... rest of component
}
```

## API Endpoints

### GET /api/logs

Returns all server-side logs.

**Response:**
```json
{
  "logs": [
    {
      "timestamp": 1234567890,
      "level": "info",
      "category": "API",
      "message": "Request received",
      "data": { ... }
    }
  ]
}
```

### DELETE /api/logs

Clears all server-side logs.

**Response:**
```json
{
  "success": true
}
```

## Technical Details

### Logger Implementation

- **Singleton**: Single logger instance shared across the application
- **In-memory**: Logs stored in memory (not persisted to disk)
- **Circular buffer**: Keeps last 100 entries, older entries are automatically discarded (log rotation)
- **Subscribers**: Components can subscribe to new log entries for real-time updates
- **Console passthrough**: All logs are also sent to browser/server console

### Log Storage

- **Client logs**: Stored in browser memory
- **Server logs**: Stored in Node.js process memory
- **Merged view**: Log viewer merges and sorts both client and server logs

### Performance

- Minimal overhead for logging operations
- Logs are batched when fetching from server
- Auto-scroll can be disabled for better performance with many logs

### Log Rotation

The logger automatically implements log rotation to prevent memory bloat:

- **Maximum entries**: 100 logs (configurable in `src/lib/logger.ts`)
- **Rotation strategy**: FIFO (First In, First Out) - oldest logs are discarded first
- **Automatic**: No manual intervention required
- **Memory safe**: Prevents unbounded memory growth
- **Both client and server**: Same rotation applies to both

**Why 100 logs?**
- Sufficient for debugging recent issues
- Minimal memory footprint (~10-50 KB depending on data)
- Fast to search and filter
- Prevents system flooding with terabytes of logs

**To change the limit:**
Edit `src/lib/logger.ts` and modify the `maxLogs` value:
```typescript
private maxLogs = 100; // Change this number
```

For more details on log rotation, see [LOG_ROTATION.md](LOG_ROTATION.md).

## Troubleshooting

### Logs not appearing

1. Check that you're importing the logger correctly
2. Verify the log level filter includes your log level
3. Check the text filter isn't excluding your logs
4. Try clicking the Refresh button

### Too many logs

1. Use the level filter to hide debug logs
2. Use the text filter to search for specific messages
3. Click Clear to remove old logs
4. Disable auto-scroll if performance is affected

### Server logs not showing

1. Check that the server is running
2. Verify the API endpoint is accessible
3. Check browser console for API errors
4. Ensure CORS is configured correctly (dev mode)

