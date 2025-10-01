# Todash Quick Reference

## Commands

### Development
```bash
npm run dev          # Start dev servers (Vite + Express)
npm run dev:client   # Start Vite only
npm run dev:server   # Start Express only
```

### Building
```bash
npm run build        # Build both client and server
npm run build:client # Build frontend only
npm run build:server # Build backend only
```

### Production
```bash
npm start            # Start production server
npm run preview      # Build and start
```

### Utilities
```bash
npm run type-check   # Check TypeScript types
npm run lint         # Run ESLint
npm test             # Run tests
```

## Project Structure

```
src/
├── main.tsx                 # React entry point
├── server.ts                # Express server entry point
├── app/                     # Frontend code
│   ├── App.tsx             # Main React component
│   ├── components/         # Shared components
│   └── lib/                # Utilities
├── server/                  # Backend code
│   ├── api.ts              # API routes
│   ├── cache.ts            # Caching
│   ├── secrets.ts          # Secrets
│   ├── schema.ts           # Validation
│   └── valueFunctions.ts   # Value functions
├── plugins/                 # Plugin system
│   ├── index.ts            # Plugin registry
│   └── [name]/             # Individual plugins
│       ├── index.ts        # Plugin definition
│       ├── widget.tsx      # React component
│       └── data.ts         # Data provider
└── types/                   # TypeScript types
    ├── plugin.ts           # Plugin interfaces
    ├── dashboard.ts        # Dashboard types
    └── api.ts              # API types
```

## Path Aliases

```typescript
@app/*      → src/app/*
@plugins/*  → src/plugins/*
@server/*   → src/server/*
@types/*    → src/types/*
```

## Plugin Structure

### Minimal Plugin

```typescript
// src/plugins/example/data.ts
export interface ExampleConfig {
  message: string;
}

export interface ExampleData {
  result: string;
}

export async function fetchExampleData(config: ExampleConfig): Promise<ExampleData> {
  return { result: config.message };
}

// src/plugins/example/widget.tsx
import React from 'react';
import type { PluginWidgetProps } from '@types/plugin';
import type { ExampleConfig, ExampleData } from './data';

export default function ExampleWidget(props: PluginWidgetProps<ExampleConfig, ExampleData>) {
  return <div>{props.message}</div>;
}

// src/plugins/example/index.ts
import type { PluginDefinition } from '@types/plugin';
import ExampleWidget from './widget';
import { fetchExampleData, type ExampleConfig, type ExampleData } from './data';

export const examplePlugin: PluginDefinition<ExampleConfig, ExampleData> = {
  name: 'example',
  displayName: 'Example',
  widget: ExampleWidget,
  dataProvider: fetchExampleData,
  serverSide: false,
};
```

### Register Plugin

```typescript
// src/main.tsx
import { examplePlugin } from '@plugins/example';
registerPlugin(examplePlugin);

// src/server.ts (if serverSide: true)
import { examplePlugin } from './plugins/example/index.js';
registerPlugin(examplePlugin);
```

## Dashboard Configuration

### Basic Widget

```yaml
widgets:
  - type: weather
    title: Current Weather
    x: 1
    y: 1
    w: 3
    h: 2
    refreshSeconds: 300
    props:
      latitude: 48.1351
      longitude: 11.5820
```

### Grid Configuration

```yaml
grid:
  columns: 12        # Number of columns
  gap: 12           # Gap between widgets (px)
  rowHeight: 120    # Height of each row (px)
```

### Dashboard Settings

```yaml
settings:
  dateFormat: "DD.MM.YYYY HH:mm"
  defaultLocation:
    latitude: 48.1351
    longitude: 11.5820
```

## API Endpoints

```
GET  /api/dashboards           # List all dashboards
GET  /api/dashboards/:name     # Get dashboard config
POST /api/widget/:type         # Fetch widget data
POST /api/widget/status        # Status widget (special)
POST /api/layout               # Save layout
```

## Environment Variables

```bash
PORT=4000                      # Server port
DASHBOARDS_DIR=./dashboards    # Dashboard configs
CACHE_TTL_MS=300000           # Cache TTL (5 min)
SECRETS_FILE=./secrets.json   # Secrets file
```

## Common Patterns

### Fetch Data in Widget

```typescript
useEffect(() => {
  let active = true;
  
  retryingJson<{ data: MyData }>('/api/widget/mywidget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(props),
  })
    .then(({ data }) => {
      if (active) setData(data);
    })
    .catch((e) => {
      if (active) setError(String(e));
    });
  
  return () => { active = false; };
}, [props.refreshSignal]);
```

### Use Cache

```typescript
import { cacheGet, cacheSet } from '@server/cache';

const key = `mydata:${id}`;
const cached = cacheGet<MyData>(key);
if (cached) return cached;

const data = await fetchData();
cacheSet(key, data, 300000); // 5 minutes
return data;
```

### Register Value Function

```typescript
import { registerValueFunction } from '@server/valueFunctions';

registerValueFunction('my-value', async () => {
  return await calculateValue();
});
```

### Use Dashboard Settings

```typescript
import { useDashboardSettings } from '@app/components/DashboardSettingsContext';

const settings = useDashboardSettings();
const dateFormat = settings?.dateFormat;
```

### Format Dates

```typescript
import { formatDate, formatRelative } from '@app/lib/dateFormat';

formatDate('2025-10-01', 'DD.MM.YYYY');  // "01.10.2025"
formatRelative('2025-10-01');             // "2 days ago"
```

## All Plugins (12/12 Migrated)

| Plugin | Type | Server-Side | Status |
|--------|------|-------------|--------|
| weather | Weather | No | ✅ |
| weather-forecast | Weather | No | ✅ |
| links-list | Links | No | ✅ |
| status | Status | Yes | ✅ |
| system-stats | System | Yes | ✅ |
| rss-feed | RSS | Yes | ✅ |
| project-status | Project | Yes | ✅ |
| calendar-ics | Calendar | Yes | ✅ |
| email | Email | Yes | ✅ |
| youtube-subscriptions | YouTube | Yes | ✅ |
| transit-incidents | Transit | Yes | ✅ |
| aqi | Air Quality | Yes | ✅ |

## Troubleshooting

### Port in Use
```bash
lsof -ti:5173 | xargs kill -9
lsof -ti:4000 | xargs kill -9
```

### Clean Install
```bash
rm -rf node_modules package-lock.json
npm install
```

### Type Errors
```bash
npm run type-check
```

### Build Errors
```bash
npm run build:client
npm run build:server
```

## URLs

- **Dev Frontend**: http://localhost:5173
- **Dev Backend**: http://localhost:4000
- **Production**: http://localhost:4000 (configurable)

## Documentation

- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Quick start guide
- **[README-NEW.md](./README-NEW.md)** - Complete user guide
- **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** - Developer reference
- **[MIGRATION_STATUS.md](./MIGRATION_STATUS.md)** - Migration progress

## Tips

1. **Always use path aliases** for imports
2. **Run type-check** before committing
3. **Use retryingJson** for API calls
4. **Cache expensive operations** on the server
5. **Follow the plugin template** for consistency
6. **Test in both dev and production** modes
7. **Use TypeScript types** everywhere
8. **Document your plugins** with JSDoc comments
