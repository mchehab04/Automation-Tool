import type { ImapFlow } from "imapflow";
import type { Readable } from "stream";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  MAX_LENGTHS,
  isValidPhone,
  normalizePhone,
  guessNameFromEmail,
  isPlaceholderText,
} from "@/lib/validation";
import { extractEnquiry, type CatalogItem } from "@/lib/intake/extract-enquiry";
import {
  findExistingLeadByContact,
  findMostRecentClosedLead,
  buildSuggestedLineItems,
  type SuggestedLineItem,
} from "@/lib/intake/lead-matching";
import { STAGE_LABELS } from "@/lib/pipeline";
import { withImapConnection, type ImapUnavailable } from "@/lib/gmail/imap-client";
import { parseRawMessage } from "@/lib/gmail/parse-message";

const DEMO_BUSINESS_ID = "demo-business";

export type GmailIntakeSummary = {
  processed: number;
  leadsCreated: number;
  leadsContinued: number;
  skippedNotEnquiry: number;
  skippedDuplicate: number;
  errors: number;
};

function emptySummary(): GmailIntakeSummary {
  return {
    processed: 0,
    leadsCreated: 0,
    leadsContinued: 0,
    skippedNotEnquiry: 0,
    skippedDuplicate: 0,
    errors: 0,
  };
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function markSeen(client: ImapFlow, uid: number): Promise<void> {
  await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function processOneMessage(
  client: ImapFlow,
  uid: number,
  summary: GmailIntakeSummary,
): Promise<void> {
  const downloaded = await client.download(String(uid), undefined, { uid: true });
  const raw = await streamToBuffer(downloaded.content);
  const parsed = await parseRawMessage(raw);

  // Can't build a lead without a sender address — nothing useful to do.
  if (!parsed.fromEmail) {
    await markSeen(client, uid);
    return;
  }

  summary.processed++;
  const email = parsed.fromEmail;

  // Known from the header before any AI call, unlike phone (which only ever
  // comes from the message body) — so the lookup can happen up front and its
  // history/existing suggestions can be given to the model as context.
  const [existingLead, catalogItemsRaw] = await Promise.all([
    findExistingLeadByContact(DEMO_BUSINESS_ID, { email }),
    prisma.serviceCatalogItem.findMany({ where: { businessId: DEMO_BUSINESS_ID } }),
  ]);
  const priorSuggestions: SuggestedLineItem[] = existingLead?.suggestedLineItems
    ? JSON.parse(existingLead.suggestedLineItems)
    : [];
  // Cents on disk, whole-dollar string at the extractEnquiry prompt boundary
  // — see CatalogItem's doc comment in extract-enquiry.ts.
  const catalogItems: CatalogItem[] = catalogItemsRaw.map((item) => ({
    description: item.description,
    unitPrice: String(Math.round(item.unitPrice / 100)),
  }));

  // Full prior conversation, not just the latest message — otherwise a reply
  // like "yes that works for me" has nothing for the model to resolve
  // "that" against. Business-side messages are only present here if they
  // were actually sent via sendPendingReply (see reply.ts); the simulator's
  // own approve-flow never touches this lead's Message history in real
  // intake's case, so there's nothing else to miss.
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
    ? `${priorThreadText}\n\nCustomer: ${parsed.text}`
    : `Subject: ${parsed.subject}\n\nCustomer: ${parsed.text}`;
  const data = await extractEnquiry(threadText, "real", priorSuggestions, catalogItems);

  if (!data.is_enquiry) {
    summary.skippedNotEnquiry++;
    await markSeen(client, uid);
    return;
  }

  // Only relevant when there's no open lead to continue — a returning
  // customer whose prior engagement already closed gets a fresh lead
  // (see findExistingLeadByContact), linked back to this one for history.
  const closedLead = existingLead
    ? null
    : await findMostRecentClosedLead(DEMO_BUSINESS_ID, { email });

  const phoneRaw = data.phone.trim();
  const phone = phoneRaw && isValidPhone(phoneRaw) ? normalizePhone(phoneRaw) : "";
  const companyRaw = data.company.trim();
  const company =
    companyRaw && !isPlaceholderText(companyRaw)
      ? companyRaw.slice(0, MAX_LENGTHS.company)
      : closedLead?.company || "";

  // Real headers give a stronger fallback chain than the simulator ever has —
  // an AI-missed name still has the account's own display name to fall back
  // on before resorting to guessing from the address or a bare placeholder.
  const nameRaw = data.name.trim();
  const extractedName = !isPlaceholderText(nameRaw) ? nameRaw.slice(0, MAX_LENGTHS.name) : "";
  const headerName = parsed.fromName?.trim().slice(0, MAX_LENGTHS.name) || "";
  const guessedName = guessNameFromEmail(email);

  let name: string;
  let nameNote = "";
  if (extractedName) {
    name = extractedName;
  } else if (existingLead?.name) {
    name = existingLead.name;
  } else if (closedLead?.name) {
    name = closedLead.name;
    nameNote = ` Name and company carried over from a previous (closed) lead — confirm still current.`;
  } else if (headerName) {
    name = headerName;
    nameNote = ` Name taken from the email's display name (${email}) — confirm with the customer.`;
  } else if (guessedName) {
    name = guessedName;
    nameNote = ` Name inferred from their email address (${email}) — confirm with the customer.`;
  } else {
    name = `New enquiry (${email})`;
    nameNote = ` Name unknown — confirm with the customer.`;
  }

  const draftReply = data.draft_reply.trim();
  const clarifyingNote = draftReply ? ` A clarifying question worth asking: "${draftReply}"` : "";
  const acknowledgmentMessage = data.acknowledgment_message.trim();

  // See email-intake.ts's simulated path for the same pattern — not required
  // to log a lead, just captured when mentioned so the QUALIFIED dialog has
  // something to pre-fill.
  const vehicleMake = data.vehicle_make.trim().slice(0, MAX_LENGTHS.vehicleField) || closedLead?.vehicleMake || "";
  const vehicleModel = data.vehicle_model.trim().slice(0, MAX_LENGTHS.vehicleField) || closedLead?.vehicleModel || "";
  const vehicleYear = data.vehicle_year.trim().slice(0, MAX_LENGTHS.vehicleYear) || closedLead?.vehicleYear || "";

  // The model was given whatever was already drafted and asked to return the
  // full corrected picture, not just an addition — so this replaces rather
  // than merges, which is what actually fixes a follow-up that clarifies
  // (not just adds to) an earlier vague item.
  const updatedSuggestedLineItems = buildSuggestedLineItems(data.suggested_line_items);
  const messageData = {
    role: "CUSTOMER" as const,
    text: parsed.text.slice(0, 2000),
    externalId: parsed.messageId,
  };

  try {
    if (existingLead) {
      const note = `New message received via Gmail intake (AI triage).\n\n${data.summary}${clarifyingNote}`.slice(
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
            // Replaced, not merged — a reply is one current draft, not a list.
            pendingReplyText: draftReply || undefined,
            pendingQuoteMessage: acknowledgmentMessage || undefined,
            // Fill gaps only — never overwrite a value staff may have
            // already confirmed via the QUALIFIED dialog.
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

      summary.leadsContinued++;
    } else {
      const closedLeadNote = closedLead
        ? ` This customer has a previous lead that closed as ${STAGE_LABELS[closedLead.stage]} — linked as history.`
        : "";
      const note = `Auto-created from Gmail intake (AI triage).\n\n${data.summary}${nameNote}${clarifyingNote}${closedLeadNote}`.slice(
        0,
        MAX_LENGTHS.note,
      );

      const lead = await prisma.lead.create({
        data: {
          businessId: DEMO_BUSINESS_ID,
          name,
          email,
          phone: phone || null,
          company: company || null,
          source: "EMAIL",
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
          message: `New lead from Gmail: ${data.summary}`,
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

      summary.leadsCreated++;
    }
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      // externalId collision — this exact message was already processed by
      // an earlier (possibly interrupted) run. Nothing to write, just move on.
      summary.skippedDuplicate++;
    } else {
      throw err;
    }
  }

  await markSeen(client, uid);
}

export async function runGmailIntake(): Promise<GmailIntakeSummary | ImapUnavailable> {
  return withImapConnection(async (client) => {
    const summary = emptySummary();

    await client.mailboxOpen("INBOX");
    const uids = await client.search({ seen: false }, { uid: true });
    if (!uids || uids.length === 0) return summary;

    for (const uid of uids) {
      try {
        await processOneMessage(client, uid, summary);
      } catch (err) {
        // Genuine failure (LLM/DB error unrelated to the dup check) — leave
        // unseen so the next run retries it, fail-open rather than losing it.
        console.error("Gmail intake: failed to process message", uid, err);
        summary.errors++;
      }
    }

    return summary;
  });
}
