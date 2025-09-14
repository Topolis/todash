## Todash: Extensible Dashboard (React + Node + MUI)

### Disclaimer
This application has been written with a lot of help from AI. There has not been a full detailed code review to rule out any potential security flaws or other problems. This application has unproteced api's and should not be used outside a controlled environment inside a secured network. Use at your won risk!

### Overview
This repo scaffolds a dashboard application with:
- Node.js Express backend exposing:
  - Dashboards list `/api/dashboards` and loader `/api/dashboards/:name`
  - Widget data endpoints `/api/widget/:type`
- React + Material UI frontend with:
  - CSS Grid layout, themed DashboardCard
  - Pluggable widget registry and 4 starter widgets:
    - rss-feed, weather, project-status, system-stats

Focus is on extensibility: add new widgets by implementing a small server-side data provider and a client-side renderer, without redoing layout or chrome each time.

### Monorepo structure
- server/ — Express backend
- web/ — Vite React frontend
- dashboards/ — YAML configs (multiple files supported)

### Install & run
1. Install deps (uses workspaces):
   - npm install
2. Start dev servers (runs backend on 4000 and vite on 5173):
   - npm run dev
3. Open http://localhost:5173

To build and serve frontend from Express (production-ish):
- npm run build
- SERVE_WEB=true npm start

Note: In dev, Vite proxies /api to http://localhost:4000.

### Dashboard configuration (YAML)
Example: dashboards/sample.yaml

- grid:
  - columns: number of columns (default 12)
  - gap: CSS gap in px (default 12)
  - rowHeight: row height in px (default 120)
- widgets: array of widgets with placement and props
  - type: one of rss-feed | weather | project-status | system-stats
  - title: shown in the card header
  - x,y: 1-based grid start column and row
  - w,h: spans in columns and rows
  - props: type-specific configuration passed to the widget

### Writing a new widget plugin
1. Server: add a data provider in server/src/index.js plugins map:
   - key: widget type string
   - fetchData(config): returns JSON data object
2. Client: add a renderer component under web/src/plugins/<yourtype>/YourWidget.jsx
   - export default function YourWidget(props) { ... }
3. Register it in web/src/plugins/index.js widgetRegistry
4. Use it in YAML with type: <yourtype> and appropriate props

### Starter widgets
- rss-feed: reads RSS URL and shows latest items
- weather: uses open-meteo (no key) by lat/long
- project-status: shows app name/version and server uptime
- system-stats: shows CPU/mem load (server host)

### Notes
- This is a starter. For production, consider:
  - Error handling/caching for external APIs
  - Auth if needed
  - A more sophisticated grid (drag/resize) like react-grid-layout
  - Serving static frontend via Express in production mode

### Plugin template (client)
Create web/src/plugins/yourtype/YourWidget.jsx:

```jsx
export default function YourWidget(props) {
  // fetch data (if needed):
  // const res = await fetch('/api/widget/your-type', { method: 'POST', body: JSON.stringify(props) })
  return <div>Render your widget here</div>;
}
```

Register in web/src/plugins/index.js:

```js
import YourWidget from './yourtype/YourWidget.jsx';
export const widgetRegistry = { ... , 'your-type': YourWidget };
```

### Plugin template (server)
In server/src/index.js add:

```js
plugins['your-type'] = {
  async fetchData(config) {
    // Use config from YAML props
    return { /* data */ };
  }
};
```


### Next steps
- Add server-side caching layers for RSS/Weather with TTLs (e.g., 5 minutes) to reduce API calls
- Add error states and retry strategies per widget (graceful fallbacks, backoff, retries)
- Add schema validation for YAML (validate dashboards' structure and types on load and/or startup)



### Run as a service on Ubuntu (systemd + autostart)
This is a minimal, production-ish setup that serves the built frontend from the Node backend and auto-starts on boot.

1) Prepare a directory and a system user
- sudo mkdir -p /opt/todash
- sudo chown -R $USER:$USER /opt/todash
- git clone your repo into /opt/todash (or copy files there)

2) Install deps and build the frontend
- cd /opt/todash
- npm ci
- npm run build

3) Create a system user (optional but recommended)
- sudo useradd -r -s /usr/sbin/nologin todash || true
- sudo chown -R todash:todash /opt/todash

4) Create a systemd unit file
- sudo tee /etc/systemd/system/todash.service >/dev/null <<'UNIT'
[Unit]
Description=Todash Dashboard
After=network.target

[Service]
Type=simple
User=todash
Group=todash
WorkingDirectory=/opt/todash
# Serve built frontend from Express
Environment=NODE_ENV=production
Environment=SERVE_WEB=true
# Change if you want a different port
Environment=PORT=4000
# Optional: enable extra logging for Pi-hole integration
# Environment=DEBUG_PIHOLE=1
ExecStart=/usr/bin/node server/src/index.js
Restart=always
RestartSec=10
# Increase file limits if needed
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
UNIT

5) Enable and start the service
- sudo systemctl daemon-reload
- sudo systemctl enable todash
- sudo systemctl start todash
- Check status: sudo systemctl status todash
- Tail logs: sudo journalctl -u todash -f

6) Access
- Backend: http://<server-ip>:4000
- Frontend is served by the backend at the same URL when SERVE_WEB=true

Notes
- If you deploy updates: pull changes, run npm ci (if package.json changed) and npm run build, then sudo systemctl restart todash
- For development, keep using: npm run dev (separate Vite + backend). For service mode, use the build + SERVE_WEB=true approach above.
