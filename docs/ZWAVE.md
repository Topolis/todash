# Z-Wave Complete Guide

Complete guide for setting up and managing Z-Wave devices in todash.

## Table of Contents

- [Quick Start](#quick-start)
- [Hardware Setup](#hardware-setup)
- [Configuration](#configuration)
- [Admin Interface](#admin-interface)
- [Widgets](#widgets)
- [Device Management](#device-management)
- [Data Storage](#data-storage)
- [Troubleshooting](#troubleshooting)
- [Advanced Topics](#advanced-topics)

---

## Quick Start

Get your Z-Wave devices on your dashboard in 5 minutes!

### Prerequisites

- ✅ Z-Wave USB stick (e.g., Aeotec Z-Stick, Zooz ZST10)
- ✅ Z-Wave devices already included in your network
- ✅ Linux system with USB access

### Step 1: Find Your USB Stick (30 seconds)

```bash
ls -la /dev/tty* | grep -E "(USB|ACM)"
```

You should see `/dev/ttyUSB0` or `/dev/ttyACM0`.

### Step 2: Set Permissions (1 minute)

```bash
sudo usermod -a -G dialout $USER
# Log out and back in, or:
newgrp dialout
```

### Step 3: Configure (1 minute)

Create `secrets.json` in project root:

```json
{
  "ZWAVE_SERIAL_PORT": "/dev/ttyUSB0"
}
```

Set environment variable:

```bash
export SECRETS_FILE=secrets.json
```

### Step 4: Start Server (30 seconds)

```bash
npm run dev
```

### Step 5: Add Widgets (2 minutes)

Edit your dashboard YAML:

```yaml
panels:
  - panelType: single
    x: 1
    y: 1
    w: 4
    h: 4
    widget:
      type: zwave-thermostat
      title: Climate Control
      props:
        refreshSeconds: 10
```

**Done!** Your Z-Wave devices are now on your dashboard.

---

## Hardware Setup

### Supported USB Sticks

- ✅ Aeotec Z-Stick Gen5/Gen5+
- ✅ Zooz ZST10 700 Series
- ✅ Silicon Labs UZB-7
- ✅ Any Z-Wave 500/700 series USB controller

### Linux Setup

**Find device path:**
```bash
ls -la /dev/tty* | grep -E "(USB|ACM)"
```

**Set permissions:**
```bash
sudo usermod -a -G dialout $USER
```

**Use persistent path (recommended):**
```bash
ls -la /dev/serial/by-id/
# Use this path in secrets.json
```

### WSL2 Setup (Development)

For development on Windows with WSL2:

**1. Install usbipd-win on Windows:**
```powershell
winget install --interactive --exact dorssel.usbipd-win
```

**2. Install USB/IP tools in WSL2:**
```bash
sudo apt update
sudo apt install linux-tools-generic hwdata
sudo update-alternatives --install /usr/local/bin/usbip usbip /usr/lib/linux-tools/*-generic/usbip 20
```

**3. Attach USB stick (run in Windows PowerShell as Admin):**
```powershell
# List devices
usbipd list

# Bind the Z-Wave stick (one-time)
usbipd bind --busid 1-4

# Attach to WSL2
usbipd attach --wsl --busid 1-4
```

**4. Verify in WSL2:**
```bash
ls -la /dev/ttyACM0
```

**Note:** You'll need to re-attach after each Windows reboot.

---

## Configuration

### Basic Configuration

**secrets.json:**
```json
{
  "ZWAVE_SERIAL_PORT": "/dev/ttyUSB0"
}
```

**Environment variable:**
```bash
export SECRETS_FILE=secrets.json
```

### Security Keys

**S0 Legacy (older devices):**
```json
{
  "ZWAVE_SERIAL_PORT": "/dev/ttyUSB0",
  "ZWAVE_NETWORK_KEY": "your_32_character_hex_key"
}
```

Generate a key:
```bash
openssl rand -hex 16
```

**S2 Security (newer devices):**
```json
{
  "ZWAVE_SERIAL_PORT": "/dev/ttyUSB0",
  "ZWAVE_S2_UNAUTH_KEY": "hex_key_here",
  "ZWAVE_S2_AUTH_KEY": "hex_key_here",
  "ZWAVE_S2_ACCESS_KEY": "hex_key_here"
}
```

### Data Storage

Z-Wave data is stored in:
```
/var/projects/todash/cache/
├── [controller-id].jsonl           # Node metadata
├── [controller-id].values.jsonl    # Current values
└── [controller-id].metadata.jsonl  # Value metadata
```

**Features:**
- ✅ Persistent across restarts
- ✅ Automatic backup on changes
- ✅ JSONL format (one JSON object per line)
- ✅ Efficient incremental updates

**Backup:**
```bash
# Backup cache directory
cp -r cache cache.backup

# Restore
cp -r cache.backup/* cache/
```

---

## Admin Interface

Access the Z-Wave management interface at:
**http://localhost:5173/zwave/admin**

Or click the **Z-Wave icon** (📡) in the dashboard toolbar.

### Nodes Tab

View and manage all Z-Wave devices.

**Node Information:**
- Node ID and name (editable)
- Location (editable)
- Manufacturer and model
- Status (Alive, Awake, Asleep, Dead)
- Device type and capabilities

**Node Actions:**
- ✏️ **Edit** - Change name and location
- 🔄 **Re-interview** - Refresh device capabilities
- 🏥 **Heal** - Optimize routes
- 🗑️ **Remove** - Remove failed nodes

**Detailed View:**

Click **▼** to expand and see:
- Device information (firmware, interview status)
- Communication statistics (TX/RX, drops, timeouts)
- All values table (every property the device exposes)

### Controller Tab

View controller information:
- Hardware details
- Z-Wave protocol version
- Home ID
- Total node count
- Network statistics

### Network Tools Tab

**Device Inclusion:**
1. Click "Start Inclusion"
2. Put device in inclusion mode (see device manual)
3. Wait for device to be added
4. Auto-timeout after 60 seconds

**Device Exclusion:**
1. Click "Start Exclusion"
2. Put device in exclusion mode
3. Wait for device to be removed

**Network Healing:**
- Heal entire network (optimizes all routes)
- Can take several minutes
- Run monthly for best performance

### Naming Nodes

**Why name your nodes?**
- Easier identification in widgets
- Better organization
- Clearer logs and debugging

**How to name:**
1. Open Z-Wave Admin
2. Click ✏️ edit icon next to node
3. Enter name (e.g., "Living Room Thermostat")
4. Enter location (e.g., "Living Room")
5. Click Save

**Naming conventions:**
```
Name: [Room] [Device Type]
Location: [Room]

Examples:
- Name: "Living Room Thermostat", Location: "Living Room"
- Name: "Kitchen Light", Location: "Kitchen"
- Name: "Bedroom Sensor", Location: "Bedroom"
```

### Node Health Monitoring

**Status Indicators:**
- 🟢 **Alive** - Device is responsive
- 🔵 **Awake** - Battery device is awake
- 🟡 **Asleep** - Battery device is sleeping (normal)
- 🔴 **Dead** - Device not responding (needs attention)

**Communication Statistics:**

Expand node to see:
- **TX/RX counts** - Commands sent/received
- **Dropped commands** - Failed transmissions
- **Timeouts** - Communication failures

**Health indicators:**
- High drop rate (>10%) = poor signal
- Many timeouts = device issues or interference
- Low TX/RX = device rarely communicates

**Improving health:**
1. Add repeaters (mains-powered devices)
2. Heal network to optimize routes
3. Move device closer to controller
4. Check for interference (WiFi, metal objects)
5. Replace batteries in battery devices

---

## Widgets

### Thermostat Widget

Control Z-Wave thermostats with boost functionality.

**Configuration:**
```yaml
widget:
  type: zwave-thermostat
  title: Climate Control
  props:
    nodeId: 19              # Optional: specific node
    refreshSeconds: 30
```

**Features:**
- Current and target temperature display
- +/- buttons for temperature adjustment
- 🔥 Boost button (+5°C for 30 minutes)
- Battery level indicator
- Circular arc design

**Boost Functionality:**
- Click 🔥 button to activate
- Increases temperature by +5°C
- Automatically reverts after 30 minutes
- Orange glow when active

**Danfoss MT02650 Notes:**
- No dedicated Z-Wave boost command
- Boost implemented as temporary setpoint override
- Physical boost button on device also available
- See [DANFOSS_BOOST.md](DANFOSS_BOOST.md) for details

### Switch Widget

Control Z-Wave switches and dimmers.

**Configuration:**
```yaml
widget:
  type: zwave-switch
  title: Lights
  props:
    nodeIds: [5, 7, 9]      # Optional: filter nodes
    refreshSeconds: 10
```

**Features:**
- On/Off toggle for switches
- Dimmer slider for dimmable devices
- Device name and status
- Battery level (if applicable)

### Sensor Widget

Monitor Z-Wave sensors.

**Configuration:**
```yaml
widget:
  type: zwave-sensor
  title: Sensors
  props:
    sensorTypes: ["Air temperature", "Humidity"]
    refreshSeconds: 30
```

**Supported sensor types:**
- Air temperature
- Humidity
- Luminance
- Power
- Voltage
- Current
- Motion
- Door/Window status

### Temperature History Widget

Display historical temperature data.

**Configuration:**
```yaml
widget:
  type: temperature-history
  title: Temperature History
  props:
    nodeId: 15
    hours: 48
    refreshSeconds: 300
```

**Features:**
- 48-hour temperature graph
- Smooth curve interpolation
- Min/Max display
- Persistent storage
- See [TEMPERATURE_HISTORY.md](TEMPERATURE_HISTORY.md) for details

---

## Device Management

### Adding Devices

**Method 1: Z-Wave Admin Interface**
1. Open Z-Wave Admin
2. Go to Network Tools tab
3. Click "Start Inclusion"
4. Put device in inclusion mode
5. Wait for device to appear

**Method 2: Physical Button**
- Some controllers have inclusion button
- Press button on controller
- Put device in inclusion mode

**Inclusion modes:**
- **S2 Security** (recommended for new devices)
- **S0 Security** (legacy)
- **No Security** (not recommended)

### Removing Devices

**Normal removal:**
1. Z-Wave Admin → Network Tools
2. Click "Start Exclusion"
3. Put device in exclusion mode
4. Device will be removed

**Failed node removal:**
1. Z-Wave Admin → Nodes tab
2. Find failed node (status: Dead)
3. Click 🗑️ Remove button
4. Confirm removal

### Re-interviewing Devices

If device capabilities change or aren't detected:

1. Z-Wave Admin → Nodes tab
2. Find the device
3. Click 🔄 Re-interview
4. Wait for interview to complete

### Healing Network

**When to heal:**
- After adding/removing devices
- After moving devices
- Monthly maintenance
- Poor device performance

**How to heal:**
1. Z-Wave Admin → Network Tools
2. Click "Heal Network"
3. Wait for completion (can take minutes)

**Individual node heal:**
1. Nodes tab → Find device
2. Click 🏥 Heal button

---

## Troubleshooting

### Permission Denied

```bash
# Check permissions
ls -la /dev/ttyUSB0

# Add to dialout group
sudo usermod -a -G dialout $USER

# Log out and back in
```

### Port Already in Use

```bash
# Find what's using it
sudo lsof /dev/ttyUSB0

# Stop other application or kill process
```

### Devices Not Showing

1. Check interview status (must be complete)
2. Wake battery devices
3. Wait for initial interview
4. Check device is included in network

### Commands Not Working

1. Check device status (must be alive/awake)
2. Verify command class support
3. Wake battery devices
4. Check server logs for errors

### Poor Performance

1. Increase refresh intervals
2. Filter by node IDs
3. Add repeaters to network
4. Heal network
5. Check for interference

### Driver Won't Start

1. Verify USB stick connected
2. Check serial port path
3. Review server logs
4. Try different USB port
5. Check permissions

---

## Advanced Topics

### Custom Serial Port

Use persistent device path:

```bash
ls -la /dev/serial/by-id/
```

```json
{
  "ZWAVE_SERIAL_PORT": "/dev/serial/by-id/usb-0658_0200-if00"
}
```

### Environment Variables

Alternative to secrets.json:

```bash
export ZWAVE_SERIAL_PORT=/dev/ttyUSB0
export ZWAVE_NETWORK_KEY=your_key
npm run dev
```

### Migration from Other Systems

**From Home Assistant:**
1. Export network key from HA
2. Add to todash secrets.json
3. Devices should work immediately

**From OpenZWave:**
- May need to re-include devices
- Use Z-Wave JS UI for migration

### Security Best Practices

1. Keep secrets.json secure (add to .gitignore)
2. Use S2 security for new devices
3. Rotate network keys periodically
4. Limit physical access to USB stick
5. Use HTTPS for external access

### Performance Optimization

1. **Increase refresh intervals:**
   ```yaml
   refreshSeconds: 60  # Instead of 10
   ```

2. **Filter by node IDs:**
   ```yaml
   nodeIds: [5, 7, 9]
   ```

3. **Group devices** in tabbed panels

4. **Use status widget** for simple displays

### Backup and Restore

**Backup:**
```bash
# Backup cache
cp -r cache cache.backup

# Backup secrets
cp secrets.json secrets.json.backup
```

**Restore:**
```bash
cp -r cache.backup/* cache/
cp secrets.json.backup secrets.json
```

---

## Resources

- [Z-Wave JS Documentation](https://zwave-js.github.io/node-zwave-js/)
- [Z-Wave JS UI](https://github.com/zwave-js/zwave-js-ui)
- [Device Database](https://devices.zwave-js.io/)
- [Z-Wave Alliance](https://z-wavealliance.org/)

## Related Documentation

- [Temperature History Widget](TEMPERATURE_HISTORY.md)
- [Danfoss Boost](DANFOSS_BOOST.md)
- [Smart Home Dashboard](SMARTHOME_DASHBOARD.md)
- [Logging System](LOGGING.md)

