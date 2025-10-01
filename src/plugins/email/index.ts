import type { PluginDefinition } from '@types/plugin';
import EmailWidget from './widget';

export type { EmailConfig, EmailData, EmailMessage } from './data';

export const emailPlugin: PluginDefinition<any, any> = {
  name: 'email',
  displayName: 'Email',
  description: 'Display unread emails from IMAP mailbox',
  widget: EmailWidget as any,
  serverSide: true,
  defaultRefreshInterval: 300,
  defaultConfig: {
    limit: 20,
    mailbox: 'INBOX',
  },
};
