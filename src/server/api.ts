import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import { dashboardSchema } from './schema';
import { getPlugin } from '@plugins/index';
import { evaluateValueFunction } from './valueFunctions';
import { logger } from '../lib/logger';
import type { DashboardConfig } from '@types/dashboard';
import type { WidgetDataRequest, WidgetDataResponse } from '@types/api';

const router = express.Router();
const ajv = new Ajv();
const validateDashboard = ajv.compile(dashboardSchema);

// Determine dashboards directory
const defaultDashboardsDir = path.resolve(process.cwd(), 'dashboards');
const dashboardsDir = process.env.DASHBOARDS_DIR
  ? path.resolve(process.cwd(), process.env.DASHBOARDS_DIR)
  : defaultDashboardsDir;

/**
 * Load dashboard configuration from file
 */
function loadDashboard(name: string): DashboardConfig {
  const yamlPath = path.join(dashboardsDir, `${name}.yaml`);
  const ymlPath = path.join(dashboardsDir, `${name}.yml`);
  const jsonPath = path.join(dashboardsDir, `${name}.json`);

  let filePath: string | null = null;
  if (fs.existsSync(yamlPath)) filePath = yamlPath;
  else if (fs.existsSync(ymlPath)) filePath = ymlPath;
  else if (fs.existsSync(jsonPath)) filePath = jsonPath;

  if (!filePath) {
    const err: any = new Error(`Dashboard config not found for ${name}`);
    err.status = 404;
    throw err;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const config = filePath.endsWith('.json')
    ? JSON.parse(content)
    : yaml.load(content);

  // Validate schema
  if (!validateDashboard(config)) {
    const err: any = new Error(`Invalid dashboard config: ${JSON.stringify(validateDashboard.errors)}`);
    err.status = 400;
    throw err;
  }

  return config as unknown as DashboardConfig;
}

/**
 * GET /api/dashboards
 * List all available dashboards
 */
router.get('/dashboards', (_req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(dashboardsDir)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json'))
      .map(f => f.replace(/\.(yaml|yml|json)$/i, ''));
    res.json({ dashboards: files });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/dashboards/:name
 * Get dashboard configuration
 */
router.get('/dashboards/:name', (req: Request, res: Response) => {
  try {
    const config = loadDashboard(req.params.name);
    res.json({ config });
  } catch (e: any) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

/**
 * POST /api/widget/status
 * Special endpoint for status widget with value functions
 * MUST be before /widget/:type to avoid being caught by the generic route
 */
router.post('/widget/status', async (req: Request, res: Response) => {
  const { items = [] } = req.body;

  try {
    const results = await Promise.all(
      items.map(async (item: any) => {
        const { value, valueMax } = item;

        // Helper to evaluate a value that might be a function object
        const evaluateValue = async (val: any) => {
          if (!val || typeof val !== 'object') {
            return val;
          }
          // Value is an object with function name as key
          const [[fnName, fnConfig]] = Object.entries(val);
          try {
            return await evaluateValueFunction(fnName as string, fnConfig);
          } catch (e) {
            console.error(`Error evaluating value function ${fnName}:`, e);
            return null;
          }
        };

        const evaluatedValue = await evaluateValue(value);
        const evaluatedValueMax = valueMax !== undefined ? await evaluateValue(valueMax) : undefined;

        return {
          ...item,
          value: evaluatedValue,
          valueMax: evaluatedValueMax
        };
      })
    );

    res.json({ data: { items: results } });
  } catch (e) {
    console.error('Error processing status widget:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/widget/:type
 * Fetch data for a specific widget type
 */
router.post('/widget/:type', async (req: Request, res: Response) => {
  const { type } = req.params;
  const config: WidgetDataRequest = req.body || {};

  try {
    const plugin = getPlugin(type);

    if (!plugin) {
      return res.status(404).json({ error: `Unknown widget type: ${type}` });
    }

    if (!plugin.dataProvider) {
      return res.status(400).json({ error: `Widget type ${type} has no data provider` });
    }

    // Execute data provider
    const data = await plugin.dataProvider(config);

    const response: WidgetDataResponse = { data };
    res.json(response);
  } catch (e) {
    console.error(`Error fetching data for widget ${type}:`, e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/layout
 * Save dashboard layout
 */
router.post('/layout', async (req: Request, res: Response) => {
  const { name, panels } = req.body;

  if (!name || !Array.isArray(panels)) {
    return res.status(400).json({ error: 'Invalid request: name and panels required' });
  }

  try {
    // Determine target file name
    let targetName = name;
    if (name === 'sample') {
      targetName = 'sample.local';
    }

    const targetPath = path.join(dashboardsDir, `${targetName}.yaml`);

    // Load existing config or create new one
    let config: DashboardConfig;
    try {
      config = loadDashboard(targetName);
    } catch {
      // If file doesn't exist, create a new config
      config = {
        panels: [],
      };
    }

    // Update panels
    config.panels = panels;

    // Write to file
    const yamlContent = yaml.dump(config);
    fs.writeFileSync(targetPath, yamlContent, 'utf8');

    res.json({ success: true, newName: targetName });
  } catch (e) {
    console.error('Error saving layout:', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/logs
 * Get application logs
 */
router.get('/logs', (_req: Request, res: Response) => {
  try {
    const logs = logger.getLogs();
    res.json({ logs });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * DELETE /api/logs
 * Clear application logs
 */
router.delete('/logs', (_req: Request, res: Response) => {
  try {
    logger.clearLogs();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * Z-Wave control endpoints
 */

/**
 * POST /api/zwave/thermostat/temperature
 * Set thermostat temperature
 */
router.post('/zwave/thermostat/temperature', async (req: Request, res: Response) => {
  try {
    const { nodeId, temperature, setpointType = 1 } = req.body;

    if (typeof nodeId !== 'number' || typeof temperature !== 'number') {
      return res.status(400).json({ error: 'nodeId and temperature are required' });
    }

    // Dynamically import to avoid loading Z-Wave on client
    const { setThermostatTemperature } = await import('@plugins/zwave/data');
    await setThermostatTemperature(nodeId, temperature, setpointType);

    res.json({ success: true });
  } catch (e) {
    logger.error('API', 'Error setting thermostat temperature', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/zwave/thermostat/mode
 * Set thermostat mode
 */
router.post('/zwave/thermostat/mode', async (req: Request, res: Response) => {
  try {
    const { nodeId, mode } = req.body;

    if (typeof nodeId !== 'number' || typeof mode !== 'number') {
      return res.status(400).json({ error: 'nodeId and mode are required' });
    }

    const { setThermostatMode } = await import('@plugins/zwave/data');
    await setThermostatMode(nodeId, mode);

    res.json({ success: true });
  } catch (e) {
    logger.error('API', 'Error setting thermostat mode', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/zwave/switch/state
 * Turn switch on/off
 */
router.post('/zwave/switch/state', async (req: Request, res: Response) => {
  try {
    const { nodeId, isOn } = req.body;

    if (typeof nodeId !== 'number' || typeof isOn !== 'boolean') {
      return res.status(400).json({ error: 'nodeId and isOn are required' });
    }

    const { setSwitchState } = await import('@plugins/zwave/data');
    await setSwitchState(nodeId, isOn);

    res.json({ success: true });
  } catch (e) {
    logger.error('API', 'Error setting switch state', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/zwave/dimmer/level
 * Set dimmer level
 */
router.post('/zwave/dimmer/level', async (req: Request, res: Response) => {
  try {
    const { nodeId, level } = req.body;

    if (typeof nodeId !== 'number' || typeof level !== 'number') {
      return res.status(400).json({ error: 'nodeId and level are required' });
    }

    const { setDimmerLevel } = await import('@plugins/zwave/data');
    await setDimmerLevel(nodeId, level);

    res.json({ success: true });
  } catch (e) {
    logger.error('API', 'Error setting dimmer level', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * Error handler
 */
router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('API', 'API Error', err);
  res.status(500).json({ error: err.message });
});

export default router;
