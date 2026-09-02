import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email/send";
import { sendWhatsApp } from "@/lib/whatsapp/send";

// Shared by sendQuoteToCustomer and sendInvoiceToCustomer — both need the
// exact same "try every available channel, aggregate per-channel results
// into one note, decide overall success" logic. Mirrors sendLeadEmail's
// contract (absorbs the failure-path DB write + revalidate, returns a
// success note for the caller's own transaction), extended to multiple
// channels: overall success means at least one channel delivered (or was
// simulated), and the note always states the per-channel outcome
// explicitly so a partial failure stays visible in the Activity timeline
// even though the UI doesn't block on it.
export async function sendDocumentToAllChannels(
  leadId: string,
  input: {
    lead: { email: string | null; phone: string | null; business: { name: string } };
    subjectEmail: string;
    text: string;
    attachment: { filename: string; content: Buffer; contentType: string };
    label: string; // e.g. "Quote #000012"
  },
): Promise<{ note: string } | { error: string }> {
  const results: string[] = [];
  let anySucceeded = false;

  if (input.lead.email) {
    const r = await sendEmail({
      to: input.lead.email,
      fromName: input.lead.business.name,
      subject: input.subjectEmail,
      text: input.text,
      attachment: input.attachment,
    });
    if (r.delivered || r.simulated) {
      anySucceeded = true;
      results.push(
        r.delivered
          ? `emailed to ${input.lead.email}`
          : `approved to email to ${input.lead.email} — no email provider configured, not actually delivered`,
      );
    } else {
      results.push(`failed to email to ${input.lead.email}: ${r.error ?? "unknown error"}`);
    }
  }

  if (input.lead.phone) {
    const r = await sendWhatsApp({
      to: input.lead.phone,
      text: input.text,
      document: { filename: input.attachment.filename, content: input.attachment.content, caption: input.text },
    });
    if (r.delivered || r.simulated) {
      anySucceeded = true;
      results.push(
        r.delivered
          ? `sent via WhatsApp to ${input.lead.phone}`
          : `approved to send via WhatsApp to ${input.lead.phone} — no WhatsApp provider configured, not actually delivered`,
      );
    } else {
      results.push(`failed to send via WhatsApp to ${input.lead.phone}: ${r.error ?? "unknown error"}`);
    }
  }

  const note = `${input.label} — ${results.join("; ")}.`;

  if (!anySucceeded) {
    await prisma.activity.create({ data: { leadId, type: "NOTE", note } });
    revalidatePath(`/leads/${leadId}`);
    return { error: note };
  }
  return { note };
}
