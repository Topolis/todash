// ABOUTME: Express router exposing guarded Shelly RPC endpoints for dashboard control.
// ABOUTME: Validates incoming method requests and proxies them to the controller safely.

import { Router, Request, Response } from 'express';
import { logger } from '@lib/logger';
import { executeShellyRpc, SHELLY_ALLOWED_METHODS } from './controller';
import { ensureShellyPanels } from './layout';

const router = Router();

router.get('/allowed-methods', (_req: Request, res: Response) => {
  res.json({ methods: Array.from(SHELLY_ALLOWED_METHODS.values()) });
});

router.post('/rpc', async (req: Request, res: Response) => {
  const { method, params } = req.body ?? {};

  if (typeof method !== 'string' || method.trim().length === 0) {
    return res.status(400).json({ error: 'method must be a non-empty string' });
  }

  if (params !== undefined && (typeof params !== 'object' || Array.isArray(params))) {
    return res.status(400).json({ error: 'params must be an object when provided' });
  }

  try {
    const result = await executeShellyRpc(method, params as Record<string, unknown> | undefined);
    res.json({ result });
  } catch (error) {
    logger.error('Shelly API', `RPC ${method} failed`, error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/layout/add', async (req: Request, res: Response) => {
  const { dashboard } = req.body ?? {};

  if (typeof dashboard !== 'string' || dashboard.trim().length === 0) {
    return res.status(400).json({ error: 'dashboard must be a non-empty string' });
  }

  try {
    const added = await ensureShellyPanels({ dashboard });
    res.json({ added });
  } catch (error) {
    logger.error('Shelly API', 'Failed to ensure Shelly panels', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
