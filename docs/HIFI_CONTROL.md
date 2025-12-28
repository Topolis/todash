# HiFi Control Widget

Concept for a universal HiFi control widget with device-type abstraction.

## Overview

The HiFi Control Widget is a device-independent control system for AV receivers, amplifiers, and other HiFi devices. Widget functions are implemented generically, while actual communication with the device is determined by configurable device types.

## Architecture

### Widget (Device-Agnostic)

The widget provides general control functions:

- **Power Control**: On/Off/Toggle
- **Volume Control**: Volume up/down, Mute/Unmute, direct value
- **Input Selection**: HDMI inputs, other sources
- **Information Display**: Current status, active input, volume
- **Advanced Features** (device-dependent):
  - Surround mode selection
  - Zone control (multi-room)
  - Audio processing options
  - Display brightness
  - Equalizer/tone controls

### Device Type Architecture

Similar to the Shelly plugin approach:

```
Widget (Generic UI) 
    ↓
Widget Data Layer (Generic Functions)
    ↓
Device Type Handler (Device-Specific Implementation)
    ↓
API/Protocol Layer (HTTP, Telnet, etc.)
    ↓
Physical Device
```

### Configuration Structure

**Dashboard YAML** (settings section):
```yaml
name: My Dashboard
settings:
  hifi-control:
    device:
      type: denon-avr
      host: 192.168.2.167
      port: 80
      username: ""
      password: ""

panels:
  - panelType: single
    x: 1
    y: 1
    w: 4
    h: 3
    widget:
      type: hifi-control
      title: AV Receiver
      props:
        refreshSeconds: 5
        showPower: true
        showVolume: true
        showInputs: true
        showAdvanced: false
        customInputs:
          - id: bd
            label: "Blu-ray Player"
            icon: movie
          - id: game
            label: "PlayStation"
            icon: videogame_asset
          - id: tv
            label: "TV"
            icon: tv
```

## Device Type: Denon AVR (Initial Implementation)

### Denon AVR-X2700H API Capabilities

Basierend auf dem Denon IP Control Protocol:

#### 1. Power Control
- **Commands**: 
  - `PWON` - Power on
  - `PWSTANDBY` - Standby mode
  - `PW?` - Query power status
- **Response**: `PWON` or `PWSTANDBY`

#### 2. Main Zone Volume
- **Commands**:
  - `MV<level>` - Set volume (00-98, e.g. MV45 = 45%)
  - `MVUP` - Volume up
  - `MVDOWN` - Volume down
  - `MV?` - Query volume
- **Response**: `MV<level>` (e.g. MV45)
- **Note**: Volume is in 0.5dB steps, represented as 00-98

#### 3. Mute Control
- **Commands**:
  - `MUON` - Mute on
  - `MUOFF` - Mute off
  - `MU?` - Query mute status
- **Response**: `MUON` or `MUOFF`

#### 4. Input Source Selection
- **Commands**:
  - `SI<source>` - Select input
  - `SI?` - Query current input
- **Common Sources**:
  - `SIBD` - Blu-ray
  - `SIGAME` - Game
  - `SITV` - TV Audio
  - `SISAT/CBL` - Satellite/Cable
  - `SIMPLAY` - Media Player
  - `SINET` - Network/Streaming
  - `SIBT` - Bluetooth
  - `SIAUX1` - Aux Input 1
  - `SIAUX2` - Aux Input 2
  - `SITUNER` - Tuner
  - `SIPHONO` - Phono
- **Response**: `SI<source>`

#### 5. Surround Mode
- **Commands**:
  - `MS<mode>` - Select surround mode
  - `MS?` - Query mode
- **Common Modes**:
  - `MSMOVIE` - Movie
  - `MSMUSIC` - Music
  - `MSGAME` - Game
  - `MSDIRECT` - Direct/Pure
  - `MSSTEREO` - Stereo
  - `MSDOLBY DIGITAL` - Dolby Digital
  - `MSDTS SURROUND` - DTS
  - `MSMCH STEREO` - Multi-Channel Stereo
- **Response**: `MS<mode>`

#### 6. Zone 2 Control (Multi-Room)
- **Commands**:
  - `Z2ON` / `Z2OFF` - Zone 2 power
  - `Z2<volume>` - Zone 2 volume (00-98)
  - `Z2MU<ON/OFF>` - Zone 2 mute
  - `Z2<source>` - Zone 2 input selection
- **Response**: Similar to main zone

#### 7. Zone 3 Control
- **Commands**: Similar to Zone 2, prefix `Z3`

#### 8. Display Control
- **Commands**:
  - `DIM <level>` - Display brightness (BRI, DIM, DAR, OFF)
  - `DIM?` - Query brightness
- **Response**: `DIM<level>`

#### 9. Video Select Mode
- **Commands**:
  - `SV<source>` - Select video source
  - `SV?` - Query video source
- **Common Options**:
  - `SVDVD` - DVD
  - `SVBD` - Blu-ray
  - `SVTV` - TV
  - `SVSAT/CBL` - Satellite/Cable
  - `SVGAME` - Game
  - `SVAUX` - Auxiliary
  - `SVCD` - CD
- **Response**: `SV<source>`

#### 10. Audio Parameter Controls
- **Tone Control**:
  - `PSTONE CTRL <ON/OFF>` - Enable/disable tone controls
  - `PSBAS <level>` - Bass level (00-12, 50=neutral)
  - `PSTRE <level>` - Treble level (00-12, 50=neutral)
- **Dynamic EQ**:
  - `PSDYNEQ <ON/OFF>` - Dynamic EQ
- **Dynamic Volume**:
  - `PSDYNVOL <OFF/LIT/MED/HEV>` - Dynamic volume level
- **Reference Level**:
  - `PSREFLEV <0/5/10/15>` - Reference level offset

#### 11. HDMI/Video Processing
- **Commands**:
  - `VSSC<mode>` - Video scaling (48P, 10I, 72P, 10P, 4K, etc.)
  - `VSASP<mode>` - Aspect ratio (NRM, FULL)
  - `VS?` - Query video settings

#### 12. Info/Status Queries
- **Commands**:
  - `NSE` - Request full status
  - `NSA` - Network status/info
- **Response**: Multiple lines with current settings

#### 13. Tuner Functions
- **Commands**:
  - `TMAN` / `TFAN` - AM/FM tuner
  - `TPAN<freq>` - Tune to frequency
  - `TF<freq>` - FM frequency
  - `TA<freq>` - AM frequency

#### 14. Network/HEOS Functions
- **HEOS Protocol** (separate API):
  - Streaming control
  - Multi-room grouping
  - Playlist management
  - Online service integration (Spotify, Tidal, etc.)
  - Note: HEOS uses separate JSON-RPC protocol on port 1255

### Device Type Implementation Structure

```typescript
interface DeviceType {
  id: string;
  displayName: string;
  
  // Connection
  connect(config: DeviceConfig): Promise<DeviceConnection>;
  
  // Capabilities
  capabilities: DeviceCapabilities;
  
  // Commands
  powerOn(): Promise<void>;
  powerOff(): Promise<void>;
  setVolume(level: number): Promise<void>;
  volumeUp(): Promise<void>;
  volumeDown(): Promise<void>;
  mute(): Promise<void>;
  unmute(): Promise<void>;
  setInput(input: string): Promise<void>;
  
  // Status
  getStatus(): Promise<DeviceStatus>;
  
  // Advanced (optional)
  setSurroundMode?(mode: string): Promise<void>;
  setZone2Power?(on: boolean): Promise<void>;
  // ... more advanced functions
}

interface DeviceCapabilities {
  supportsPower: boolean;
  supportsVolume: boolean;
  volumeRange: { min: number; max: number };
  supportsInputs: boolean;
  availableInputs: Input[];
  supportsMute: boolean;
  supportsSurroundModes: boolean;
  availableSurroundModes?: string[];
  supportsMultiZone: boolean;
  zones?: number;
  supportsHDMI: boolean;
  supportsNetworkStreaming: boolean;
  supportsEqualizer: boolean;
}

interface DeviceStatus {
  power: 'on' | 'standby' | 'off' | 'unknown';
  volume: number;
  volumePercent: number;
  muted: boolean;
  currentInput: string;
  currentSurroundMode?: string;
  zone2Power?: boolean;
  zone2Volume?: number;
  displayBrightness?: string;
}
```

## Widget Features by Priority

### Phase 1: Core Features (MVP)
- ✅ Power on/off/standby
- ✅ Volume slider (0-100%)
- ✅ Volume up/down buttons
- ✅ Mute toggle
- ✅ Input selection (grid or dropdown)
- ✅ Current status display (power, volume, input)

### Phase 2: Enhanced Features
- ⏳ Surround mode selection
- ⏳ Volume display in dB
- ⏳ Input icons/labels customization
- ⏳ Quick presets (saved input/volume combinations)
- ⏳ Display brightness control

### Phase 3: Advanced Features
- 🔲 Zone 2/3 control
- 🔲 Audio parameter controls (bass, treble, dynamic EQ)
- 🔲 HDMI info display
- 🔲 Network streaming status (HEOS integration)
- 🔲 Custom automation/macros
- 🔲 Activity-based control ("Watch Movie", "Listen to Music")

## Technical Implementation Plan

### File Structure

```
src/plugins/hifi-control/
├── index.ts              # Plugin registration
├── widget.tsx            # Main widget component
├── data.ts               # Data provider & types
├── api.ts                # Express API routes
├── shared.ts             # Shared utilities & hooks
├── device-types/         # Device type implementations
│   ├── base.ts          # Base interface & common code
│   ├── denon-avr.ts     # Denon AVR implementation
│   └── index.ts         # Device type registry
└── __tests__/
    ├── denon-avr.test.ts
    └── widget.test.tsx
```

### API Endpoints

```
POST /api/hifi/command
  Body: { command: string, params?: any }
  Response: { success: boolean, result?: any, error?: string }

GET /api/hifi/status
  Response: { status: DeviceStatus }

GET /api/hifi/capabilities
  Response: { capabilities: DeviceCapabilities }

POST /api/hifi/preset
  Body: { name: string, input: string, volume: number }
  Response: { success: boolean }

GET /api/hifi/presets
  Response: { presets: Preset[] }
```

### Denon Protocol Communication

#### HTTP Method (Preferred)
```typescript
async function sendDenonCommand(command: string): Promise<string> {
  const url = `http://${host}:${port}/goform/formiPhoneAppDirect.xml?${command}`;
  const response = await fetch(url);
  return await response.text();
}
```

#### Telnet Method (Alternative)
```typescript
import * as net from 'net';

async function sendDenonTelnetCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ host, port: 23 }, () => {
      client.write(command + '\r');
    });
    
    client.on('data', (data) => {
      resolve(data.toString());
      client.end();
    });
    
    client.on('error', reject);
  });
}
```

## Widget UI Design

### Layout Structure

```
┌─────────────────────────────────────┐
│ AV Receiver              🔌 STANDBY │  ← Header with power status
├─────────────────────────────────────┤
│                                      │
│  Current: Blu-ray Player   🔊 42%   │  ← Status line
│                                      │
│  ┌───┐  ┌───┐  ┌───┐  ┌───┐        │
│  │TV │  │BD │  │PS5│  │NET│        │  ← Input selection
│  └───┘  └───┘  └───┘  └───┘        │
│                                      │
│  ┌────────────────────────┐         │
│  │ [-]  ████████░░  [+]   │ [🔇]   │  ← Volume control
│  └────────────────────────┘         │
│                                      │
│  Surround: [Dolby Digital]   ▼      │  ← Surround mode (optional)
│                                      │
└─────────────────────────────────────┘
```

### Responsive Behavior

- **Compact (w=2-3)**: 
  - Power, volume, mute only
  - Input dropdown instead of grid
  
- **Medium (w=4-5)**:
  - Full input grid (4-6 items)
  - Volume slider
  - Surround mode dropdown
  
- **Large (w=6+)**:
  - Extended input grid
  - Zone controls
  - Audio parameters

## Open Questions for Tobe

1. **Denon API Access**:
   - Do you already have access to the AVR-X2700H on the network?
   - What IP address does the device have?
   - Is HTTP control enabled? (usually default)

2. **Widget Priorities**:
   - Which functions are most important to you?
   - Do you need Zone 2/3 control? (Multi-Room)
   - Is HEOS integration (streaming) important?

3. **Input Labels**:
   - Which HDMI inputs do you use?
   - How should they be named? (e.g. "BD" → "Blu-ray Player")
   - Do you need icons or just text?

4. **Presets/Activities**:
   - Do you want predefined "scenes"? (e.g. "Watch Movie" = Blu-ray + Surround + Volume 45)
   - Or is manual control sufficient?

5. **Additional Devices**:
   - Do you plan to integrate other devices later?
   - If yes, which types? (other Denon models, Yamaha, Onkyo, etc.)

## Concerns & Alternatives

### Concern 1: Protocol Documentation

**Problem**: The official Denon IP Control Protocol documentation is not always publicly available.

**Solutions**:
- Use community documentation (GitHub, Home Assistant Integration)
- Reverse engineering through network sniffing of the Denon app
- Contact Denon Developer Portal

**My Recommendation**: Start with Home Assistant's Denon AVR integration - they already have a well-tested implementation.

### Concern 2: Polling vs. Events

**Problem**: Denon AVR has no native push notification for status changes.

**Solutions**:
- **Polling** (simple): Query status every 2-5 seconds
- **Telnet Stream** (better): Permanent Telnet connection that automatically sends updates
- **Hybrid**: Telnet for updates + HTTP for commands

**My Recommendation**: Start with polling (simpler), upgrade to Telnet stream later if needed.

### Concern 3: Volume Mapping

**Problem**: Denon uses 0.5dB steps (00-98), but UI should show 0-100%.

**Solution**: Linear conversion with helper functions:
```typescript
function percentToDenonVolume(percent: number): number {
  return Math.round((percent / 100) * 98);
}

function denonVolumeToPercent(volume: number): number {
  return Math.round((volume / 98) * 100);
}
```

### Alternative Approaches

#### Alternative 1: HEOS-Only Integration

**Advantages**:
- Modern JSON-RPC API
- Push events for status updates
- Streaming integration included

**Disadvantages**:
- Only works with HEOS-capable devices
- Some low-level functions not available
- More complex API

#### Alternative 2: MQTT-Based

**Advantages**:
- Standard home automation protocol
- Easy integration with other systems
- Push notifications

**Disadvantages**:
- Requires MQTT broker
- Denon has no native MQTT (needs bridge)
- Additional complexity

**My Recommendation**: Stick with direct HTTP/Telnet integration for Phase 1, HEOS for Phase 3.

## Next Steps

1. **Get feedback from Tobe**:
   - Confirm architecture
   - Answer open questions
   - Prioritize features

2. **Obtain API documentation**:
   - Denon IP Control Protocol for AVR-X2700H
   - Test HTTP commands with Tobe's device

3. **Proof of Concept**:
   - Implement basic device type for Denon
   - Simple widget with Power/Volume/Input
   - HTTP-based communication

4. **Iterative expansion**:
   - Implement Phase 1 features
   - Gather user feedback
   - Phase 2/3 based on needs

## References & Resources

- [Denon AVR Control Protocol (community docs)](https://github.com/search?q=denon+avr+protocol)
- [Home Assistant Denon AVR Integration](https://www.home-assistant.io/integrations/denonavr/)
- [AVR-X2700H Manual](https://manuals.denon.com/AVRX2700H/)
- Similar projects:
  - [node-denon-avr](https://github.com/search?q=node+denon+avr)
  - [denonavr Python library](https://github.com/ol-iver/denonavr)
