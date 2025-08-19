// Registry for status value functions
// Other modules can import { registerValueFunction, valueFunctions } and add their own

export const valueFunctions = new Map();

export function registerValueFunction(name, fn) {
  if (typeof name !== 'string' || !name) throw new Error('registerValueFunction requires a non-empty name');
  if (typeof fn !== 'function') throw new Error('registerValueFunction requires a function');
  valueFunctions.set(name, fn);
}

export function getValueFunction(name) {
  return valueFunctions.get(name);
}

