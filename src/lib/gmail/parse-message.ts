import { simpleParser } from "mailparser";

export type ParsedInboundEmail = {
  messageId: string | null;
  fromEmail: string | null;
  fromName: string | null;
  subject: string;
  text: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function parseRawMessage(source: Buffer): Promise<ParsedInboundEmail> {
  const parsed = await simpleParser(source);

  const from = Array.isArray(parsed.from) ? parsed.from[0] : parsed.from;
  const fromAddress = from?.value?.[0];

  const text = parsed.text?.trim() || (parsed.html ? stripHtml(parsed.html) : "");

  return {
    messageId: parsed.messageId?.trim() || null,
    fromEmail: fromAddress?.address?.trim().toLowerCase() || null,
    fromName: fromAddress?.name?.trim() || null,
    subject: parsed.subject?.trim() || "(no subject)",
    text,
  };
}
