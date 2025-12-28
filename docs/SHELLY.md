# Shelly Controller Plugin

Concept document for managing a Shelly Blue Gen3 controller through todash.

## Goals

- Centralize control of Shelly TRV thermostats without touching individual devices directly.
- Keep configuration simple: secrets define connectivity, dashboard YAML selects which resources to show.

## Architecture

1. **Secrets**
   - `SHELLY_HOST`: Controller URL, e.g. `http://192.168.1.33`.
   - `SHELLY_USERNAME`: Controller account (default `admin`).
   - `SHELLY_PASSWORD`: Controller password (`xxxxxxxxxxxxx`).

2. **Data Provider** (`@plugins/shelly/data`)
   - Fetches controller info and thermostat status via RPC.
   - Falls back gracefully when controller list endpoints are unavailable.

3. **Server API** (`/api/shelly`)
   - `POST /api/shelly/rpc` forwards allow-listed RPC methods.
   - `GET /api/shelly/allowed-methods` exposes allowed method names for debugging.

4. **Widgets** (`@plugins/shelly`)
   - `shelly-thermostats`: Temperature and mode controls for TRVs.
   - All widgets consume `/api/widget/<type>` which forwards to the shared Shelly data provider.
   - `POST /api/shelly/layout/add` ensures the active dashboard contains the thermostat panel.

## Controller RPC Channels

- **HTTP**: Call `/rpc` with the full JSON-RPC frame or `/rpc/<Method>` using either POST (body holds params) or GET with query args. Digest/basic auth applies when enabled and there is no keep-alive.
- **Websocket**: Connect to `ws://<host>/rpc`. Include a `src` field in the first frame or the device will refuse to stream notifications.
- **MQTT**: Publish requests to `<device-id>/rpc`, subscribe to `<src>/rpc` for responses, and `<device-id>/events/rpc` for notifications. Online status is broadcast on `<device-id>/online`.
- **UDP**: Disabled by default; enable `udp_rpc` in `Sys` config to send or receive JSON frames over UDP.
- **Tools**: The `mos` CLI, `curl`, `websocat`, and `mosquitto` clients mirror the patterns above if we need manual testing.

## Discovering Controller Capabilities

- **Shelly.GetDeviceInfo** (`/shelly` mirror) returns id, model, firmware, auth flags, and tells us whether the device is multi-profile.
- **Shelly.ListMethods** reflects ACL/auth limits for the active channel and is the authoritative allowlist.
- **Shelly.GetComponents** enumerates every component instance; filter with `keys`, add `include=["status","config"]`, or page via `offset` to replace undocumented `*.List` calls.
- **Shelly.GetStatus / Shelly.GetConfig** aggregate component status/config so we can inventory devices without guessing ids.
- Missing docs: the public portal still 404s for `Actions` and `Thermostat` component pages, so rely on `Shelly.ListMethods` and `Shelly.GetComponents` output to verify support.

## Dashboard Configuration

```yaml
- panelType: single
   w: 3
   h: 2
   x: 1
   y: 5
   widget:
      type: shelly-thermostats
      title: Shelly Thermostats
      props:
         refreshSeconds: 20
         thermostats:
            - id: "shellytrv-1"
               label: "Living Room"
            - id: "shellytrv-2"
               label: "Bedroom"
```

- `thermostats` (optional): IDs as shown in Shelly Web UI. Adds friendly labels in the widget.
- `refreshSeconds`: Auto-refresh interval (default 15 seconds).

## UX Notes

- Thermostat adjustments send `Thermostat.SetTargetTemperature` with 0.5°C steps.
- Mode chips call `Thermostat.SetMode` (or `SetProfile` for `manual`/`schedule`).
- The controls layout helper now only adds the thermostat panel.

## Widget Data Expectations

- **shelly-thermostats**: Prefers `Thermostat.List` to auto-discover valves, but falls back to YAML-provided ids when the method is missing. Requires per-device `Thermostat.GetStatus`, `Thermostat.SetTargetTemperature`, `Thermostat.SetMode`, and `Thermostat.SetProfile` to stay enabled.

## Known Gaps

- Our Gen3 controller returns `Shelly RPC error 404: No handler for Thermostat.List` (code-only 404 with HTTP 200). Widgets already degrade gracefully, but we must define thermostats in dashboard YAML when auto-discovery fails.
- Scripts, schedules, and actions remain disabled until the controller exposes those namespaces.
- Official documentation for the thermostat list endpoint is absent; keep validating behavior with `Shelly.ListMethods` after firmware updates.

## Open Questions

- Exact field mapping for Shelly TRV status (verify `Thermostat.GetStatus` output structure on hardware).
- Additional controller resources worth surfacing (e.g., BLE devices, scene definitions).
- Whether we need optimistic UI for thermostat mode changes or keep current refetch approach.

## Next Steps

1. Validate thermostat RPC payloads against the live controller to confirm property names.
2. Extend tests with recorded fixtures once we capture real responses.
3. Revisit scripts/actions/schedules once the controller credentials or firmware expose the namespaces we need.
