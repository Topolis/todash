# Health Monitor Plugin

The Health Monitor plugin allows you to monitor web services and API endpoints for availability and health status.

## Features

- **Multiple Services**: Monitor multiple services simultaneously
- **Flexible Checks**: Support for different HTTP methods (HEAD, GET, POST)
- **Status Validation**: Verify HTTP status codes
- **Body Validation**: Optional regex validation of response body
- **Visual Status**: Clear up/down/degraded indicators with color coding
- **Performance Metrics**: Display response times for each service
- **Configurable**: Per-service check intervals, timeouts, and retry logic
- **Summary Statistics**: Quick overview of all services status

## Configuration

### Basic Example

```yaml
- widget:
    type: health-monitor
    title: Service Health
    props:
      services:
        - title: "API Server"
          url: "https://api.example.com/health"
          checkInterval: 30
          
        - title: "Website"
          url: "https://example.com"
          checkInterval: 60
```

### Advanced Example

```yaml
- widget:
    type: health-monitor
    title: Infrastructure Health
    props:
      # List of services to monitor
      services:
        # API endpoint with specific status code check
        - title: "Production API"
          url: "https://api.example.com/health"
          checkInterval: 30          # Check every 30 seconds
          expectedStatus: 200        # Expect HTTP 200
          method: "GET"              # Use GET instead of HEAD
          timeout: 3000              # 3 second timeout for this service
          
        # Database health check
        - title: "PostgreSQL"
          url: "http://localhost:5432"
          checkInterval: 60          # Check every 60 seconds
          
        # Web app with body validation
        - title: "Web Application"
          url: "https://example.com"
          checkInterval: 120         # Check every 2 minutes
          expectedStatus: 200
          method: "GET"
          bodyRegex: "<!DOCTYPE html>"  # Verify HTML is returned
          
        # Service with multiple required text patterns
        - title: "Content Site"
          url: "https://shop.example.com"
          checkInterval: 180
          method: "GET"
          bodyRegex:                    # Array of patterns - all must match
            - "Product Catalog"
            - "Shopping Cart"
            - "Contact Us"
          
        # Another API endpoint
        - title: "Auth Service"
          url: "https://auth.example.com/status"
          checkInterval: 45
          expectedStatus: 200
          
      # Global settings (optional)
      timeout: 5000        # Global timeout in milliseconds (default: 5000)
      retries: 1           # Number of retries on failure (default: 1)
      refreshSeconds: 30   # Widget refresh interval (default: 30)
```

## Configuration Options

### Service Configuration

Each service in the `services` array supports:

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `title` | string | ✅ | - | Display name for the service |
| `url` | string | ✅ | - | URL or IP:port to check |
| `checkInterval` | number | ❌ | - | Check frequency in seconds (for display only) |
| `expectedStatus` | number | ❌ | 200-299 | Expected HTTP status code |
| `method` | string | ❌ | `HEAD` | HTTP method: `HEAD`, `GET`, or `POST` |
| `bodyRegex` | string or array | ❌ | - | Regex pattern(s) to match in response body (requires GET/POST). All patterns must match. |
| `timeout` | number | ❌ | Uses global | Timeout in milliseconds for this service |

### Global Configuration

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `services` | array | ✅ | - | Array of service configurations |
| `timeout` | number | ❌ | 5000 | Default timeout in milliseconds |
| `retries` | number | ❌ | 1 | Number of retries on failure |
| `refreshSeconds` | number | ❌ | 30 | Widget refresh interval in seconds |

## Status Indicators

The plugin displays three status levels:

- **🟢 UP** (Green): Service is responding correctly
  - HTTP status matches expected value (or is in 200-299 range)
  - Body regex matches (if configured)
  
- **🟡 DEGRADED** (Yellow): Service is responding but with issues
  - HTTP status doesn't match expected value
  - Body regex doesn't match
  
- **🔴 DOWN** (Red): Service is not responding
  - Connection failed
  - Request timeout
  - Network error

## HTTP Methods

### HEAD (Default)
- Lightweight health check
- Only fetches headers, no body
- Fastest option for simple availability checks
- **Cannot** be used with `bodyRegex`

### GET
- Fetches full response including body
- Required for `bodyRegex` validation
- Useful for API endpoints that return status in body

### POST
- Sends POST request to the endpoint
- Can be used with `bodyRegex`
- Useful for endpoints that require POST for health checks

## Body Regex Validation

You can validate response content using regex patterns:

**Single Pattern:**
```yaml
bodyRegex: "<!DOCTYPE html>"
```

**Multiple Patterns (all must match):**
```yaml
bodyRegex:
  - "Product Name"
  - "Add to Cart"
  - "Customer Reviews"
```

- Patterns are case-insensitive by default
- Use standard JavaScript regex syntax
- Special regex characters need escaping: `\.`, `\[`, `\]`, etc.
- When using multiple patterns, ALL must be found in the response
- Useful for verifying critical page elements are present

## Best Practices

1. **Use HEAD for simple checks**: When you only need to verify a service is responding, use HEAD to minimize bandwidth

2. **Set appropriate timeouts**: Services should respond quickly. If a service regularly takes >5 seconds, it may indicate issues

3. **Configure check intervals based on criticality**:
   - Critical services: 30-60 seconds
   - Important services: 2-5 minutes
   - Less critical: 5-10 minutes

4. **Use bodyRegex for content validation**: Verify the service is returning expected content, not just a generic error page

5. **Monitor what matters**: Don't monitor everything - focus on critical services and user-facing endpoints

## Example Dashboard Panel

```yaml
panels:
  - panelType: single
    x: 1
    y: 1
    w: 6
    h: 4
    widget:
      type: health-monitor
      title: Production Services
      props:
        services:
          - title: "API Gateway"
            url: "https://api.myapp.com/health"
            checkInterval: 30
            method: "GET"
            expectedStatus: 200
            bodyRegex: '"status":"healthy"'
            
          - title: "Database"
            url: "http://db.internal:5432"
            checkInterval: 60
            
          - title: "Cache Layer"
            url: "http://redis.internal:6379"
            checkInterval: 60
            
          - title: "Frontend"
            url: "https://myapp.com"
            checkInterval: 120
            method: "GET"
            bodyRegex: "<html"
```

## Troubleshooting

### Service shows DEGRADED but is working

- Check if `expectedStatus` matches the actual HTTP status code
- Verify `bodyRegex` pattern is correct (it's case-insensitive)
- Try using GET method instead of HEAD if checking body content

### Service shows DOWN but is accessible

- Increase the `timeout` value
- Check if the service requires specific headers
- Verify the URL is accessible from the server running Todash

### bodyRegex not working

- Ensure you're using `GET` or `POST` method (HEAD doesn't fetch body)
- Regex is case-insensitive by default
- Test your regex pattern separately to ensure it's correct

### High response times

- Consider increasing `timeout` for slower services
- Services consistently >2-3 seconds may have performance issues
- Network latency can affect response times

## Tips

- The widget shows response time, HTTP status code, and time since last check
- Services are checked in parallel for efficiency
- Failed checks are automatically retried once after a 2-second delay
- All timestamps are shown relative to current time (e.g., "30s ago", "2m ago")
