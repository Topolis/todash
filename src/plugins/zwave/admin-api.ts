import express, { Request, Response } from 'express';
import { getDriver, getLastAddedNode, clearLastAddedNode, onDriverReady, onValueUpdate } from './service';
import { logger } from '@lib/logger';

const router = express.Router();

/**
 * GET /api/zwave/admin/events
 * Server-Sent Events endpoint for real-time updates
 */
router.get('/events', (_req: Request, res: Response) => {
  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connection message
  res.write('data: {"type":"connected"}\n\n');

  // Listen for driver ready events
  const unsubscribeReady = onDriverReady(() => {
    res.write('data: {"type":"driver-ready"}\n\n');
  });

  // Listen for value update events
  const unsubscribeValue = onValueUpdate((nodeId: number) => {
    res.write(`data: {"type":"value-updated","nodeId":${nodeId}}\n\n`);
  });

  // Clean up on disconnect
  _req.on('close', () => {
    unsubscribeReady();
    unsubscribeValue();
  });
});

/**
 * GET /api/zwave/admin/nodes
 * Get all Z-Wave nodes with detailed information
 */
router.get('/nodes', async (_req: Request, res: Response) => {
  try {
    let driver;
    try {
      driver = await getDriver();
    } catch (driverError: any) {
      logger.warn('ZWave Admin', 'Driver not available for /nodes request', driverError.message);
      return res.status(503).json({
        error: driverError.message || 'Z-Wave driver not initialized',
        nodes: []
      });
    }

    const controller = driver.controller;
    const nodes = controller.nodes;

    const nodeList = Array.from(nodes.values()).map(node => {
      // Get all values from the node
      const values: any[] = [];
      try {
        const valueIds = node.getDefinedValueIDs();
        for (const valueId of valueIds) {
          try {
            const value = node.getValue(valueId);
            const metadata = node.getValueMetadata(valueId);
            values.push({
              commandClass: valueId.commandClass,
              commandClassName: valueId.commandClassName,
              property: valueId.property,
              propertyKey: valueId.propertyKey,
              propertyName: valueId.propertyName,
              endpoint: valueId.endpoint,
              value: value,
              metadata: {
                type: metadata?.type,
                readable: metadata?.readable,
                writeable: metadata?.writeable,
                label: metadata?.label,
                description: metadata?.description,
                min: (metadata as any)?.min,
                max: (metadata as any)?.max,
                unit: (metadata as any)?.unit,
                states: (metadata as any)?.states,
              }
            });
          } catch (e) {
            // Skip values that can't be read
          }
        }
      } catch (e) {
        logger.warn('ZWave Admin', `Failed to get values for node ${node.id}`, e);
      }

      // Calculate health indicators
      const stats = (node as any).statistics || {};
      const totalCommands = (stats.commandsTX || 0) + (stats.commandsRX || 0);
      const totalDropped = (stats.commandsDroppedTX || 0) + (stats.commandsDroppedRX || 0);
      const successRate = totalCommands > 0 ? ((totalCommands - totalDropped) / totalCommands * 100) : 100;
      const hasRecentActivity = totalCommands > 0;

      // Check if node seems dead
      const seemsDead = node.status === 3 || (!hasRecentActivity && !node.isControllerNode && node.ready);
      const lastSeen = (node as any).lastSeen;

      return {
        nodeId: node.id,
        name: node.name || '',  // Custom name set by user (empty if not set)
        displayName: node.name || node.deviceConfig?.label || `Node ${node.id}`,  // Fallback display name
        location: node.location,
        manufacturer: node.deviceConfig?.manufacturer,
        productLabel: node.deviceConfig?.label,
        productDescription: node.deviceConfig?.description,
        firmwareVersion: node.firmwareVersion,
        isListening: node.isListening,
        isFrequentListening: node.isFrequentListening,
        isRouting: node.isRouting,
        status: node.status,
        ready: node.ready,
        interviewStage: node.interviewStage,
        isControllerNode: node.isControllerNode,
        keepAwake: node.keepAwake,
        deviceClass: {
          basic: (node.deviceClass?.basic as any)?.label || node.deviceClass?.basic?.toString(),
          generic: (node.deviceClass?.generic as any)?.label || node.deviceClass?.generic?.toString(),
          specific: (node.deviceClass?.specific as any)?.label || node.deviceClass?.specific?.toString(),
        },
        values: values,
        statistics: {
          commandsTX: stats.commandsTX || 0,
          commandsRX: stats.commandsRX || 0,
          commandsDroppedTX: stats.commandsDroppedTX || 0,
          commandsDroppedRX: stats.commandsDroppedRX || 0,
          timeoutResponse: stats.timeoutResponse || 0,
        },
        health: {
          successRate: Math.round(successRate * 10) / 10,
          hasRecentActivity: hasRecentActivity,
          seemsDead: seemsDead,
          lastSeen: lastSeen,
        },
      };
    });

    res.json({ nodes: nodeList });
  } catch (e) {
    logger.error('ZWave Admin', 'Error getting nodes', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/zwave/admin/node/:nodeId
 * Get detailed information about a specific node
 */
router.get('/node/:nodeId', async (req: Request, res: Response) => {
  try {
    const nodeId = parseInt(req.params.nodeId);
    const driver = await getDriver();
    const node = driver.controller.nodes.get(nodeId);

    if (!node) {
      return res.status(404).json({ error: `Node ${nodeId} not found` });
    }

    // Get all values
    const values: any[] = [];
    const valueIds = node.getDefinedValueIDs();
    for (const valueId of valueIds) {
      try {
        const value = node.getValue(valueId);
        const metadata = node.getValueMetadata(valueId);
        values.push({
          commandClass: valueId.commandClass,
          commandClassName: valueId.commandClassName,
          property: valueId.property,
          propertyKey: valueId.propertyKey,
          propertyName: valueId.propertyName,
          endpoint: valueId.endpoint,
          value: value,
          metadata: {
            type: metadata?.type,
            readable: metadata?.readable,
            writeable: metadata?.writeable,
            label: metadata?.label,
            description: metadata?.description,
            min: (metadata as any)?.min,
            max: (metadata as any)?.max,
            unit: (metadata as any)?.unit,
            states: (metadata as any)?.states,
            ccSpecific: (metadata as any)?.ccSpecific,
          }
        });
      } catch (e) {
        // Skip values that can't be read
      }
    }

    const nodeInfo = {
      nodeId: node.id,
      name: node.name || '',  // Custom name set by user
      displayName: node.name || node.deviceConfig?.label || `Node ${node.id}`,  // Fallback display name
      location: node.location,
      manufacturer: node.deviceConfig?.manufacturer,
      productLabel: node.deviceConfig?.label,
      productDescription: node.deviceConfig?.description,
      firmwareVersion: node.firmwareVersion,
      protocolVersion: (node as any).protocolVersion,
      zwavePlusVersion: (node as any).zwavePlusVersion,
      isListening: node.isListening,
      isFrequentListening: node.isFrequentListening,
      isRouting: node.isRouting,
      maxDataRate: (node as any).maxDataRate,
      status: node.status,
      ready: node.ready,
      interviewStage: node.interviewStage,
      isControllerNode: node.isControllerNode,
      keepAwake: node.keepAwake,
      deviceClass: {
        basic: (node.deviceClass?.basic as any)?.label || node.deviceClass?.basic?.toString(),
        generic: (node.deviceClass?.generic as any)?.label || node.deviceClass?.generic?.toString(),
        specific: (node.deviceClass?.specific as any)?.label || node.deviceClass?.specific?.toString(),
      },
      values: values,
      endpoints: Array.from({ length: (node as any).getEndpointCount?.() || 1 }, (_, i) => i),
      statistics: {
        commandsTX: (node as any).statistics?.commandsTX || 0,
        commandsRX: (node as any).statistics?.commandsRX || 0,
        commandsDroppedTX: (node as any).statistics?.commandsDroppedTX || 0,
        commandsDroppedRX: (node as any).statistics?.commandsDroppedRX || 0,
        timeoutResponse: (node as any).statistics?.timeoutResponse || 0,
      },
    };

    res.json(nodeInfo);
  } catch (e) {
    logger.error('ZWave Admin', 'Error getting node details', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/zwave/admin/controller
 * Get controller information
 */
router.get('/controller', async (_req: Request, res: Response) => {
  try {
    let driver;
    try {
      driver = await getDriver();
    } catch (driverError: any) {
      logger.warn('ZWave Admin', 'Driver not available for /controller request', driverError.message);
      return res.status(503).json({
        error: driverError.message || 'Z-Wave driver not initialized'
      });
    }

    const controller = driver.controller;

    const info = {
      homeId: (controller as any).homeId?.toString() || 'Unknown',
      ownNodeId: controller.ownNodeId,
      isSecondary: (controller as any).isSecondary || false,
      isUsingHomeIdFromOtherNetwork: (controller as any).isUsingHomeIdFromOtherNetwork || false,
      isSISPresent: (controller as any).isSISPresent || false,
      wasRealPrimary: (controller as any).wasRealPrimary || false,
      isStaticUpdateController: false,
      isSlave: false,
      serialApiVersion: (controller as any).sdkVersion || 'Unknown',
      manufacturerId: (controller as any).manufacturerId || 0,
      productType: (controller as any).productType || 0,
      productId: (controller as any).productId || 0,
      supportedFunctionTypes: (controller as any).supportedFunctionTypes || [],
      sucNodeId: (controller as any).sucNodeId || 0,
      supportsTimers: (controller as any).supportsTimers || false,
      nodes: controller.nodes.size,
    };

    res.json(info);
  } catch (e) {
    logger.error('ZWave Admin', 'Error getting controller info', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/zwave/admin/node/:nodeId/name
 * Set node name
 */
router.post('/node/:nodeId/name', async (req: Request, res: Response) => {
  try {
    const nodeId = parseInt(req.params.nodeId);
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name is required' });
    }

    const driver = await getDriver();
    const node = driver.controller.nodes.get(nodeId);

    if (!node) {
      return res.status(404).json({ error: `Node ${nodeId} not found` });
    }

    node.name = name;
    logger.info('ZWave Admin', `Set node ${nodeId} name to "${name}"`);

    res.json({ success: true });
  } catch (e) {
    logger.error('ZWave Admin', 'Error setting node name', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/zwave/admin/node/:nodeId/location
 * Set node location
 */
router.post('/node/:nodeId/location', async (req: Request, res: Response) => {
  try {
    const nodeId = parseInt(req.params.nodeId);
    const { location } = req.body;

    if (!location || typeof location !== 'string') {
      return res.status(400).json({ error: 'Location is required' });
    }

    const driver = await getDriver();
    const node = driver.controller.nodes.get(nodeId);

    if (!node) {
      return res.status(404).json({ error: `Node ${nodeId} not found` });
    }

    node.location = location;
    logger.info('ZWave Admin', `Set node ${nodeId} location to "${location}"`);

    res.json({ success: true });
  } catch (e) {
    logger.error('ZWave Admin', 'Error setting node location', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/zwave/admin/node/:nodeId/interview
 * Re-interview a node
 */
router.post('/node/:nodeId/interview', async (req: Request, res: Response) => {
  try {
    const nodeId = parseInt(req.params.nodeId);
    const driver = await getDriver();
    const node = driver.controller.nodes.get(nodeId);

    if (!node) {
      return res.status(404).json({ error: `Node ${nodeId} not found` });
    }

    await node.refreshInfo();
    logger.info('ZWave Admin', `Re-interviewing node ${nodeId}`);

    res.json({ success: true, message: 'Interview started' });
  } catch (e) {
    logger.error('ZWave Admin', 'Error re-interviewing node', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/zwave/admin/node/:nodeId/ping
 * Ping a node to test if it's alive and responding
 */
router.post('/node/:nodeId/ping', async (req: Request, res: Response) => {
  try {
    const nodeId = parseInt(req.params.nodeId);
    const driver = await getDriver();
    const node = driver.controller.nodes.get(nodeId);

    if (!node) {
      return res.status(404).json({ error: `Node ${nodeId} not found` });
    }

    logger.info('ZWave Admin', `Pinging node ${nodeId}...`);

    const startTime = Date.now();
    const result = await node.ping();
    const responseTime = Date.now() - startTime;

    logger.info('ZWave Admin', `Node ${nodeId} ping result: ${result}, response time: ${responseTime}ms`);

    res.json({
      success: true,
      alive: result,
      responseTime: responseTime,
      message: result ? `Node is alive (${responseTime}ms)` : 'Node did not respond'
    });
  } catch (e) {
    logger.error('ZWave Admin', 'Error pinging node', e);
    res.status(500).json({ error: (e as Error).message, alive: false });
  }
});

/**
 * POST /api/zwave/admin/node/:nodeId/check-lifespan
 * Check if node is failed (can be removed)
 */
router.post('/node/:nodeId/check-lifespan', async (req: Request, res: Response) => {
  try {
    const nodeId = parseInt(req.params.nodeId);
    const driver = await getDriver();
    const controller = driver.controller;

    const isFailed = await controller.isFailedNode(nodeId);

    logger.info('ZWave Admin', `Node ${nodeId} failed check: ${isFailed}`);

    res.json({
      success: true,
      isFailed: isFailed,
      message: isFailed ? 'Node is marked as failed and can be removed' : 'Node is not marked as failed'
    });
  } catch (e) {
    logger.error('ZWave Admin', 'Error checking node lifespan', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/zwave/admin/node/:nodeId/heal
 * Heal a node (update routes)
 */
router.post('/node/:nodeId/heal', async (req: Request, res: Response) => {
  try {
    const nodeId = parseInt(req.params.nodeId);
    const driver = await getDriver();
    const node = driver.controller.nodes.get(nodeId);

    if (!node) {
      return res.status(404).json({ error: `Node ${nodeId} not found` });
    }

    // Refresh node info as a form of "healing"
    await node.refreshInfo();
    logger.info('ZWave Admin', `Refreshed node ${nodeId} info`);

    res.json({ success: true, message: 'Node info refreshed' });
  } catch (e) {
    logger.error('ZWave Admin', 'Error healing node', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/zwave/admin/inclusion/start
 * Start inclusion mode
 */
router.post('/inclusion/start', async (req: Request, res: Response) => {
  try {
    const { strategy = 'Default', forceSecurity = false } = req.body;
    const driver = await getDriver();
    const controller = driver.controller;

    const result = await controller.beginInclusion({
      strategy,
      forceSecurity,
    });

    logger.info('ZWave Admin', 'Inclusion mode started', { strategy, forceSecurity });

    res.json({ success: true, result });
  } catch (e) {
    logger.error('ZWave Admin', 'Error starting inclusion', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/zwave/admin/inclusion/stop
 * Stop inclusion mode
 */
router.post('/inclusion/stop', async (_req: Request, res: Response) => {
  try {
    const driver = await getDriver();
    const controller = driver.controller;

    const result = await controller.stopInclusion();
    logger.info('ZWave Admin', 'Inclusion mode stopped');

    res.json({ success: true, result });
  } catch (e) {
    logger.error('ZWave Admin', 'Error stopping inclusion', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/zwave/admin/inclusion/last-added
 * Get info about the last added node (for inclusion feedback)
 */
router.get('/inclusion/last-added', (_req: Request, res: Response) => {
  try {
    const lastAdded = getLastAddedNode();
    res.json(lastAdded);
  } catch (e) {
    logger.error('ZWave Admin', 'Error getting last added node', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/zwave/admin/inclusion/clear-last-added
 * Clear the last added node info
 */
router.post('/inclusion/clear-last-added', (_req: Request, res: Response) => {
  try {
    clearLastAddedNode();
    res.json({ success: true });
  } catch (e) {
    logger.error('ZWave Admin', 'Error clearing last added node', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/zwave/admin/exclusion/start
 * Start exclusion mode
 */
router.post('/exclusion/start', async (_req: Request, res: Response) => {
  try {
    const driver = await getDriver();
    const controller = driver.controller;

    const result = await controller.beginExclusion();
    logger.info('ZWave Admin', 'Exclusion mode started');

    res.json({ success: true, result });
  } catch (e) {
    logger.error('ZWave Admin', 'Error starting exclusion', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/zwave/admin/exclusion/stop
 * Stop exclusion mode
 */
router.post('/exclusion/stop', async (_req: Request, res: Response) => {
  try {
    const driver = await getDriver();
    const controller = driver.controller;

    const result = await controller.stopExclusion();
    logger.info('ZWave Admin', 'Exclusion mode stopped');

    res.json({ success: true, result });
  } catch (e) {
    logger.error('ZWave Admin', 'Error stopping exclusion', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * DELETE /api/zwave/admin/node/:nodeId
 * Remove a failed node
 */
router.delete('/node/:nodeId', async (req: Request, res: Response) => {
  try {
    const nodeId = parseInt(req.params.nodeId);
    const driver = await getDriver();
    const controller = driver.controller;

    await controller.removeFailedNode(nodeId);
    logger.info('ZWave Admin', `Removed failed node ${nodeId}`);

    res.json({ success: true });
  } catch (e) {
    logger.error('ZWave Admin', 'Error removing failed node', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/zwave/admin/heal-network
 * Heal the entire network
 */
router.post('/heal-network', async (_req: Request, res: Response) => {
  try {
    const driver = await getDriver();
    const controller = driver.controller;

    // Refresh all nodes as a form of network healing
    const nodes = Array.from(controller.nodes.values());
    let refreshed = 0;

    for (const node of nodes) {
      if (!node.isControllerNode && node.ready) {
        try {
          await node.refreshInfo();
          refreshed++;
        } catch (e) {
          logger.warn('ZWave Admin', `Failed to refresh node ${node.id}`, e);
        }
      }
    }

    logger.info('ZWave Admin', `Network healing: refreshed ${refreshed} nodes`);

    res.json({ success: true, message: `Network healing: refreshed ${refreshed} nodes` });
  } catch (e) {
    logger.error('ZWave Admin', 'Error healing network', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;

