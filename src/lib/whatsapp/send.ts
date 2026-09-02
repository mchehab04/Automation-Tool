import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type SendWhatsAppInput = {
  to: string; // E.164 with "+", same convention as Lead.phone
  text: string;
  document?: { filename: string; content: Buffer; caption?: string };
};

export type SendWhatsAppResult = { delivered: boolean; simulated: boolean; error?: string };

// Raw fetch against Meta's Graph API — plain REST/JSON (+ multipart for
// media upload), no SDK needed. Lazily checks env on every call (cheap,
// and mirrors email/send.ts's "missing credential -> simulated" fallback
// rather than crashing at module load).
export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.log(`[simulated whatsapp — WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID not set] to=${input.to}`);
    return { delivered: false, simulated: true };
  }

  const to = input.to.replace(/^\+/, ""); // Meta's `to` field: digits only, no leading "+"
  const base = `https://graph.facebook.com/v21.0/${phoneNumberId}`;

  try {
    let documentId: string | undefined;
    if (input.document) {
      // Document attachments are a two-step flow: upload the file to get a
      // media ID, then reference that ID in the actual message. Plain text
      // messages skip this entirely.
      const form = new FormData();
      form.append("messaging_product", "whatsapp");
      form.append("type", "application/pdf");
      form.append("file", new Blob([new Uint8Array(input.document.content)], { type: "application/pdf" }), input.document.filename);

      const uploadRes = await fetch(`${base}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!uploadRes.ok) throw new Error(`Media upload failed: ${await uploadRes.text()}`);
      ({ id: documentId } = await uploadRes.json());
    }

    const body = input.document
      ? {
          messaging_product: "whatsapp",
          to,
          type: "document",
          document: { id: documentId, filename: input.document.filename, caption: input.text },
        }
      : { messaging_product: "whatsapp", to, type: "text", text: { body: input.text } };

    const sendRes = await fetch(`${base}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!sendRes.ok) throw new Error(`WhatsApp send failed: ${await sendRes.text()}`);

    return { delivered: true, simulated: false };
  } catch (err) {
    console.error("Failed to send WhatsApp message", err);
    return { delivered: false, simulated: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Mirrors sendLeadEmail's exact contract (src/lib/email/send.ts): absorbs
// the failure path (Activity note + revalidate + throw), returns a
// success-path note for the caller to persist inside its own transaction.
export async function sendLeadWhatsApp(
  leadId: string,
  input: { to: string; text: string; document?: SendWhatsAppInput["document"]; label: string },
): Promise<{ delivered: boolean; simulated: boolean; note: string }> {
  const result = await sendWhatsApp({ to: input.to, text: input.text, document: input.document });

  if (!result.delivered && !result.simulated) {
    await prisma.activity.create({
      data: {
        leadId,
        type: "NOTE",
        note: `${input.label} failed to send via WhatsApp to ${input.to}: ${result.error ?? "unknown error"}.`,
      },
    });
    revalidatePath(`/leads/${leadId}`);
    throw new Error(result.error ?? `Failed to send the ${input.label.toLowerCase()} via WhatsApp.`);
  }

  const note = result.delivered
    ? `${input.label} sent via WhatsApp to ${input.to}.`
    : `${input.label} approved to send via WhatsApp to ${input.to} — no WhatsApp provider is configured yet, so this wasn't actually delivered.`;

  return { delivered: result.delivered, simulated: result.simulated, note };
}
