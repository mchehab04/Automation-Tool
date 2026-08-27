import { prisma } from "@/lib/db";
import type { PipelineStage } from "@/generated/prisma/enums";
import { MAX_LENGTHS, parseForgivingNumber } from "@/lib/validation";
import type { ExtractedSuggestedLineItem } from "@/lib/intake/extract-enquiry";

export type SuggestedLineItem = { description: string; quantity: string; unitPrice: string };

// Terminal stages — a lead here is done; a new contact from the same
// customer should start a fresh lead, not reopen this one.
const CLOSED_STAGES: PipelineStage[] = ["WON", "LOST"];

// A returning customer identified by email/phone continues their existing
// OPEN lead instead of spawning a duplicate. Closed (WON/LOST) leads are
// excluded so a repeat contact after a closed engagement starts a new lead
// — see findMostRecentClosedLead for linking that new lead back to history.
export async function findExistingLeadByContact(
  businessId: string,
  contact: { email?: string; phone?: string },
) {
  if (contact.email) {
    const byEmail = await prisma.lead.findFirst({
      where: { businessId, email: contact.email, stage: { notIn: CLOSED_STAGES } },
    });
    if (byEmail) return byEmail;
  }
  if (contact.phone) {
    return prisma.lead.findFirst({
      where: { businessId, phone: contact.phone, stage: { notIn: CLOSED_STAGES } },
    });
  }
  return null;
}

// The same contact's most recently closed lead, if any — used only when
// findExistingLeadByContact returned nothing, to link the new lead back to
// this history (Lead.previousLeadId) and prefill name/company. Never used
// to append messages to; the closed lead itself is never modified here.
export async function findMostRecentClosedLead(
  businessId: string,
  contact: { email?: string; phone?: string },
) {
  if (contact.email) {
    const byEmail = await prisma.lead.findFirst({
      where: { businessId, email: contact.email, stage: { in: CLOSED_STAGES } },
      orderBy: { updatedAt: "desc" },
    });
    if (byEmail) return byEmail;
  }
  if (contact.phone) {
    return prisma.lead.findFirst({
      where: { businessId, phone: contact.phone, stage: { in: CLOSED_STAGES } },
      orderBy: { updatedAt: "desc" },
    });
  }
  return null;
}

export function buildSuggestedLineItems(
  items: ExtractedSuggestedLineItem[],
): SuggestedLineItem[] {
  return items
    .map((item) => ({
      description: item.description.trim().slice(0, MAX_LENGTHS.quoteDescription),
      quantity: String(Math.max(1, Math.round(parseForgivingNumber(item.quantity) || 1))),
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
