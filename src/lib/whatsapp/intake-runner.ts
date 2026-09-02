import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { MAX_LENGTHS, isPlaceholderText } from "@/lib/validation";
import { extractEnquiry, type CatalogItem } from "@/lib/intake/extract-enquiry";
import {
  findExistingLeadByContact,
  findMostRecentClosedLead,
  buildSuggestedLineItems,
  type SuggestedLineItem,
} from "@/lib/intake/lead-matching";
import { STAGE_LABELS } from "@/lib/pipeline";

const DEMO_BUSINESS_ID = "demo-business";

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// WhatsApp sends digits only (e.g. "971501234567") — prefix "+" to match
// this app's existing phone convention.
function normalizeWhatsAppPhone(from: string): string {
  return `+${from.replace(/\D/g, "")}`;
}

// Mirrors gmail/intake-runner.ts's processOneMessage (extract -> match ->
// branch new/continuing -> write DB) — a third implementation rather than a
// shared abstraction, since the IMAP-specific half of that file (mark-seen,
// mailbox search, streaming) doesn't apply to a webhook at all.
export async function processWhatsAppMessage(input: {
  from: string;
  text: string;
  messageId: string;
  senderName?: string;
}): Promise<void> {
  const phone = normalizeWhatsAppPhone(input.from);

  const [existingLead, catalogItemsRaw] = await Promise.all([
    findExistingLeadByContact(DEMO_BUSINESS_ID, { phone }),
    prisma.serviceCatalogItem.findMany({ where: { businessId: DEMO_BUSINESS_ID } }),
  ]);
  const priorSuggestions: SuggestedLineItem[] = existingLead?.suggestedLineItems
    ? JSON.parse(existingLead.suggestedLineItems)
    : [];
  const catalogItems: CatalogItem[] = catalogItemsRaw.map((item) => ({
    description: item.description,
    unitPrice: String(Math.round(item.unitPrice / 100)),
  }));

  const priorMessages = existingLead
    ? await prisma.message.findMany({
        where: { leadId: existingLead.id },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const priorThreadText = priorMessages
    .map((m) => `${m.role === "CUSTOMER" ? "Customer" : "Business"}: ${m.text}`)
    .join("\n\n");
  const threadText = priorThreadText
    ? `${priorThreadText}\n\nCustomer: ${input.text}`
    : `Customer: ${input.text}`;

  const data = await extractEnquiry(threadText, "whatsapp", priorSuggestions, catalogItems);

  if (!data.is_enquiry) return;

  const closedLead = existingLead
    ? null
    : await findMostRecentClosedLead(DEMO_BUSINESS_ID, { phone });

  const companyRaw = data.company.trim();
  const company =
    companyRaw && !isPlaceholderText(companyRaw)
      ? companyRaw.slice(0, MAX_LENGTHS.company)
      : closedLead?.company || "";

  const nameRaw = data.name.trim();
  const extractedName = !isPlaceholderText(nameRaw) ? nameRaw.slice(0, MAX_LENGTHS.name) : "";
  const profileName = input.senderName?.trim().slice(0, MAX_LENGTHS.name) || "";

  let name: string;
  let nameNote = "";
  if (extractedName) {
    name = extractedName;
  } else if (existingLead?.name) {
    name = existingLead.name;
  } else if (closedLead?.name) {
    name = closedLead.name;
    nameNote = ` Name and company carried over from a previous (closed) lead — confirm still current.`;
  } else if (profileName) {
    name = profileName;
    nameNote = ` Name taken from their WhatsApp profile (${phone}) — confirm with the customer.`;
  } else {
    name = `New enquiry (${phone})`;
    nameNote = ` Name unknown — confirm with the customer.`;
  }

  const draftReply = data.draft_reply.trim();
  const clarifyingNote = draftReply ? ` A clarifying question worth asking: "${draftReply}"` : "";
  const acknowledgmentMessage = data.acknowledgment_message.trim();

  const vehicleMake = data.vehicle_make.trim().slice(0, MAX_LENGTHS.vehicleField) || closedLead?.vehicleMake || "";
  const vehicleModel = data.vehicle_model.trim().slice(0, MAX_LENGTHS.vehicleField) || closedLead?.vehicleModel || "";
  const vehicleYear = data.vehicle_year.trim().slice(0, MAX_LENGTHS.vehicleYear) || closedLead?.vehicleYear || "";

  const updatedSuggestedLineItems = buildSuggestedLineItems(data.suggested_line_items);
  const messageData = {
    role: "CUSTOMER" as const,
    text: input.text.slice(0, 2000),
    externalId: input.messageId,
  };

  try {
    if (existingLead) {
      const note = `New message received via WhatsApp intake (AI triage).\n\n${data.summary}${clarifyingNote}`.slice(
        0,
        MAX_LENGTHS.note,
      );
      await prisma.$transaction([
        prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            messages: { create: messageData },
            suggestedLineItems:
              updatedSuggestedLineItems.length > 0 ? JSON.stringify(updatedSuggestedLineItems) : undefined,
            pendingReplyText: draftReply || undefined,
            pendingQuoteMessage: acknowledgmentMessage || undefined,
            vehicleMake: !existingLead.vehicleMake && vehicleMake ? vehicleMake : undefined,
            vehicleModel: !existingLead.vehicleModel && vehicleModel ? vehicleModel : undefined,
            vehicleYear: !existingLead.vehicleYear && vehicleYear ? vehicleYear : undefined,
          },
        }),
        prisma.activity.create({ data: { leadId: existingLead.id, type: "NOTE", note } }),
        prisma.notification.create({
          data: {
            leadId: existingLead.id,
            type: "NEW_MESSAGE",
            message: `New message from ${existingLead.name}: ${data.summary}`,
          },
        }),
        ...(draftReply
          ? [
              prisma.notification.create({
                data: {
                  leadId: existingLead.id,
                  type: "REPLY_SEND_PENDING" as const,
                  message: `A reply to ${existingLead.name} is drafted and ready to review.`,
                },
              }),
            ]
          : []),
      ]);
    } else {
      const closedLeadNote = closedLead
        ? ` This customer has a previous lead that closed as ${STAGE_LABELS[closedLead.stage]} — linked as history.`
        : "";
      const note = `Auto-created from WhatsApp intake (AI triage).\n\n${data.summary}${nameNote}${clarifyingNote}${closedLeadNote}`.slice(
        0,
        MAX_LENGTHS.note,
      );

      const lead = await prisma.lead.create({
        data: {
          businessId: DEMO_BUSINESS_ID,
          name,
          phone,
          company: company || null,
          source: "WHATSAPP",
          previousLeadId: closedLead?.id ?? null,
          vehicleMake: vehicleMake || null,
          vehicleModel: vehicleModel || null,
          vehicleYear: vehicleYear || null,
          suggestedLineItems:
            updatedSuggestedLineItems.length > 0 ? JSON.stringify(updatedSuggestedLineItems) : null,
          pendingReplyText: draftReply || null,
          pendingQuoteMessage: acknowledgmentMessage || null,
          activities: { create: [{ type: "NOTE", note }] },
          messages: { create: messageData },
        },
      });

      await prisma.notification.create({
        data: {
          leadId: lead.id,
          type: "NEW_LEAD",
          message: `New lead from WhatsApp: ${data.summary}`,
        },
      });

      if (draftReply) {
        await prisma.notification.create({
          data: {
            leadId: lead.id,
            type: "REPLY_SEND_PENDING",
            message: `A reply to ${lead.name} is drafted and ready to review.`,
          },
        });
      }
    }
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      // externalId collision — Meta re-delivered a message already
      // processed (its own retry, or a duplicate webhook call). No-op.
      return;
    }
    throw err;
  }
}
