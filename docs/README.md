# Todash Documentation

Complete documentation for the Todash dashboard system.

## Quick Start Guides

### Getting Started
- [Main README](../README.md) - Project overview and installation
- [Z-Wave Setup](ZWAVE_SETUP.md) - Get Z-Wave devices working in 5 minutes
- [Unsplash Wallpaper](UNSPLASH_WALLPAPER.md) - Add beautiful backgrounds

### Development
- See main [README](../README.md) for plugin development guide

## Feature Documentation

### Dashboard Features
- [Smart Home Dashboard](SMARTHOME_DASHBOARD.md) - Smart home automation setup

### Logging & Debugging
- [Logging System](LOGGING.md) - Built-in log viewer and debugging

### Notifications
- [Notification System](#notification-system) - User-facing messages from services and widgets

### Wallpapers
- [Unsplash Integration](UNSPLASH_WALLPAPER.md) - Photo wallpaper setup and configuration

## Z-Wave Documentation

### Setup & Configuration
- [Z-Wave Setup Guide](ZWAVE_SETUP.md) - Complete setup instructions
- [WSL2 USB Setup](zwave-wsl2-usb-setup.md) - Development setup for WSL2

### Management
- [Z-Wave Admin Interface](ZWAVE_ADMIN.md) - Network management and device control
- [Naming Nodes](ZWAVE_NAMING_NODES.md) - Organize your devices
- [Node Health Monitoring](ZWAVE_NODE_HEALTH.md) - Monitor device health

### Advanced Topics
- [Data Storage](ZWAVE_DATA_STORAGE.md) - How Z-Wave data is stored
- [Danfoss Boost](DANFOSS_BOOST.md) - Thermostat boost functionality

## Widget Documentation

### Temperature & Climate
- [Temperature History Widget](TEMPERATURE_HISTORY.md) - Historical temperature graphs
- [Danfoss Boost](DANFOSS_BOOST.md) - Radiator boost functionality

### Z-Wave Widgets
- Z-Wave Thermostat - See [Z-Wave Admin](ZWAVE_ADMIN.md)
- Z-Wave Switch - See [Z-Wave Admin](ZWAVE_ADMIN.md)
- Z-Wave Sensor - See [Z-Wave Admin](ZWAVE_ADMIN.md)

## Architecture & Technical

### System Design
- Main [README](../README.md) - Architecture overview
- [Logging System](LOGGING.md) - Logging architecture
- [Z-Wave Guide](ZWAVE.md) - Z-Wave data storage and architecture

---

## Notification System

Todash has a built-in notification system for surfacing messages to the user from any server-side service, widget, or the app itself.

### UI

A bell icon in the top-right of the header shows a red badge with the number of unread notifications. Clicking it opens a dialog that lists all notifications with:

- A coloured severity icon (debug / info / warn / error)
- The origin label and timestamp
- A rendered Markdown text block
- A ✕ button to dismiss individually, and a "Dismiss all" button

The bell polls for new notifications every 30 seconds automatically.

### Sending a notification

Make a `POST` request to the notifications API from any server-side code or external service:

```
POST /api/notifications
Content-Type: application/json

{
  "origin": "My Service",
  "severity": "warn",
  "message": "**Sensor offline** — no data received since 14:30. [Check device](#)."
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `origin` | string | yes | Short label identifying the sender (e.g. `"Weather"`, `"Z-Wave"`) |
| `severity` | string | yes | One of `debug`, `info`, `warn`, `error` |
| `message` | string | yes | Markdown text shown to the user |

The response is `201 Created` with the created notification object including its `id` and `timestamp`.

### From server-side code (TypeScript)

```typescript
import { notificationStore } from '@server/notifications';

notificationStore.add('My Plugin', 'error', 'Something went **wrong**.');
```

### API reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/notifications` | List all active notifications |
| `POST` | `/api/notifications` | Create a notification |
| `DELETE` | `/api/notifications/:id` | Dismiss a single notification |
| `DELETE` | `/api/notifications` | Dismiss all notifications |

### Storage

Notifications are stored in memory on the server (max 200 entries, oldest dropped first). They are cleared on server restart.

## Examples

See `docs/examples/` for:
- Dashboard configuration examples
- Widget configuration samples
- Integration examples

## Contributing

See the main [README](../README.md) for:
- Development setup
- Plugin creation guide
- Code structure
- Build and deployment

## Support

For issues and questions:
1. Check the relevant documentation above
2. Review the [Logging Guide](LOGGING.md) for debugging
3. Check the built-in log viewer (🐛 icon in dashboard)
4. Review example configurations in `docs/examples/`

