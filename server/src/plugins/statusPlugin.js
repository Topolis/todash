import { getValueFunction } from '../valueFunctions.js';

export const statusPlugin = {
  async fetchData(config) {
    const items = Array.isArray(config.items) ? config.items : [];

    async function evalFn(spec) {
      if (spec == null) return null;
      // Allow static numbers (or numeric strings)
      if (typeof spec === 'number') return spec;
      if (typeof spec === 'string' && spec.trim() !== '' && !isNaN(Number(spec))) return Number(spec);
      if (typeof spec !== 'object') return null;
      const fnName = Object.keys(spec)[0];
      const params = spec[fnName] || {};
      const fn = getValueFunction(fnName);
      if (!fn) return null;
      const result = await fn(params);
      return result;
    }

    const outItems = await Promise.all(items.map(async (it) => {
      const value = await evalFn(it.value);
      const valueMax = (it.valueMax !== undefined) ? await evalFn(it.valueMax) : undefined;
      const display = it.display || 'text';
      const format = it.format || null;
      return { label: it.label || '', value, valueMax, display, format };
    }));

    return { items: outItems };
  },
};

