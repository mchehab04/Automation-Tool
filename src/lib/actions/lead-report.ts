"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { STAGE_LABELS, getReasonLabel } from "@/lib/pipeline";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";
import { sendLeadEmail } from "@/lib/email/send";

const MODEL = "claude-sonnet-5";
const MAX_REPORT_LENGTH = 2000;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CLOSING_REPORT_TOOL = {
  name: "record_closing_report",
  description: "Record the structured close-out for a lead that just closed Won or Lost.",
  input_schema: {
    type: "object" as const,
    properties: {
      internal_report: {
        type: "string" as const,
        description:
          "A factual, concise (3-5 sentence) internal close-out summary of what happened with " +
          "this lead from first contact to close, for staff eyes only. Only use what's in the " +
          "source material below — never invent details that aren't there.",
      },
      thank_you_message: {
        type: "string" as const,
        description:
          "Written as the ENTIRE email body of a short (2-4 sentence), warm thank-you to send " +
          "the customer now that this lead has closed — reference the actual deal/service " +
          "discussed (only from the source material), thank them by name. No separate " +
          "greeting/sign-off is appended afterward, so include it here. Tone: appreciative and " +
          "confirming for a Won deal; gracious and door-open-for-the-future for a Lost one — " +
          "never pushy or salesy.",
      },
    },
    required: ["internal_report", "thank_you_message"],
  },
};

// Called when a lead closes (Won/Lost) — writes a factual close-out summary
// as a REPORT activity (staff eyes only), and drafts a customer-facing
// thank-you message for staff to review before sending (see
// sendClosingMessage). Both come from one AI call using only what's
// actually on record for the lead (messages, notes, quotes), so they stay
// traceable back to its sources.
export async function generateClosingReport(
  leadId: string,
  finalStage: "WON" | "LOST",
  reasonCode?: string,
): Promise<void> {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      activities: { orderBy: { createdAt: "asc" } },
      quotes: { orderBy: { generatedAt: "asc" } },
    },
  });

  const transcript = lead.messages
    .map((m) => `${m.role === "CUSTOMER" ? "Customer" : "Business"}: ${m.text}`)
    .join("\n");

  const notes = lead.activities
    .filter((a) => a.note && (a.type === "NOTE" || a.type === "STAGE_CHANGE"))
    .map((a) => `- ${a.note}`)
    .join("\n");

  const quotesText = lead.quotes
    .map(
      (q) =>
        `- ${(q.totalAmount / 100).toLocaleString("en-US", {
          style: "currency",
          currency: q.currency,
        })} on ${q.generatedAt.toDateString()}`,
    )
    .join("\n");

  const reasonLabel = reasonCode ? getReasonLabel(finalStage, reasonCode) : undefined;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system:
      "You write close-out material for an auto dealership/garage's sales pipeline: an " +
      "internal summary for staff, and a short customer-facing thank-you message. Be factual " +
      "and concise. Only use what's in the source material below — never invent details that " +
      "aren't there.",
    messages: [
      {
        role: "user",
        content:
          `Lead: ${lead.name}${lead.company ? ` (${lead.company})` : ""}\n` +
          `Outcome: ${STAGE_LABELS[finalStage]}${reasonLabel ? ` — ${reasonLabel}` : ""}\n` +
          (lead.scheduledAt
            ? `Appointment was scheduled for: ${lead.scheduledAt.toLocaleString("en-US", { timeZone: BUSINESS_TIMEZONE })}\n\n`
            : "\n") +
          `Conversation transcript:\n${transcript || "(none recorded)"}\n\n` +
          `Notes:\n${notes || "(none)"}\n\n` +
          `Quotes given:\n${quotesText || "(none)"}\n\n` +
          `Record the close-out report and thank-you message.`,
      },
    ],
    tools: [CLOSING_REPORT_TOOL],
    tool_choice: { type: "tool", name: "record_closing_report" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return;

  const { internal_report, thank_you_message } = toolUse.input as {
    internal_report: string;
    thank_you_message: string;
  };
  const reportText = internal_report.trim().slice(0, MAX_REPORT_LENGTH);
  const thankYou = thank_you_message.trim();

  await prisma.$transaction([
    ...(reportText
      ? [prisma.activity.create({ data: { leadId, type: "REPORT" as const, note: reportText } })]
      : []),
    prisma.lead.update({ where: { id: leadId }, data: { pendingClosingMessage: thankYou || null } }),
    ...(thankYou
      ? [
          prisma.notification.create({
            data: {
              leadId,
              type: "THANK_YOU_SEND_PENDING" as const,
              message: `A thank-you message for ${lead.name} is drafted and ready to review.`,
            },
          }),
        ]
      : []),
  ]);
}

// Sends the AI-drafted (or staff-edited) thank-you message for a just-closed
// lead. Same review-before-send pattern as sendPendingReply/sendQuoteToCustomer.
// Returns { error } for expected failures instead of throwing — see
// reply.ts's sendPendingReply for why (Next.js redacts thrown Server Action
// error messages in production).
export async function sendClosingMessage(leadId: string, text: string): Promise<{ error: string } | undefined> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { error: "Message can't be empty." };
  }

  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { business: true },
  });

  if (!lead.email) {
    return { error: "This lead doesn't have an email address on file to send to." };
  }

  // WON gets a confirming subject, LOST a softer one — decided by the
  // lead's current stage, which is already WON/LOST by the time staff can
  // send this.
  const subject =
    lead.stage === "WON"
      ? `Thank you for choosing ${lead.business.name}`
      : `Thank you from ${lead.business.name}`;

  let note: string;
  try {
    ({ note } = await sendLeadEmail(leadId, {
      to: lead.email,
      fromName: lead.business.name,
      subject,
      text: trimmed,
      label: "Thank-you message",
    }));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send the thank-you message." };
  }

  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { pendingClosingMessage: null } }),
    prisma.activity.create({ data: { leadId, type: "NOTE", note } }),
    prisma.message.create({ data: { leadId, role: "BUSINESS", text: trimmed } }),
    prisma.notification.updateMany({
      where: { leadId, type: "THANK_YOU_SEND_PENDING", read: false },
      data: { read: true },
    }),
  ]);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/", "layout");
}
