import nodemailer from "nodemailer";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

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

// Shared by every "send an email tied to a lead" flow (reply, quote,
// closing thank-you) — each of those hand-duplicated the exact same
// send-and-branch-on-outcome logic before this was factored out. Only the
// failure path is fully absorbed here (identical across every caller: one
// Activity note, revalidate, throw); the success-path note is returned so
// each caller can still write it inside its own transaction alongside its
// own field-clearing/notification-marking, preserving each flow's existing
// atomicity exactly.
export async function sendLeadEmail(
  leadId: string,
  input: {
    to: string;
    fromName: string;
    subject: string;
    text: string;
    attachment?: SendEmailInput["attachment"];
    label: string;
  },
): Promise<{ delivered: boolean; simulated: boolean; note: string }> {
  const result = await sendEmail({
    to: input.to,
    fromName: input.fromName,
    subject: input.subject,
    text: input.text,
    attachment: input.attachment,
  });

  if (!result.delivered && !result.simulated) {
    await prisma.activity.create({
      data: {
        leadId,
        type: "NOTE",
        note: `${input.label} failed to send to ${input.to}: ${result.error ?? "unknown error"}.`,
      },
    });
    revalidatePath(`/leads/${leadId}`);
    throw new Error(result.error ?? `Failed to send the ${input.label.toLowerCase()}.`);
  }

  const note = result.delivered
    ? `${input.label} emailed to ${input.to}.`
    : `${input.label} approved to send to ${input.to} — no email provider is configured yet, so this wasn't actually delivered.`;

  return { delivered: result.delivered, simulated: result.simulated, note };
}
