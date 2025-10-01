/**
 * JSON Schema for dashboard configuration validation
 */

export const dashboardSchema = {
  type: 'object',
  required: ['widgets'],
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
    widgets: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type'],
        additionalProperties: true,
        properties: {
          type: { type: 'string' },
          title: { type: 'string' },
          subtitle: { type: 'string' },
          x: { type: 'integer', minimum: 1 },
          y: { type: 'integer', minimum: 1 },
          w: { type: 'integer', minimum: 1 },
          h: { type: 'integer', minimum: 1 },
          refreshSeconds: { type: 'integer', minimum: 0 },
          props: { type: 'object' },
        },
      },
    },
  },
};
