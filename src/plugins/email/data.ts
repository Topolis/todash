import { getSecret } from '@server/secrets';

export interface EmailConfig {
  action?: 'list' | 'markRead' | 'getBody';
  limit?: number;
  mailbox?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  uid?: number;
  force?: boolean;
}

export interface EmailMessage {
  uid: number;
  subject: string;
  from: string;
  date: Date;
  seen: boolean;
}

export interface EmailBody {
  uid: number;
  subject: string;
  from: string;
  date: Date;
  text?: string | null;
  html?: string | null;
  raw?: string;
}

export type EmailData = EmailMessage[] | EmailBody | { ok: boolean };

export async function fetchEmailData(config: EmailConfig): Promise<EmailData> {
  const action = config.action || 'list';
  const host = config.host || getSecret('IMAP_HOST');
  const port = Number(config.port || getSecret('IMAP_PORT') || 993);
  const secure =
    typeof config.secure === 'boolean' ? config.secure : String(getSecret('IMAP_SECURE') || 'true') === 'true';
  const user = config.user || getSecret('IMAP_USER');
  const pass = config.password || getSecret('IMAP_PASSWORD');
  const mailbox = config.mailbox || getSecret('IMAP_MAILBOX') || 'INBOX';
  const limit = Number(config.limit || 20);

  if (!host || !user || !pass) {
    throw new Error('IMAP credentials missing. Provide via env/SECRETS_FILE or widget props.');
  }

  let ImapFlow: any;
  try {
    const module = await import('imapflow');
    ImapFlow = module.ImapFlow;
  } catch {
    throw new Error('Missing dependency imapflow. Please install it with: npm install imapflow');
  }

  const client = new ImapFlow({ host, port, secure, auth: { user, pass } });

  try {
    await client.connect();
    await client.mailboxOpen(mailbox);

    if (action === 'markRead') {
      if (!config.uid) throw new Error('markRead requires uid');
      await client.messageFlagsAdd({ uid: Number(config.uid) }, ['\\Seen']);
      return { ok: true };
    }

    if (action === 'getBody') {
      if (!config.uid) throw new Error('getBody requires uid');
      let raw = '';

      for await (const msg of client.fetch(
        { uid: Number(config.uid) },
        { source: true, envelope: true, internalDate: true }
      )) {
        const chunks: Buffer[] = [];
        for await (const chunk of msg.source) {
          chunks.push(chunk);
        }
        raw = Buffer.concat(chunks).toString('utf8');
        const env = msg.envelope;
        let parsed: { text: string | null; html: string | null } = { text: null, html: null };

        try {
          const mp = await import('mailparser');
          const parsedMail = await mp.simpleParser(raw);
          parsed = { text: parsedMail.text || null, html: parsedMail.html || null };
        } catch {}

        return {
          uid: Number(config.uid),
          subject: env?.subject || '',
          from: env?.from?.map((a: any) => a.address || a.name).join(', ') || '',
          date: msg.internalDate,
          ...parsed,
          raw: parsed.html || parsed.text ? undefined : raw.slice(0, 20000),
        };
      }
      return { uid: Number(config.uid), subject: '', from: '', date: new Date() };
    }

    // List unread messages
    const uids = await client.search({ seen: false });
    const u = uids.slice(-limit).reverse();
    const out: EmailMessage[] = [];

    for await (const msg of client.fetch(u, { uid: true, envelope: true, internalDate: true, flags: true })) {
      const env = msg.envelope;
      out.push({
        uid: msg.uid,
        subject: env?.subject || '(no subject)',
        from: (env?.from || [])
          .map((a: any) => a.name || a.address)
          .filter(Boolean)
          .join(', '),
        date: msg.internalDate,
        seen: (msg.flags || []).includes('\\Seen'),
      });
    }

    return out;
  } finally {
    try {
      await client.logout();
    } catch {}
  }
}
