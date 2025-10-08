# Z-Wave Plugin

Control and monitor Z-Wave devices through your todash dashboard using Z-Wave JS.

## Features

- **Shared Z-Wave Service**: Single driver instance shared across all widgets
- **Multiple Widget Types**:
  - `zwave-thermostat`: Control thermostats and climate devices
  - `zwave-switch`: Control switches and dimmers
  - `zwave-sensor`: Monitor sensors (temperature, humidity, motion, etc.)
- **Full Control**: Set temperatures, toggle switches, adjust dimmer levels
- **Status Widget Integration**: Use Z-Wave values in your status widget
- **Real-time Updates**: Automatic polling with configurable refresh intervals

## Setup

### 1. Install Dependencies

Dependencies are already installed via `package.json`:
- `zwave-js`: Core Z-Wave protocol implementation
- `@zwave-js/server`: Server utilities
- `@zwave-js/core`: Core types and utilities

### 2. Configure Z-Wave USB Stick

Add your Z-Wave configuration to `secrets.json` (or environment variables):

```json
{
  "ZWAVE_SERIAL_PORT": "/dev/ttyUSB0",
  "ZWAVE_NETWORK_KEY": "your_s0_network_key_in_hex",
  "ZWAVE_S2_UNAUTH_KEY": "optional_s2_unauthenticated_key",
  "ZWAVE_S2_AUTH_KEY": "optional_s2_authenticated_key",
  "ZWAVE_S2_ACCESS_KEY": "optional_s2_access_control_key"
}
```

**Finding your serial port:**
```bash
# List USB devices
ls /dev/tty* | grep -E "(USB|ACM)"

# Common paths:
# - /dev/ttyUSB0
# - /dev/ttyACM0
# - /dev/serial/by-id/usb-...
```

**Security Keys:**
- `ZWAVE_NETWORK_KEY`: Legacy S0 security key (32 hex characters)
- S2 keys are optional but recommended for newer devices
- Generate keys using: `openssl rand -hex 16`

### 3. Permissions

Ensure your user has access to the serial port:

```bash
# Add user to dialout group (Linux)
sudo usermod -a -G dialout $USER

# Or set permissions directly
sudo chmod 666 /dev/ttyUSB0
```

## Widget Configuration

### Thermostat Widget

Display and control Z-Wave thermostats:

```yaml
- panelType: single
  x: 1
  y: 1
  w: 4
  h: 4
  widget:
    type: zwave-thermostat
    title: Climate Control
    props:
      nodeIds: [5, 12]  # Optional: filter by specific node IDs
      refreshSeconds: 10
```

**Features:**
- Current temperature display
- Target temperature control (±0.5°C buttons)
- Operating mode and state
- Humidity reading (if available)
- Battery level indicator
- Device status (alive/asleep/dead)

### Switch Widget

Control Z-Wave switches and dimmers:

```yaml
- panelType: single
  x: 5
  y: 1
  w: 4
  h: 4
  widget:
    type: zwave-switch
    title: Lights & Switches
    props:
      nodeIds: [3, 7, 9]  # Optional: filter by specific node IDs
      refreshSeconds: 10
```

**Features:**
- On/Off toggle
- Dimmer level slider (for dimmers)
- Power consumption (if supported)
- Energy usage (if supported)
- Battery level indicator
- Device status

### Sensor Widget

Monitor Z-Wave sensors:

```yaml
- panelType: single
  x: 9
  y: 1
  w: 4
  h: 4
  widget:
    type: zwave-sensor
    title: Sensors
    props:
      nodeIds: [2, 4, 6]  # Optional: filter by specific node IDs
      sensorTypes: ["Air temperature", "Humidity"]  # Optional: filter by sensor type
      refreshSeconds: 30
```

**Features:**
- Multiple sensor readings per device
- Automatic unit formatting
- Battery level indicator
- Device status
- Manufacturer information

## Status Widget Integration

Use Z-Wave values in your status widget:

```yaml
widget:
  type: status
  title: System Status
  props:
    items:
      - label: Living Room Temp
        value:
          zwave-thermostat-temp:
            nodeId: 5
        format: '%.1f°C'
        display: text
      
      - label: Bedroom Light
        value:
          zwave-switch-state:
            nodeId: 7
        display: text
      
      - label: Sensor Battery
        value:
          zwave-battery:
            nodeId: 2
        valueMax: 100
        display: progress
```

**Available value functions:**
- `zwave-thermostat-temp`: Get temperature from thermostat (requires `nodeId`)
- `zwave-battery`: Get battery level (requires `nodeId`)
- `zwave-switch-state`: Get switch state as 0/1 (requires `nodeId`)

## API Endpoints

Control endpoints for programmatic access:

### Set Thermostat Temperature
```bash
POST /api/zwave/thermostat/temperature
{
  "nodeId": 5,
  "temperature": 22.5,
  "setpointType": 1  # 1=heating, 2=cooling
}
```

### Set Thermostat Mode
```bash
POST /api/zwave/thermostat/mode
{
  "nodeId": 5,
  "mode": 1  # 0=off, 1=heat, 2=cool, 3=auto
}
```

### Toggle Switch
```bash
POST /api/zwave/switch/state
{
  "nodeId": 7,
  "isOn": true
}
```

### Set Dimmer Level
```bash
POST /api/zwave/dimmer/level
{
  "nodeId": 7,
  "level": 75  # 0-100
}
```

## Troubleshooting

### Driver won't start
- Check serial port path: `ls -la /dev/ttyUSB*`
- Verify permissions: `groups` should include `dialout`
- Check if another process is using the port: `lsof /dev/ttyUSB0`

### Devices not showing up
- Ensure devices are included in the Z-Wave network
- Check device interview status (must be complete)
- Wait for devices to wake up (battery devices may be asleep)

### Control commands not working
- Verify device supports the command class
- Check device status (must be alive/awake)
- Review server logs for error messages

### Performance issues
- Increase refresh intervals for less critical widgets
- Filter widgets by specific nodeIds to reduce polling
- Consider using status widget value functions for simple displays

## Architecture

```
┌─────────────────────────────────────────┐
│         Z-Wave USB Stick                │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      service.ts (Shared Driver)         │
│  - Single Z-Wave driver instance        │
│  - Lifecycle management                 │
│  - Error handling                       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           data.ts (Data Layer)          │
│  - Device discovery & filtering         │
│  - Control functions                    │
│  - Value functions                      │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
┌───────▼──┐ ┌────▼────┐ ┌─▼────────┐
│Thermostat│ │ Switch  │ │  Sensor  │
│  Widget  │ │ Widget  │ │  Widget  │
└──────────┘ └─────────┘ └──────────┘
```

## Command Classes

Common Z-Wave command classes used:

- `0x25`: Binary Switch
- `0x26`: Multilevel Switch (Dimmer)
- `0x30`: Binary Sensor
- `0x31`: Multilevel Sensor
- `0x32`: Meter (Power/Energy)
- `0x40`: Thermostat Setpoint
- `0x42`: Thermostat Operating State
- `0x44`: Thermostat Fan Mode
- `0x80`: Battery

## License

Part of the todash project.

