# Danfoss MT02650 Boost Implementation

## About Your Radiators

**Model**: Danfoss MT02650 (Danfoss Living Connect Z)
**Type**: Z-Wave radiator thermostat valve

## Boost Functionality

### How It Works

The Danfoss MT02650 does **not** have a dedicated Z-Wave "boost" command class. Instead, boost is implemented as:

1. **Temporary Temperature Override**: Increase setpoint by +5°C
2. **Timed Revert**: Automatically return to original temperature after 30 minutes
3. **Visual Indicator**: Boost button glows orange when active

### Implementation Details

```typescript
// Boost activates:
const boostTemp = currentTemp + 5;  // +5°C increase
const duration = 30 * 60 * 1000;    // 30 minutes

// After 30 minutes, automatically reverts to original temperature
```

### Customization

You can customize the boost behavior in `src/plugins/zwave/thermostat-widget.tsx`:

**Change boost temperature increase**:
```typescript
const boostTemp = device.targetTemperature + 5; // Change 5 to your preference
```

**Change boost duration**:
```typescript
setTimeout(async () => {
  // Revert logic
}, 30 * 60 * 1000); // Change 30 to minutes you want
```

## Physical Boost Button

Your Danfoss radiators also have a **physical boost button** on the device itself:
- Press the button on the radiator
- This activates a local boost mode
- Duration and temperature increase are configured on the device
- This is **independent** of the Z-Wave boost we implemented

## Console Messages

When you use the boost button, you'll see:

```
[Z-Wave Thermostat] Starting boost for node 19: 20°C → 25°C for 30 minutes
[Z-Wave Thermostat] Boost activated for node 19
[Wait 30 minutes]
[Z-Wave Thermostat] Reverting boost for node 19: 25°C → 20°C
[Z-Wave Thermostat] Boost ended for node 19
```

## Alternative Approaches

If you want different boost behavior, here are some options:

### Option 1: Longer Boost Duration
Change the timeout to 60 minutes:
```typescript
}, 60 * 60 * 1000); // 60 minutes
```

### Option 2: Higher Boost Temperature
Increase by 7°C instead of 5°C:
```typescript
const boostTemp = device.targetTemperature + 7;
```

### Option 3: Manual Revert
Remove the automatic revert and require manual temperature adjustment:
- Remove the `setTimeout` block
- User must manually lower temperature when done

### Option 4: Integration with Automation
Create a timed script that activates boost on all radiators:
```yaml
- title: Morning Boost
  cron: 0 6 * * 1-5
  enabled: true
  script:
    - setTempZWave: [19, 25]  # Boost hallway
    - setTempZWave: [20, 25]  # Boost office 1
    - setTempZWave: [21, 25]  # Boost office 2
```

Then revert 30 minutes later:
```yaml
- title: Morning Boost End
  cron: 30 6 * * 1-5
  enabled: true
  script:
    - setTempZWave: [19, 20]  # Normal temp
    - setTempZWave: [20, 20]
    - setTempZWave: [21, 20]
```

## Known Limitations

1. **Z-Wave Delay**: Temperature changes can take several minutes to reach the device
2. **No Boost Status**: We can't detect if the physical boost button was pressed
3. **Timer Persistence**: If you restart the server during boost, the timer is lost
4. **Battery Drain**: Frequent temperature changes drain battery faster

## Recommendations

- Use boost sparingly to preserve battery life
- Consider using automation schedules instead of manual boost
- The physical boost button on the radiator is more battery-efficient
- Monitor battery levels in the widget (shown in top-right corner)

## Future Improvements

Possible enhancements:
- [ ] Persist boost timers to database (survive server restart)
- [ ] Configurable boost duration per widget
- [ ] Boost all radiators at once button
- [ ] Boost history/statistics
- [ ] Integration with presence detection (auto-boost when arriving home)

