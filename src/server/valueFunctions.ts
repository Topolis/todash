import type { ValueFunction, ValueFunctionsRegistry } from '@types/plugin';

/**
 * Registry of value functions for status widget
 */
const valueFunctions: ValueFunctionsRegistry = {};

/**
 * Register a value function
 */
export function registerValueFunction(name: string, fn: ValueFunction): void {
  valueFunctions[name] = fn;
}

/**
 * Get a value function by name
 */
export function getValueFunction(name: string): ValueFunction | undefined {
  return valueFunctions[name];
}

/**
 * Get all registered value function names
 */
export function getValueFunctionNames(): string[] {
  return Object.keys(valueFunctions);
}

/**
 * Evaluate a value function with config
 */
export async function evaluateValueFunction(name: string, config: any): Promise<any> {
  const fn = valueFunctions[name];
  if (!fn) {
    throw new Error(`Value function '${name}' not found`);
  }
  return await fn(config);
}
