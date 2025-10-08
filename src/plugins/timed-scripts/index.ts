import type { Plugin } from '@types/plugin';
import TimedScriptsWidget from './widget';

const plugin: Plugin = {
  name: 'timed-scripts',
  description: 'Automated scripts running on cron schedules',
  widget: TimedScriptsWidget,
  dataProvider: null as any, // Set on server-side only
  serverSide: true, // Needs server-side for cron scheduling
};

export default plugin;

