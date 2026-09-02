import type { LeadSource } from "@/generated/prisma/enums";

export type Channel = "email" | "whatsapp";

// For documents (quote/invoice) — every channel there's contact info for,
// so delivery isn't riding on just one.
export function availableChannels(lead: { email: string | null; phone: string | null }): Channel[] {
  const channels: Channel[] = [];
  if (lead.email) channels.push("email");
  if (lead.phone) channels.push("whatsapp");
  return channels;
}

// For conversational messages (reply/booking-confirmation/closing
// thank-you) — reply via the channel the lead actually came from, so it
// lands in the same thread the customer is already looking at. MANUAL
// leads (no channel of origin) and any mismatch fall back to whichever
// contact info exists, preferring email (this app's default before
// WhatsApp existed).
export function originChannel(
  lead: { source: LeadSource; email: string | null; phone: string | null },
): Channel | null {
  if (lead.source === "WHATSAPP" && lead.phone) return "whatsapp";
  if (lead.email) return "email";
  if (lead.phone) return "whatsapp";
  return null;
}
