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
import { extractEnquiry } from "@/lib/intake/extract-enquiry";
import {
  findExistingLeadByContact,
  buildSuggestedLineItems,
  mergeSuggestedLineItems,
} from "@/lib/intake/lead-matching";
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

  const threadText = `Subject: ${parsed.subject}\n\n${parsed.text}`;
  const data = await extractEnquiry(threadText, "real");

  if (!data.is_enquiry) {
    summary.skippedNotEnquiry++;
    await markSeen(client, uid);
    return;
  }

  const existingLead = await findExistingLeadByContact(DEMO_BUSINESS_ID, { email });

  const phoneRaw = data.phone.trim();
  const phone = phoneRaw && isValidPhone(phoneRaw) ? normalizePhone(phoneRaw) : "";
  const companyRaw = data.company.trim();
  const company = !isPlaceholderText(companyRaw) ? companyRaw.slice(0, MAX_LENGTHS.company) : "";

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

  const newSuggestedLineItems = buildSuggestedLineItems(data.suggested_line_items);
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
      const mergedSuggestions = mergeSuggestedLineItems(
        existingLead.suggestedLineItems,
        newSuggestedLineItems,
      );

      await prisma.$transaction([
        prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            messages: { create: messageData },
            suggestedLineItems: mergedSuggestions.length > 0 ? JSON.stringify(mergedSuggestions) : undefined,
            // Replaced, not merged — a reply is one current draft, not a list.
            pendingReplyText: draftReply || undefined,
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
      const note = `Auto-created from Gmail intake (AI triage).\n\n${data.summary}${nameNote}${clarifyingNote}`.slice(
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
          suggestedLineItems: newSuggestedLineItems.length > 0 ? JSON.stringify(newSuggestedLineItems) : null,
          pendingReplyText: draftReply || null,
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
