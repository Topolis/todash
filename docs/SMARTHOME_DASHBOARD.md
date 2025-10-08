# Smart Home Dashboard

## Overview

The Smart Home dashboard is your central control panel for all Z-Wave devices and home automation.

## Access

**URL**: `http://localhost:5173/?dashboard=smarthome`

Or use the dashboard selector dropdown in the top-right corner of any dashboard.

## Current Widgets

### Heizung Flur (Hallway Thermostat)
- **Type**: Z-Wave Thermostat
- **Node ID**: 19
- **Location**: Grid position (1,1), size 4x3
- **Refresh**: Every 30 seconds

**Features**:
- View current temperature
- View target temperature (setpoint)
- Adjust temperature
- See operating mode (Heat/Cool/Auto)
- View operating state (Idle/Heating/Cooling)
- Battery level indicator

## Adding More Widgets

### 1. Edit the Dashboard File

Edit `dashboards/smarthome.yaml`:

```yaml
panels:
  # Existing thermostat
  - panelType: single
    x: 1
    y: 1
    w: 4
    h: 3
    widget:
      type: zwave-thermostat
      title: Heizung Flur
      props:
        nodeId: 19

  # Add a new widget
  - panelType: single
    x: 5
    y: 1
    w: 3
    h: 2
    widget:
      type: zwave-switch
      title: Kitchen Light
      props:
        nodeId: 12
```

### 2. Available Widget Types

**Z-Wave Widgets**:
- `zwave-thermostat` - Control thermostats
- `zwave-switch` - Control switches and dimmers
- `zwave-sensor` - Monitor sensors (temperature, humidity, motion, etc.)

**Other Widgets**:
- `weather` - Current weather
- `weather-forecast` - Weather forecast
- `rss` - RSS feed reader
- `status` - Custom status display
- `project-status` - Project information

### 3. Grid Layout

The dashboard uses a 12-column grid:

```yaml
grid:
  columns: 12  # Total columns
  gap: 3       # Gap between widgets
```

**Widget positioning**:
- `x`: Column position (1-12)
- `y`: Row position (1+)
- `w`: Width in columns (1-12)
- `h`: Height in rows (1+)

**Example layouts**:

**Full width**:
```yaml
x: 1
w: 12
```

**Half width**:
```yaml
x: 1    # Left half
w: 6

x: 7    # Right half
w: 6
```

**Third width**:
```yaml
x: 1    # Left third
w: 4

x: 5    # Middle third
w: 4

x: 9    # Right third
w: 4
```

## Finding Node IDs

### Method 1: Z-Wave Admin Interface

1. Go to `http://localhost:5173/zwave/admin`
2. Click **Nodes** tab
3. Find your device in the list
4. Note the **Node ID** column

### Method 2: API

```bash
curl http://localhost:4000/api/zwave/admin/nodes | jq '.nodes[] | {nodeId, name, productLabel}'
```

## Example Configurations

### Thermostat Widget

```yaml
- panelType: single
  x: 1
  y: 1
  w: 4
  h: 3
  widget:
    type: zwave-thermostat
    title: Living Room Thermostat
    props:
      nodeId: 5
      refreshSeconds: 30
```

### Switch Widget

```yaml
- panelType: single
  x: 5
  y: 1
  w: 3
  h: 2
  widget:
    type: zwave-switch
    title: Kitchen Light
    props:
      nodeId: 12
      refreshSeconds: 10
```

### Sensor Widget

```yaml
- panelType: single
  x: 8
  y: 1
  w: 3
  h: 2
  widget:
    type: zwave-sensor
    title: Basement Humidity
    props:
      nodeId: 7
      refreshSeconds: 60
```

### Multiple Thermostats

```yaml
panels:
  - panelType: single
    x: 1
    y: 1
    w: 4
    h: 3
    widget:
      type: zwave-thermostat
      title: Living Room
      props:
        nodeId: 5

  - panelType: single
    x: 5
    y: 1
    w: 4
    h: 3
    widget:
      type: zwave-thermostat
      title: Bedroom
      props:
        nodeId: 7

  - panelType: single
    x: 9
    y: 1
    w: 4
    h: 3
    widget:
      type: zwave-thermostat
      title: Office
      props:
        nodeId: 9
```

## Customization

### Wallpaper

Change the background animation in `dashboards/smarthome.yaml`:

```yaml
wallpaper:
  type: nebula
  props:
    colors:
      - rgba(100, 150, 220, 0.15)  # Blue
      - rgba(120, 100, 200, 0.12)  # Purple
      - rgba(80, 180, 160, 0.15)   # Teal
      - rgba(200, 140, 100, 0.10)  # Orange
    speed: 40      # Animation speed (0-100)
    opacity: 0.85  # Overall opacity (0-1)
```

**Available wallpaper types**:
- `nebula` - Animated nebula effect
- `gradient` - Static gradient
- `solid` - Solid color
- `image` - Background image

### Date Format

Set the date format for all widgets:

```yaml
settings:
  dateFormat: 'DD.MM.YYYY HH:mm'  # German format
  # or
  dateFormat: 'YYYY-MM-DD HH:mm'  # ISO format
  # or
  dateFormat: 'MM/DD/YYYY h:mm A' # US format
```

### Panel Styling

Adjust panel transparency and background:

```yaml
theme:
  panel:
    opacity: 0.9
    background: 'rgba(14, 20, 34, 0.8)'
```

## Live Editing

### Enable Edit Mode

1. Open the dashboard
2. Click the **Edit** button in the toolbar
3. Drag widgets to reposition
4. Resize widgets by dragging corners
5. Click **Save** to persist changes

**Note**: Edit mode saves to `smarthome.local.yaml` to preserve the original.

### Refresh After Changes

After editing the YAML file manually:
1. Reload the page in your browser
2. Or use the dashboard selector to switch away and back

## Tips & Tricks

### Organize by Room

Group widgets by room using grid positioning:

```yaml
# Living Room (Row 1)
- x: 1, y: 1  # Living Room Thermostat
- x: 5, y: 1  # Living Room Light
- x: 9, y: 1  # Living Room Sensor

# Kitchen (Row 2)
- x: 1, y: 4  # Kitchen Thermostat
- x: 5, y: 4  # Kitchen Light
- x: 9, y: 4  # Kitchen Sensor
```

### Use Descriptive Titles

Include location in widget titles:
- ✅ "Living Room Thermostat"
- ✅ "Kitchen Ceiling Light"
- ❌ "Thermostat 1"
- ❌ "Light"

### Optimize Refresh Rates

Balance responsiveness vs. network load:
- **Thermostats**: 30-60 seconds (slow-changing)
- **Switches**: 10-30 seconds (moderate)
- **Motion sensors**: 5-10 seconds (fast-changing)
- **Battery sensors**: 60-300 seconds (very slow)

### Monitor Battery Devices

Add battery level indicators for battery-powered devices:

```yaml
- panelType: single
  x: 10
  y: 1
  w: 3
  h: 1
  widget:
    type: status
    title: Battery Levels
    props:
      items:
        - label: Hallway Thermostat
          value:
            zwave-battery:
              nodeId: 19
          unit: '%'
```

## Troubleshooting

### Widget Shows "Loading..."

**Causes**:
- Node ID doesn't exist
- Node is not responding
- Z-Wave driver not initialized

**Solutions**:
1. Check node ID in Z-Wave admin
2. Ping the node to verify connectivity
3. Check server logs for errors

### Widget Shows Error

**Common errors**:
- "Node not found" - Wrong node ID
- "Not supported" - Device doesn't support that widget type
- "Driver not ready" - Z-Wave driver initializing

**Solutions**:
1. Verify node ID
2. Check device type matches widget type
3. Wait for driver to initialize

### Changes Not Appearing

**Solutions**:
1. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
2. Check YAML syntax (use a YAML validator)
3. Check server logs for validation errors

## Next Steps

1. **Add more devices** to your Z-Wave network
2. **Name all nodes** in the Z-Wave admin interface
3. **Add widgets** for each device to the dashboard
4. **Organize layout** by room or function
5. **Customize appearance** with wallpaper and theme

Enjoy your smart home dashboard! 🏠✨

