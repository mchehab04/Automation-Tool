import { ImapFlow } from "imapflow";

export type ImapUnavailable = { notConfigured: true };

function isConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

// Fresh connection per call — serverless invocations (Vercel Cron) can't
// reuse a long-lived client the way the SMTP transport in email/send.ts
// caches one, so always connect and always log out.
export async function withImapConnection<T>(
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T | ImapUnavailable> {
  if (!isConfigured()) {
    return { notConfigured: true };
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
    logger: false,
  });

  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => {});
  }
}
