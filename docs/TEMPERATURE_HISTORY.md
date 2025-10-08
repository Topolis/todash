# Temperature History Widget

Display historical temperature data from Z-Wave sensors with smooth graphs.

## Features

- 📊 **48-hour history** - View temperature trends over time
- 📈 **Smooth curves** - MonotoneX interpolation for realistic temperature changes
- 💾 **Persistent storage** - Data survives server restarts
- 🔄 **Auto-refresh** - Updates every 5 minutes
- 📉 **Min/Max display** - See temperature range at a glance
- 🎨 **Clean design** - Minimal, focused interface

## Quick Start

### 1. Add to Dashboard

Edit your dashboard YAML (e.g., `dashboards/smarthome.yaml`):

```yaml
panels:
  - panelType: single
    x: 1
    y: 3
    w: 6
    h: 3
    widget:
      type: temperature-history
      title: Temperature History
      props:
        nodeId: 15          # Your Z-Wave sensor node ID
        hours: 48           # Hours of history to display
        refreshSeconds: 300 # Update every 5 minutes
```

### 2. Find Your Sensor Node ID

1. Open Z-Wave Admin: http://localhost:5173/zwave/admin
2. Find your temperature sensor in the Nodes tab
3. Note the Node ID (e.g., 15)
4. Use this ID in the `nodeId` property

## Configuration

### Widget Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `nodeId` | number | **required** | Z-Wave sensor node ID |
| `hours` | number | `48` | Hours of history to display |
| `refreshSeconds` | number | `300` | Update interval in seconds |

### Example Configurations

**Minimal (required only):**
```yaml
props:
  nodeId: 15
```

**Custom time range:**
```yaml
props:
  nodeId: 15
  hours: 24           # Show last 24 hours
  refreshSeconds: 600 # Update every 10 minutes
```

**Multiple sensors:**
```yaml
panels:
  - panelType: single
    x: 1
    y: 1
    w: 6
    h: 3
    widget:
      type: temperature-history
      title: Living Room
      props:
        nodeId: 15
        
  - panelType: single
    x: 7
    y: 1
    w: 6
    h: 3
    widget:
      type: temperature-history
      title: Bedroom
      props:
        nodeId: 16
```

## Data Storage

### Location

Temperature data is stored in:
```
/var/projects/todash/var/temperature-history/
├── node-15.json
├── node-16.json
└── ...
```

### Format

Each file contains an array of readings:
```json
[
  {
    "nodeId": 15,
    "timestamp": 1234567890000,
    "temperature": 20.2
  },
  {
    "nodeId": 15,
    "timestamp": 1234567890300,
    "temperature": 20.3
  }
]
```

### Persistence

- ✅ **Immediate save**: Data saved after each reading
- ✅ **Periodic backup**: All data saved every 5 minutes
- ✅ **Auto-load**: Existing history loaded on startup
- ✅ **Retention**: Keeps last 600 readings (~50 hours at 5-min intervals)

## Graph Features

### Curve Interpolation

Uses **MonotoneX** curve interpolation:
- Smooth curves between data points
- No artificial overshoots or bumps
- Preserves monotonic sections (rising temps only rise)
- Realistic temperature progression

### Display

- **Current temperature**: Shown in header (bold)
- **Min/Max**: Displayed in header (muted)
- **Time format**: 24-hour notation (e.g., 14:30)
- **Date format**: Shows date for data older than 24 hours
- **No legend**: Removed for cleaner appearance

### Layout

- Compact header with stats on same line
- Minimal padding for maximum graph space
- Responsive to widget size
- Auto-scaling Y-axis with padding

## Troubleshooting

### No Data Showing

**Problem**: Graph shows "No temperature data available"

**Solutions**:
1. Check node ID is correct (use Z-Wave Admin)
2. Verify sensor is reporting temperature:
   - Open Z-Wave Admin
   - Expand the node
   - Look for "Air temperature" value
3. Wait 5 minutes for first reading
4. Check server logs for errors

### Graph Shows Only Recent Data

**Problem**: Graph doesn't show full 48 hours

**Explanation**: The widget only shows data it has collected. It will progressively show more data over time:
- After 1 hour: ~1 hour of data
- After 24 hours: Full day visible
- After 48 hours: Full 48-hour history

**Note**: Data collection starts when the widget is first added to the dashboard.

### Data Lost After Restart

**Problem**: History disappears after server restart

**Solutions**:
1. Check `var/temperature-history/` folder exists
2. Verify file permissions (should be writable)
3. Check server logs for save errors
4. Ensure disk space available

### Wrong Temperature Values

**Problem**: Temperature readings seem incorrect

**Solutions**:
1. Verify sensor is working (check Z-Wave Admin)
2. Check sensor calibration in device settings
3. Compare with other thermometers
4. Re-interview the node if values are stuck

## Advanced Usage

### Custom Time Ranges

Show different time periods:

```yaml
# Last 12 hours
props:
  nodeId: 15
  hours: 12

# Last 7 days (limited by 600 reading max)
props:
  nodeId: 15
  hours: 168
```

**Note**: Maximum readings stored is 600. At 5-minute intervals, this is ~50 hours of data.

### Multiple Graphs in One Dashboard

Create a temperature monitoring dashboard:

```yaml
grid:
  columns: 12
  gap: 2

panels:
  - panelType: single
    x: 1
    y: 1
    w: 4
    h: 3
    widget:
      type: temperature-history
      title: Living Room
      props:
        nodeId: 15

  - panelType: single
    x: 5
    y: 1
    w: 4
    h: 3
    widget:
      type: temperature-history
      title: Bedroom
      props:
        nodeId: 16

  - panelType: single
    x: 9
    y: 1
    w: 4
    h: 3
    widget:
      type: temperature-history
      title: Office
      props:
        nodeId: 17
```

## Related Documentation

- [Z-Wave Setup](ZWAVE_SETUP.md) - Set up Z-Wave sensors
- [Z-Wave Admin](ZWAVE_ADMIN.md) - Manage Z-Wave devices
- [Smart Home Dashboard](SMARTHOME_DASHBOARD.md) - Complete dashboard examples
- [Danfoss Boost](DANFOSS_BOOST.md) - Thermostat boost functionality

## Technical Details

### Data Collection

- Readings collected every 5 minutes (default refresh interval)
- Each reading includes: nodeId, timestamp, temperature
- Stored in memory and persisted to disk
- Maximum 600 readings per node

### Performance

- Minimal memory footprint (~50KB per node)
- Non-blocking disk writes
- Efficient JSON storage
- Fast graph rendering with MUI X Charts

### Dependencies

- Z-Wave JS driver (for sensor access)
- MUI X Charts (for graph rendering)
- Node.js fs module (for persistence)

