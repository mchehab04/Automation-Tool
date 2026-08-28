"use server";

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { STAGE_LABELS, getReasonLabel } from "@/lib/pipeline";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";

const MODEL = "claude-sonnet-5";
const MAX_REPORT_LENGTH = 2000;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Called when a lead closes (Won/Lost) — writes a factual close-out summary
// as a REPORT activity, using only what's actually on record for the lead
// (messages, notes, quotes), so it stays traceable back to its sources.
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
    max_tokens: 500,
    system:
      "You write short close-out reports for an auto dealership/garage's sales pipeline, " +
      "summarizing what happened with a lead from first contact to close. Be factual and " +
      "concise (3-5 sentences). Only use what's in the source material below — never invent " +
      "details that aren't there.",
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
          `Write the close-out report.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const reportText = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
  if (!reportText) return;

  await prisma.activity.create({
    data: {
      leadId,
      type: "REPORT",
      note: reportText.slice(0, MAX_REPORT_LENGTH),
    },
  });
}
