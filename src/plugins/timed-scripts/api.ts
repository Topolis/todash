import { Router, Request, Response } from 'express';
import { logger } from '@lib/logger';
import { toggleScript, triggerScript } from './data';

const router = Router();

/**
 * Toggle a script on/off
 */
router.post('/toggle', async (req: Request, res: Response) => {
  try {
    const { title, enabled } = req.body;

    if (!title || typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Missing title or enabled parameter' });
    }

    await toggleScript(title, enabled);

    res.json({ success: true });
  } catch (error) {
    logger.error('TimedScripts API', 'Error toggling script', error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Manually trigger a script
 */
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Missing title parameter' });
    }

    await triggerScript(title);

    res.json({ success: true });
  } catch (error) {
    logger.error('TimedScripts API', 'Error triggering script', error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;

