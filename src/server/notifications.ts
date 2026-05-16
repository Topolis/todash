// ABOUTME: Server-side in-memory notification store.
// Other server modules can import `notificationStore` to push notifications.

import type { Notification, NotificationSeverity } from '@types/notification';

const VALID_SEVERITIES: NotificationSeverity[] = ['debug', 'info', 'warn', 'error'];
const MAX_ITEMS = 200;

class NotificationStore {
  private items: Notification[] = [];

  add(origin: string, severity: NotificationSeverity, message: string): Notification {
    const notification: Notification = {
      id: globalThis.crypto.randomUUID(),
      timestamp: Date.now(),
      origin,
      severity,
      message,
    };

    this.items.push(notification);

    if (this.items.length > MAX_ITEMS) {
      this.items = this.items.slice(-MAX_ITEMS);
    }

    return notification;
  }

  getAll(): Notification[] {
    return [...this.items];
  }

  dismiss(id: string): boolean {
    const before = this.items.length;
    this.items = this.items.filter((n) => n.id !== id);
    return this.items.length < before;
  }

  dismissAll(): void {
    this.items = [];
  }

  isValidSeverity(value: unknown): value is NotificationSeverity {
    return VALID_SEVERITIES.includes(value as NotificationSeverity);
  }
}

export const notificationStore = new NotificationStore();
