import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';

// Note: Plugins are registered on both client and server
// Client-side registration happens here for the widget components
// Server-side registration happens in server.ts for data providers

// Import and register all plugins
import { registerPlugin } from '@plugins/index';
import { weatherPlugin, weatherForecastPlugin } from '@plugins/weather';
import { linksPlugin } from '@plugins/links';
import { statusPlugin } from '@plugins/status';
import { systemPlugin } from '@plugins/system';
import { rssPlugin } from '@plugins/rss';
import { projectPlugin } from '@plugins/project';
import { calendarPlugin } from '@plugins/calendar';
import { emailPlugin } from '@plugins/email';
import { youtubePlugin } from '@plugins/youtube';
import { transitPlugin } from '@plugins/transit';
import { aqiPlugin } from '@plugins/aqi';

// Register all plugins
registerPlugin(weatherPlugin);
registerPlugin(weatherForecastPlugin);
registerPlugin(linksPlugin);
registerPlugin(statusPlugin);
registerPlugin(systemPlugin);
registerPlugin(rssPlugin);
registerPlugin(projectPlugin);
registerPlugin(calendarPlugin);
registerPlugin(emailPlugin);
registerPlugin(youtubePlugin);
registerPlugin(transitPlugin);
registerPlugin(aqiPlugin);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
