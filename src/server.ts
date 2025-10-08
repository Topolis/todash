import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import apiRouter from './server/api.js';

// Import and register all plugins with their data providers
import { registerServerPlugins } from './server/plugins.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register all plugins with their data providers
registerServerPlugins();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', apiRouter);

// Z-Wave admin routes
import('./plugins/zwave/admin-api.js').then(module => {
  app.use('/api/zwave/admin', module.default);
  console.log('Z-Wave admin routes registered');
}).catch(err => {
  console.warn('Z-Wave admin routes not available:', err.message);
});

// Timed Scripts routes
import('./plugins/timed-scripts/api.js').then(module => {
  app.use('/api/timed-scripts', module.default);
  console.log('Timed Scripts routes registered');
}).catch(err => {
  console.warn('Timed Scripts routes not available:', err.message);
});

// Serve static frontend in production
if (process.env.SERVE_WEB === 'true' || process.env.NODE_ENV === 'production') {
  // When running with tsx, __dirname points to src/, so we need to go up one level
  const rootDir = path.resolve(__dirname, '..');
  const distDir = path.join(rootDir, 'dist', 'public');

  if (fs.existsSync(distDir)) {
    console.log(`Serving static files from ${distDir}`);
    app.use(express.static(distDir));

    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    console.warn(`Static files directory not found: ${distDir}`);
    console.warn('Run "npm run build" to build the frontend');
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  
  if (process.env.SERVE_WEB !== 'true' && process.env.NODE_ENV !== 'production') {
    console.log('Frontend dev server should be running on http://localhost:5173');
    console.log('API endpoints available at http://localhost:4000/api');
  }
});
