import type { PluginDefinition } from '@types/plugin';
import CalendarICSWidget from './widget';

export type { CalendarConfig, CalendarData, CalendarEvent, CalendarSource } from './data';

export const calendarPlugin: PluginDefinition<any, any> = {
  name: 'calendar-ics',
  displayName: 'Calendar (ICS)',
  description: 'Display upcoming events from ICS calendar feeds',
  widget: CalendarICSWidget as any,
  serverSide: true,
  defaultRefreshInterval: 600,
  defaultConfig: {
    lookAheadDays: 14,
    limit: 20,
    showSourceStatus: true,
  },
};
