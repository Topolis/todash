/**
 * JSON Schema for dashboard configuration validation
 */

export const dashboardSchema = {
  type: 'object',
  required: ['panels'],
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    settings: {
      type: 'object',
      additionalProperties: true,
      properties: {
        dateFormat: { type: 'string' },
        defaultLocation: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
          },
          required: ['latitude', 'longitude'],
        },
      },
    },
    grid: {
      type: 'object',
      additionalProperties: false,
      properties: {
        columns: { type: 'integer', minimum: 1 },
        gap: { type: 'integer', minimum: 0 },
        rowHeight: { type: 'integer', minimum: 10 },
      },
    },
    // Panels format
    panels: {
      type: 'array',
      items: {
        type: 'object',
        required: ['panelType'],
        additionalProperties: true,
        properties: {
          panelType: { type: 'string', enum: ['single', 'tabbed', 'stacked', 'grid'] },
          x: { type: 'integer', minimum: 1 },
          y: { type: 'integer', minimum: 1 },
          w: { type: 'integer', minimum: 1 },
          h: { type: 'integer', minimum: 1 },
          // Additional properties validated based on panelType
          widget: { type: 'object' },
          widgets: { type: 'array' },
          defaultTab: { type: 'integer', minimum: 0 },
        },
      },
    },
  },
};
