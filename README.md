## Todash: Extensible Dashboard (React + Node + MUI)

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

