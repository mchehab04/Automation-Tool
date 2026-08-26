import nodemailer from "nodemailer";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  fromName?: string;
  attachment?: { filename: string; content: Buffer; contentType: string };
};

export type SendEmailResult = {
  delivered: boolean;
  simulated: boolean;
  error?: string;
};

let transport: ReturnType<typeof nodemailer.createTransport> | null | undefined;

// Lazily built so a missing credential doesn't crash module load — just
// falls back to simulated sending until GMAIL_USER/GMAIL_APP_PASSWORD exist.
function getTransport() {
  if (transport !== undefined) return transport;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  transport = user && pass ? nodemailer.createTransport({ service: "gmail", auth: { user, pass } }) : null;
  return transport;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getTransport();

  if (!client) {
    console.log(`[simulated email — GMAIL_USER/GMAIL_APP_PASSWORD not set] to=${input.to} subject="${input.subject}"`);
    return { delivered: false, simulated: true };
  }

  try {
    await client.sendMail({
      from: input.fromName ? `"${input.fromName}" <${process.env.GMAIL_USER}>` : process.env.GMAIL_USER,
      to: input.to,
      subject: input.subject,
      text: input.text,
      attachments: input.attachment
        ? [
            {
              filename: input.attachment.filename,
              content: input.attachment.content,
              contentType: input.attachment.contentType,
            },
          ]
        : undefined,
    });
    return { delivered: true, simulated: false };
  } catch (err) {
    console.error("Failed to send email via Gmail", err);
    return {
      delivered: false,
      simulated: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
