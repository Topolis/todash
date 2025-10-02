# Todash: Extensible Dashboard (Unified Vite + TypeScript)

## Overview

Todash is a modern, extensible dashboard application built with:
- **Unified codebase**: Single application with both frontend and backend
- **TypeScript**: Full type safety across the entire stack
- **Vite**: Fast development with hot module replacement
- **React + MUI**: Modern UI components and theming
- **Express**: Backend API server
- **Plugin system**: Easy to extend with new widget types
- **Centralized logging**: Built-in log viewer for easy debugging

## Quick Start

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

This starts:
- **Vite dev server** on http://localhost:5173 (frontend with HMR)
- **Express API server** on http://localhost:4000 (backend)

Open http://localhost:5173 in your browser.

### Production Build
```bash
npm run build  # Build both frontend and backend
npm start      # Start production server on port 4000
```

### Production Deployment (systemd)

For production deployment with systemd service:

**1. Initial setup:**
```bash
# Create systemd service file at /etc/systemd/system/todash.service
# See server/todash.service for example configuration

sudo systemctl daemon-reload
sudo systemctl enable todash
sudo systemctl start todash
```

**2. Update deployed service:**
```bash
# Use the update script to pull changes, build, and restart
./update-service.sh
```

The update script performs:
- `git pull` - Pull latest changes
- `npm run build` - Build the application
- `sudo chown -R todash:users .` - Fix file permissions
- `sudo systemctl restart todash` - Restart the service
- Verify service is running and show status

## Project Structure

```
src/
├── main.tsx                 # React entry point
├── server.ts                # Express server entry point
├── app/                     # Frontend code
│   ├── App.tsx             # Main React component
│   ├── components/         # Shared React components
│   │   ├── DashboardCard.tsx
│   │   ├── DashboardGrid.tsx
│   │   ├── GridContext.tsx
│   │   ├── WidgetRenderer.tsx
│   │   └── SaveLayoutBar.tsx
│   └── lib/                # Frontend utilities
│       ├── retryFetch.ts
│       └── dateFormat.ts
├── server/                  # Backend code
│   ├── api.ts              # API route handlers
│   ├── cache.ts            # Caching utilities
│   ├── secrets.ts          # Secrets management
│   ├── schema.ts           # Validation schemas
│   └── valueFunctions.ts   # Status widget value functions
├── plugins/                 # Plugin system
│   ├── index.ts            # Plugin registry
│   └── [plugin-name]/      # Individual plugins
│       ├── index.ts        # Plugin definition
│       ├── widget.tsx      # React component
│       └── data.ts         # Data provider
└── types/                   # TypeScript definitions
    ├── plugin.ts           # Plugin interfaces
    ├── dashboard.ts        # Dashboard types
    └── api.ts              # API types

dashboards/                  # YAML configuration files
├── sample.yaml
└── [your-dashboards].yaml
```

## Dashboard Configuration (YAML)

Dashboards are configured using YAML files in the `dashboards/` directory.

Example: `dashboards/sample.yaml`

```yaml
name: Sample Dashboard
settings:
  dateFormat: "DD.MM.YYYY HH:mm"
  defaultLocation:
    latitude: 48.1351
    longitude: 11.5820

grid:
  columns: 12
  gap: 12
  rowHeight: 120

widgets:
  - type: weather
    title: Current Weather
    x: 1
    y: 1
    w: 3
    h: 2
    props:
      latitude: 48.1351
      longitude: 11.5820
```

### Configuration Options

**Settings:**
- `dateFormat`: Date format string (e.g., "YYYY-MM-DD HH:mm")
- `apiKeys`: API keys for external services
  - `unsplash`: Unsplash API key for photo wallpapers

**Grid:**
- `columns`: Number of columns (default: 12)
- `gap`: Gap between widgets in pixels (default: 12)
- `rowHeight`: Height of each row in pixels (default: 120)

**Wallpaper:**
- `type`: Wallpaper type (`nebula`, `waves`, `unsplash`)
- `props`: Wallpaper-specific configuration (see [Wallpapers README](src/wallpapers/README.md))

**Widget:**
- `type`: Widget type (must match registered plugin name)
- `title`: Display title
- `subtitle`: Optional subtitle
- `x`, `y`: Grid position (1-based)
- `w`, `h`: Widget size in grid units
- `refreshSeconds`: Auto-refresh interval (optional)
- `props`: Widget-specific configuration

### Wallpapers

Todash supports animated wallpapers for dashboard backgrounds. See [src/wallpapers/README.md](src/wallpapers/README.md) for details.

**Available wallpapers:**
- `nebula`: Animated cosmic nebula effect
- `waves`: Smooth animated wave layers
- `unsplash`: Random photos from Unsplash API

**Example with Unsplash:**
```yaml
settings:
  apiKeys:
    unsplash: YOUR_UNSPLASH_API_KEY

wallpaper:
  type: unsplash
  props:
    query: nature
    orientation: landscape
    changeInterval: 300
    darken: 0.2
```

## Debugging with the Log Viewer

Todash includes a built-in log viewer for easy debugging. Click the bug icon (🐛) in the top-left corner to open it.

**Features:**
- View all client and server logs in one place
- Filter by log level (debug, info, warn, error)
- Search logs by text
- Auto-scroll to newest logs
- Clear logs or refresh manually

See [docs/LOGGING.md](docs/LOGGING.md) for detailed documentation on using the logging system.

## Creating a New Plugin

See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) for detailed instructions.

Quick example:

### 1. Create plugin directory
```bash
mkdir -p src/plugins/myplugin
```

### 2. Create data provider (`data.ts`)
```typescript
export interface MyPluginConfig {
  apiKey: string;
}

export interface MyPluginData {
  value: string;
}

export async function fetchMyPluginData(config: MyPluginConfig): Promise<MyPluginData> {
  // Fetch data from API
  const response = await fetch(`https://api.example.com/data`);
  return await response.json();
}
```

### 3. Create widget component (`widget.tsx`)
```typescript
import React, { useEffect, useState } from 'react';
import type { PluginWidgetProps } from '@types/plugin';

export default function MyPluginWidget(props: PluginWidgetProps) {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetch('/api/widget/myplugin', {
      method: 'POST',
      body: JSON.stringify(props),
    })
      .then(r => r.json())
      .then(json => setData(json.data));
  }, [props.refreshSignal]);
  
  return <div>{data?.value}</div>;
}
```

### 4. Register plugin (`index.ts`)
```typescript
import type { PluginDefinition } from '@types/plugin';
import MyPluginWidget from './widget';
import { fetchMyPluginData } from './data';

export const myPlugin: PluginDefinition = {
  name: 'myplugin',
  displayName: 'My Plugin',
  widget: MyPluginWidget,
  dataProvider: fetchMyPluginData,
  serverSide: true,
};
```

### 5. Register in application
```typescript
// src/main.tsx
import { myPlugin } from '@plugins/myplugin';
registerPlugin(myPlugin);

// src/server.ts
import { myPlugin } from './plugins/myplugin/index.js';
registerPlugin(myPlugin);
```

## Available Plugins

Currently implemented:
- ✅ **weather** - Current weather from Open-Meteo API
- ✅ **weather-forecast** - Weather forecast

Coming soon (being migrated):
- 🚧 **rss-feed** - RSS feed reader
- 🚧 **system-stats** - System CPU/memory stats
- 🚧 **project-status** - Git project information
- 🚧 **status** - Custom status values
- 🚧 **links-list** - Quick links
- 🚧 **calendar-ics** - ICS calendar events
- 🚧 **email** - Email inbox
- 🚧 **youtube-subscriptions** - YouTube feed
- 🚧 **transit-incidents** - Transit information
- 🚧 **aqi** - Air quality index

## Features

### Edit Mode
- Click the lock icon to enable edit mode
- Drag widgets to reposition
- Resize widgets using handles
- Changes are automatically saved

### Dashboard Switching
- Use the dropdown to switch between dashboards
- Dashboards are loaded from YAML files in `dashboards/`

### Auto-refresh
- Widgets automatically refresh based on their configuration
- Manual refresh available via reload button

### Theming
- Dark mode with animated nebula background
- Customizable via MUI theme

## Environment Variables

- `PORT` - Server port (default: 4000)
- `DASHBOARDS_DIR` - Path to dashboards directory (default: ./dashboards)
- `SERVE_WEB` - Serve built frontend from Express (default: false in dev, true in prod)
- `CACHE_TTL_MS` - Default cache TTL in milliseconds (default: 5 minutes)
- `SECRETS_FILE` - Path to JSON file with secrets (optional)

## Development

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Building
```bash
npm run build
```

## Production Deployment

### Option 1: Systemd Service (Linux)

See [README.md](./README.md) for systemd setup instructions.

### Option 2: Docker (Coming Soon)

```bash
docker build -t todash .
docker run -p 4000:4000 -v ./dashboards:/app/dashboards todash
```

### Option 3: Manual

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

## Migration Status

This is the new unified architecture. The old `server/` and `web/` directories are being phased out.

**Current status:**
- ✅ Core infrastructure complete
- ✅ TypeScript configuration
- ✅ Build system
- ✅ Core React components
- ✅ Plugin system
- ✅ Weather plugin (example)
- 🚧 Migrating remaining plugins

## Documentation

- [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) - Migration strategy and progress
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Complete developer reference
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Architecture overview

## License

MIT

## Contributing

Contributions welcome! Please see [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) for development setup.
