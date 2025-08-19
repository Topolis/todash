# Todash — System Prompt for AI Contributors

This document gives an AI assistant everything it needs to understand, modify, and extend this project safely and effectively.

## TL;DR
- A configurable dashboard built with:
  - Server: Node/Express providing a plugin registry and JSON data endpoints
  - Client: React + MUI rendering widgets on a CSS grid
  - YAML: Dashboards are defined in dashboards/*.yaml
- Extend by adding:
  - A server plugin (keyed by type) with a fetchData(config) method
  - A React widget registered under the same type
- Secrets: Prefer Option B — use SECRETS_FILE pointing to a JSON file. Env vars override.
- Layout editing: Unlock, drag/resize, optionally save as <name>.local.yaml via POST /api/layout


## Repository structure (key parts)
- server/src/index.js
  - Express app, routing, in-memory TTL cache, secrets loader, plugin registry, /api routes
- server/src/schema.js
  - JSON-schema validator for dashboard files
- dashboards/*.yaml
  - Dashboard definitions (title, settings, grid, widgets)
- web/src/
  - App.jsx: top-level UI, dashboard select, unlock toggle, layout state, save-layout bar
  - components/
    - DashboardGrid.jsx: grid container + measurements via GridContext.jsx
    - GridContext.jsx: provides columns/gap/rowHeight/colWidth/offsets
    - DashboardCard.jsx: common widget card with reload hook
    - SaveLayoutBar.jsx: client UI to call /api/layout
  - plugins/
    - index.jsx: widget registry + WidgetRenderer (drag/resize handles in edit mode)
    - weather/, rss/, transit/, project/, system/, email/, youtube/, calendar/, aqi/
  - lib/
    - retryFetch.js: retryingJson helper
    - dateFormat.js: formatting helper used by widgets


## Dashboard YAML schema
- Top-level keys:
  - title: string
  - settings: object
    - dateFormat: string (used by widgets showing dates)
    - defaultLocation: { latitude: number, longitude: number } (fallback for Weather/Forecast/AQI)
  - grid: { columns: int>=1, gap: int>=0, rowHeight: int>=10 }
  - widgets: array of widget objects
- Each widget has:
  - type: string (matches server/client registry key)
  - title, subtitle: optional strings
  - x, y, w, h: integers (1-based grid coordinates and spans)
  - props: free-form object passed to widget and server plugin


## Data flow
1) Client loads a dashboard YAML from /api/dashboards/:name
2) For each widget, client calls POST /api/widget/:type with props and control flags { force }
3) Server plugin plugins[type].fetchData(config) returns JSON data
4) Client widget renders received data


## Server
- Express app with CORS and JSON body parsing
- Endpoints:
  - GET /api/dashboards -> { dashboards: ["sample", ...] }
  - GET /api/dashboards/:name -> dashboard JSON
  - POST /api/widget/:type -> { data } (calls plugin fetchData)
  - POST /api/layout -> { ok, newName } writes dashboards/<name>.local.yaml
- Secrets loader (Option B preferred):
  - If SECRETS_FILE is set, loads JSON from that path once into a cache
  - getSecret(name) returns process.env[name] first, then secrets[name]
- In-memory TTL cache: cacheGet/cacheSet used by plugins to avoid API overuse

### Server plugin registry
- Location: server/src/index.js, const plugins = { ... }
- Pattern:
  - Keyed by widget type
  - async fetchData(config) -> returns JSON serializable data
  - Use config.force to bypass cache when client requests a manual refresh
- Existing plugins (examples):
  - rss-feed: RSS merge via rss-parser
  - weather: current weather via Open‑Meteo
  - weather-forecast: forecast via Open‑Meteo
  - project-status: local metadata
  - system-stats: CPU/mem/load/os via systeminformation
  - transit-incidents: MVG incidents feed
  - email: IMAP via imapflow (optional mailparser for HTML)
  - youtube-subscriptions: Google APIs OAuth2 (requires YT_CLIENT_ID/SECRET/REFRESH_TOKEN)
  - calendar-ics: ICS feeds (multi-source with label/color) -> returns { events, sources }
  - aqi: Air quality via Open‑Meteo AQI

### Adding a new server plugin
1) Open server/src/index.js and add an entry to plugins with a fetchData(config) method
2) Validate inputs; prefer numeric parsing and defaults
3) Cache results with a reasonable ttlMs; respect config.force to bypass cache
4) Return small, clean JSON tailored for the widget
5) If you need secrets, read via getSecret and document expected keys
6) Avoid external writes or destructive operations


## Client
- React + MUI with a CSS grid layout
- Widget registry: web/src/plugins/index.jsx
  - widgetRegistry maps type -> React component
  - WidgetRenderer wraps the widget in DashboardCard; handles refresh; shows edit handles when unlocked
- Editing layout:
  - Toggle lock icon (left of dashboard selector) to unlock
  - Drag by the top bar; resize on right/bottom/corner handles
  - Local layout is in memory; click “Save layout” to POST /api/layout
  - Server writes <name>.local.yaml and returns newName; UI switches URL to that dashboard

### Adding a new widget
1) Create a component in web/src/plugins/<area>/<Name>Widget.jsx
2) Register it in web/src/plugins/index.jsx (widgetRegistry)
3) Use DashboardCard onReload to bump a refreshSignal and re-fetch
4) Fetch via retryingJson('/api/widget/<type>', { method: 'POST', body: JSON.stringify(props) })
5) Respect dashboard settings as fallbacks (e.g., defaultLocation)
6) Keep rendering resilient: show spinners, error alerts, empty states


## Notable widgets & props
- calendar-ics (multi-source with status)
  - props:
    - sources: [{ url, label?, color? }, ...] (preferred) or urls: [string]
    - lookAheadDays: number, limit: number
    - showSourceStatus: boolean (client-side; shows per-source chips with counts and failures)
  - server returns:
    - { events: [...], sources: [{ ok, label, url, color, count, inWindow, error? }, ...] }
  - Limitations: minimal ICS parsing (no RRULE expansion yet)

- email (IMAP)
  - Reads host/port/secure/user/password/mailbox from props or secrets
  - Actions: list unread, markRead(uid), getBody(uid)
  - Requires imapflow (and optional mailparser)

- youtube-subscriptions
  - Requires Google OAuth2 refresh token with youtube.readonly scope
  - Secrets: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN

- aqi, weather, weather-forecast
  - If props.latitude/longitude are absent, widgets fall back to settings.defaultLocation

- rss-feed
  - props.urls: list of feed URLs, limit: number


## Global settings
- settings.dateFormat: used by widgets via formatDate()
- settings.defaultLocation: latitude/longitude fallback used by Weather/Forecast/AQI


## Secrets (Option B preferred)
- Create a JSON file (e.g., ./secrets.json) not committed to VCS
- Export SECRETS_FILE=./secrets.json before running the server
- Keys used so far (examples):
  - IMAP_HOST, IMAP_PORT, IMAP_SECURE, IMAP_USER, IMAP_PASSWORD, IMAP_MAILBOX
  - YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN
- Env vars override values in the secrets file


## Package management
- Always add/remove server deps via npm with workspace scope:
  - npm --workspace server install <pkg>
- Avoid manually editing package files; let the package manager update lock files


## Design & conventions
- Keep server plugin responses small and shaped for UI needs
- Use caching for external APIs; expose a force flag to bypass on manual reload
- Client widgets:
  - Show: loading spinner, error alert, graceful empty state
  - Accept props; fall back to settings when sensible
  - Avoid heavy processing on the client if the server can prepare data
- Grid: x,y,w,h are 1-based; snapping to nearest column/row on drag/resize
- Layout save: write <name>.local.yaml (never overwrite the original by default)


## Extending ideas
- New widgets:
  - Quote of the day (Quotable): server fetch + client chip/card (exclude religious tags)
  - Commute advisor: combine transit incidents + nowcast + AQI to recommend departure times
  - Electricity prices (Awattar): plot next 24h with recommended windows
  - OpenSky aircraft nearby: list aircraft over location
- For any new widget:
  - Add server plugin (type) + client component, register, document props
  - If secrets are needed, define names and read via getSecret


## Testing & verification
- Prefer writing unit tests for server plugins where possible (pure transforms, date filters)
- Safe verification runs (locally):
  - Hit /api/widget/<type> with a minimal config to check shape and errors
  - Use the widget reload to exercise cache bypass
- Avoid destructive actions (writes, deletes) in plugins; discuss if needed


## Known limitations / notes
- ICS parsing: currently no RRULE expansion
- Layout editor: minimal collision handling (items can overlap if dragged carelessly)
- Server caches are in-memory only (restart clears)
- The server can serve web/dist if SERVE_WEB=true and a build exists; otherwise run the client dev server separately


## Checklists
- Add a plugin
  - [ ] Implement plugins["your-type"].fetchData
  - [ ] Validate inputs, handle errors, add caching
  - [ ] Use secrets via getSecret if needed; document keys
  - [ ] Return JSON suited to UI
- Add a widget
  - [ ] Create React component under web/src/plugins/<area>
  - [ ] Register in widgetRegistry in plugins/index.jsx
  - [ ] Wire refreshSignal and handle props/settings
  - [ ] Add YAML example with props in dashboards/sample.yaml (with comments if setup is required)


## Contact points in code
- Plugin registry & routes: server/src/index.js
- Dashboard schema: server/src/schema.js
- Widgets & registry: web/src/plugins/**
- Grid & editing: web/src/components/**
- Sample dashboard: dashboards/sample.yaml

