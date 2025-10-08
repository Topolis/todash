import { logger } from '@lib/logger';
import { registerCommand } from './data';

/**
 * Register all built-in commands
 * This is called automatically when this module is imported
 */
function registerBuiltInCommands() {
  // setTempZWave command - sets Z-Wave thermostat temperature
  registerCommand('setTempZWave', async (params: any[]) => {
    const [nodeId, temperature] = params;

    if (typeof nodeId !== 'number' || typeof temperature !== 'number') {
      throw new Error('setTempZWave requires [nodeId: number, temperature: number]');
    }

    logger.info('TimedScripts', `Setting Z-Wave node ${nodeId} to ${temperature}°C`);

    try {
      // Import Z-Wave service dynamically to avoid circular dependencies
      const { getDriver } = await import('../zwave/service.js');
      const driver = await getDriver();
      const node = driver.controller.nodes.get(nodeId);

      if (!node) {
        throw new Error(`Z-Wave node ${nodeId} not found`);
      }

      // Set thermostat setpoint (heating mode = 1)
      // Try command class 0x43 (Thermostat Setpoint)
      await node.setValue(
        {
          commandClass: 0x43, // Thermostat Setpoint
          property: 'setpoint',
          propertyKey: 1, // Heating mode
        },
        temperature
      );

      logger.info('TimedScripts', `Successfully set node ${nodeId} to ${temperature}°C`);
    } catch (error) {
      logger.error('TimedScripts', `Failed to set temperature for node ${nodeId}`, error);
      throw error;
    }
  });
}

// Auto-register commands when this module is imported
registerBuiltInCommands();

