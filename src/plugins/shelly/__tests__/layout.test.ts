import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { ensureShellyPanels } from '@plugins/shelly/layout';

const tempDirs: string[] = [];

function createTempDashboard(initial: any): { dir: string; file: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shelly-test-'));
  const file = path.join(dir, 'smarthome.yaml');
  const content = yaml.dump(initial);
  fs.writeFileSync(file, content, 'utf8');
  tempDirs.push(dir);
  return { dir, file };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('ensureShellyPanels', () => {
  it('adds shelly panels when missing', async () => {
    const { dir } = createTempDashboard({
      title: 'Smart Home',
      panels: [
        { panelType: 'single', x: 1, y: 1, w: 3, h: 2, widget: { type: 'zwave-thermostat', title: 'Thermostat' } },
      ],
    });

    const added = await ensureShellyPanels({ dashboard: 'smarthome', dashboardsDir: dir });

    expect(added).toBe(1);

    const after = yaml.load(fs.readFileSync(path.join(dir, 'smarthome.yaml'), 'utf8')) as any;
    const panelTypes = (after.panels || []).map((p: any) => p.widget?.type);

    expect(panelTypes).toContain('shelly-thermostats');
  });

  it('does not duplicate panels if already present', async () => {
    const { dir } = createTempDashboard({
      panels: [
        { panelType: 'single', x: 1, y: 1, w: 3, h: 2, widget: { type: 'shelly-thermostats', title: 'Shelly Thermostats' } },
      ],
    });

    const first = await ensureShellyPanels({ dashboard: 'smarthome', dashboardsDir: dir });
    const second = await ensureShellyPanels({ dashboard: 'smarthome', dashboardsDir: dir });

    expect(first).toBe(0);
    expect(second).toBe(0);

    const after = yaml.load(fs.readFileSync(path.join(dir, 'smarthome.yaml'), 'utf8')) as any;
    const thermostatPanels = (after.panels || []).filter((p: any) => p.widget?.type === 'shelly-thermostats');

    expect(thermostatPanels).toHaveLength(1);
  });
});
