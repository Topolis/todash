// ABOUTME: Manages Shelly widget panels within dashboard layout files.
// ABOUTME: Ensures dashboards include standard Shelly widgets by updating YAML/JSON configs.

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface EnsureShellyPanelsOptions {
  dashboard: string;
  dashboardsDir?: string;
}

interface PanelConfig {
  panelType: string;
  x: number;
  y: number;
  w: number;
  h: number;
  widget: {
    type: string;
    title?: string;
    props?: Record<string, unknown>;
  };
}

const PANEL_DEFINITIONS: Array<{ type: string; title: string }> = [
  { type: 'shelly-thermostats', title: 'Shelly Thermostats' },
];

function resolveDashboardsDir(override?: string): string {
  if (override) {
    return path.resolve(process.cwd(), override);
  }

  const envDir = process.env.DASHBOARDS_DIR
    ? path.resolve(process.cwd(), process.env.DASHBOARDS_DIR)
    : null;

  if (envDir) {
    return envDir;
  }

  return path.resolve(process.cwd(), 'dashboards');
}

function locateDashboardFile(dir: string, name: string): string {
  const candidates = [
    path.join(dir, `${name}.yaml`),
    path.join(dir, `${name}.yml`),
    path.join(dir, `${name}.json`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Dashboard config not found for ${name} in ${dir}`);
}

function loadDashboard(filePath: string): any {
  const content = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.json')) {
    return JSON.parse(content);
  }
  return yaml.load(content);
}

function saveDashboard(filePath: string, config: any) {
  if (filePath.endsWith('.json')) {
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
    return;
  }
  const dumped = yaml.dump(config, { lineWidth: 120, noRefs: true });
  fs.writeFileSync(filePath, dumped, 'utf8');
}

function panelExists(panels: PanelConfig[], type: string): boolean {
  return panels.some((panel) => panel?.widget?.type === type);
}

function nextRow(panels: PanelConfig[]): number {
  if (panels.length === 0) {
    return 1;
  }

  let max = 1;
  for (const panel of panels) {
    const y = typeof panel.y === 'number' ? panel.y : Number((panel as any).y);
    const h = typeof panel.h === 'number' ? panel.h : Number((panel as any).h);
    if (!Number.isFinite(y) || !Number.isFinite(h)) {
      continue;
    }
    const bottom = y + h;
    if (bottom > max) {
      max = bottom;
    }
  }
  return max;
}

export async function ensureShellyPanels(options: EnsureShellyPanelsOptions): Promise<number> {
  const dashboardsDir = resolveDashboardsDir(options.dashboardsDir);
  const filePath = locateDashboardFile(dashboardsDir, options.dashboard);
  const config = loadDashboard(filePath);

  if (!config.panels) {
    config.panels = [];
  }

  const panels: PanelConfig[] = config.panels;

  const missing = PANEL_DEFINITIONS.filter((def) => !panelExists(panels, def.type));
  if (missing.length === 0) {
    return 0;
  }

  const y = nextRow(panels);
  const positions = [1];

  missing.forEach((def, index) => {
    const x = positions[index] ?? positions[positions.length - 1];
    panels.push({
      panelType: 'single',
      x,
      y,
      w: 3,
      h: 2,
      widget: {
        type: def.type,
        title: def.title,
        props: {},
      },
    });
  });

  saveDashboard(filePath, config);
  return missing.length;
}
