// ABOUTME: Verifies smarthome dashboard contains the Shelly controls widget.
// ABOUTME: Guards against accidental removal of required Shelly configuration.

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

describe('smarthome dashboard Shelly controls widget', () => {
  it('includes the Shelly controls panel with the expected configuration', () => {
    const dashboardPath = path.resolve(process.cwd(), 'dashboards', 'smarthome.yaml');
    const contents = fs.readFileSync(dashboardPath, 'utf8');
    const config = yaml.load(contents) as any;
    const panels = Array.isArray(config?.panels) ? config.panels : [];

    const controlsPanel = panels.find((panel: any) => panel?.widget?.type === 'shelly-controls');
    expect(controlsPanel).toBeTruthy();

    expect(controlsPanel?.panelType).toBe('single');
    expect(controlsPanel?.widget?.title).toBe('Shelly Controls');
    expect(controlsPanel?.widget?.props).toMatchObject({
      refreshSeconds: 60,
      includeScripts: true,
      includeActions: true,
      includeSchedules: true,
    });
  });
});
