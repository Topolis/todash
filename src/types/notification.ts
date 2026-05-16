// ABOUTME: Type definitions for the dashboard notification system.
// Notifications can be sent by server-side services, widgets, and the app itself.

export type NotificationSeverity = 'debug' | 'info' | 'warn' | 'error';

export interface Notification {
  id: string;
  timestamp: number;
  origin: string;
  severity: NotificationSeverity;
  message: string; // Markdown text
}
