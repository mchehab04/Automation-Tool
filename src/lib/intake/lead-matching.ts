import { prisma } from "@/lib/db";
import { MAX_LENGTHS, parseForgivingNumber } from "@/lib/validation";

export type SuggestedLineItem = { description: string; unitPrice: string };

// A returning customer identified by email/phone continues their existing
// lead instead of spawning a duplicate.
export async function findExistingLeadByContact(
  businessId: string,
  contact: { email?: string; phone?: string },
) {
  if (contact.email) {
    const byEmail = await prisma.lead.findFirst({
      where: { businessId, email: contact.email },
    });
    if (byEmail) return byEmail;
  }
  if (contact.phone) {
    return prisma.lead.findFirst({ where: { businessId, phone: contact.phone } });
  }
  return null;
}

export function buildSuggestedLineItems(
  items: { description: string; estimated_price: string }[],
): SuggestedLineItem[] {
  return items
    .map((item) => ({
      description: item.description.trim().slice(0, MAX_LENGTHS.quoteDescription),
      unitPrice: String(Math.max(0, Math.round(parseForgivingNumber(item.estimated_price)))),
    }))
    .filter((item) => item.description.length > 0);
}

// Appended rather than replaced, so an earlier symptom isn't lost if a later
// message doesn't happen to repeat it. Capped so a long-running thread can't
// grow the draft unboundedly; a human reviews/edits before it's used.
export function mergeSuggestedLineItems(
  existingJson: string | null,
  newItems: SuggestedLineItem[],
): SuggestedLineItem[] {
  const prior: SuggestedLineItem[] = existingJson ? JSON.parse(existingJson) : [];
  return [...prior, ...newItems].slice(0, 8);
}
