import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import { dashboardSchema } from './schema.js';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDashboardsDir = path.resolve(__dirname, '../../dashboards');
const dashboardsDir = process.env.DASHBOARDS_DIR
  ? path.resolve(process.cwd(), process.env.DASHBOARDS_DIR)
  : defaultDashboardsDir;





// Schema validator
const ajv = new Ajv({ allErrors: true, strict: false });
// Register additional value functions (Pi-hole etc.)
import './plugins/piholeValues.js';
// Import system plugin to register system value functions
import './plugins/systemPlugin.js';

const validateDashboard = ajv.compile(dashboardSchema);

function validateOrThrow(cfg) {
  const ok = validateDashboard(cfg);
  if (!ok) {
    const msg = validateDashboard.errors?.map(e => `${e.instancePath || '/'} ${e.message}`).join('; ');
    const err = new Error(`Invalid dashboard schema: ${msg}`);
    err.status = 400; throw err;
  }
  return cfg;
}

function loadDashboardConfig(name) {
  const pYaml = path.join(dashboardsDir, `${name}.yaml`);
  const pYml = path.join(dashboardsDir, `${name}.yml`);
  const pJson = path.join(dashboardsDir, `${name}.json`);
  if (fs.existsSync(pYaml)) return validateOrThrow(yaml.load(fs.readFileSync(pYaml, 'utf8')));
  if (fs.existsSync(pYml)) return validateOrThrow(yaml.load(fs.readFileSync(pYml, 'utf8')));
  if (fs.existsSync(pJson)) return validateOrThrow(JSON.parse(fs.readFileSync(pJson, 'utf8')));
  const err = new Error(`Dashboard config not found for ${name}`);
  err.status = 404; throw err;
}

// Plugin registry: define server-side data providers keyed by type
import { statusPlugin } from './plugins/statusPlugin.js';
import { systemPlugin } from './plugins/systemPlugin.js';
import { rssPlugin } from './plugins/rssPlugin.js';
import { weatherPlugin, weatherForecastPlugin } from './plugins/weatherPlugin.js';
import { projectPlugin } from './plugins/projectPlugin.js';
import { transitPlugin } from './plugins/transitPlugin.js';
import { emailPlugin } from './plugins/emailPlugin.js';
import { youtubePlugin } from './plugins/youtubePlugin.js';
import { calendarPlugin } from './plugins/calendarPlugin.js';
import { aqiPlugin } from './plugins/aqiPlugin.js';
import { linksPlugin } from './plugins/linksPlugin.js';

const plugins = {
  'rss-feed': rssPlugin,
  'weather': weatherPlugin,
  'weather-forecast': weatherForecastPlugin,
  'project-status': projectPlugin,
  'system-stats': systemPlugin,
  'transit-incidents': transitPlugin,
  'email': emailPlugin,
  'youtube-subscriptions': youtubePlugin,
  'status': statusPlugin,
  'calendar-ics': calendarPlugin,
  'aqi': aqiPlugin,
  'links-list': linksPlugin,

};

app.get('/api/dashboards', (req, res) => {
  try {
    const files = fs.readdirSync(dashboardsDir)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json'))
      .map(f => f.replace(/\.(yaml|yml|json)$/i, ''));
    res.json({ dashboards: files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dashboards/:name', (req, res) => {
  try {
    const cfg = loadDashboardConfig(req.params.name);
    res.json(cfg);
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// Data endpoint for widgets: /api/widget/:type
app.post('/api/widget/:type', async (req, res) => {
  try {
    const type = req.params.type;
    const plugin = plugins[type];
    if (!plugin) return res.status(404).json({ error: 'Unknown widget type' });
    const data = await plugin.fetchData(req.body || {});
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// In production, optionally serve built frontend
// Save layout endpoint: writes widgets to the active dashboard file
// Rules:
// - If base name is 'sample', write to sample.local.yaml to avoid clobbering the example
// - Otherwise, always write to the base file (strip .local suffix if present)
app.post('/api/layout', (req, res) => {
  try {
    const { name, widgets } = req.body || {};
    if (!name || !Array.isArray(widgets)) return res.status(400).json({ error: 'name and widgets are required' });
    if (!/^[A-Za-z0-9._-]+$/.test(name)) return res.status(400).json({ error: 'invalid dashboard name' });

    const baseName = name.replace(/\.local$/, '');

    // Load base config to preserve title/settings/grid
    let base;
    try { base = loadDashboardConfig(baseName); }
    catch { base = { title: baseName, settings: {}, grid: { columns: 12, gap: 12, rowHeight: 120 }, widgets: [] }; }

    const targetName = baseName === 'sample' ? `${baseName}.local` : baseName;
    const cfg = { ...base, widgets };
    validateOrThrow(cfg);

    const outPath = path.join(dashboardsDir, `${targetName}.yaml`);
    const yamlStr = yaml.dump(cfg, { noRefs: true, lineWidth: 120 });
    fs.writeFileSync(outPath, yamlStr, 'utf8');
    res.json({ ok: true, newName: targetName });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Persist single widget props in current dashboard
app.post('/api/dashboard/:name/widget/:index/props', (req, res) => {
  try {
    const { name } = req.params;
    const index = Number(req.params.index);
    const { props } = req.body || {};
    if (!name || !Number.isInteger(index)) return res.status(400).json({ error: 'invalid name or index' });
    if (!props || typeof props !== 'object') return res.status(400).json({ error: 'props object required' });

    const cfg = loadDashboardConfig(name);
    const widgets = cfg.widgets || [];
    if (index < 0 || index >= widgets.length) return res.status(404).json({ error: 'widget index out of range' });

    widgets[index] = { ...widgets[index], props: { ...(widgets[index].props || {}), ...props } };
    const updated = { ...cfg, widgets };
    validateOrThrow(updated);

    const outPath = path.join(dashboardsDir, `${name}.yaml`);
    const yamlStr = yaml.dump(updated, { noRefs: true, lineWidth: 120 });
    fs.writeFileSync(outPath, yamlStr, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

if (process.env.SERVE_WEB === 'true') {
  const distDir = path.resolve(process.cwd(), 'web', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

