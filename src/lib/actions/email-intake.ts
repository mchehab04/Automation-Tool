"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  MAX_LENGTHS,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  parseForgivingNumber,
  guessNameFromEmail,
} from "@/lib/validation";

const DEMO_BUSINESS_ID = "demo-business";
const MODEL = "claude-sonnet-5";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type SimulatedMessage = { role: "customer" | "business"; text: string };

export type EmailIntakeResult =
  | { status: "created"; leadId: string; leadName: string; summary: string; continuedExisting: boolean }
  | { status: "needs_info"; missingFields: string[]; draftReply: string; summary: string }
  | { status: "not_an_enquiry"; summary: string };

const EXTRACT_TOOL = {
  name: "record_enquiry",
  description:
    "Record a structured extraction of a customer's message to an auto dealership/garage.",
  input_schema: {
    type: "object" as const,
    properties: {
      is_enquiry: {
        type: "boolean" as const,
        description:
          "True if this is a genuine sales/service enquiry from a customer, false for spam or irrelevant messages.",
      },
      name: { type: "string" as const, description: "Customer's name, empty string if unknown." },
      email: { type: "string" as const, description: "Customer's email address, empty string if unknown." },
      phone: { type: "string" as const, description: "Customer's phone number, empty string if unknown." },
      company: { type: "string" as const, description: "Customer's company, empty string if not applicable." },
      summary: {
        type: "string" as const,
        description: "One or two sentence summary of what the customer wants.",
      },
      draft_reply: {
        type: "string" as const,
        description:
          "A short, friendly reply asking for whatever contact info is missing. Empty string if name and at least one of email/phone are already present.",
      },
      suggested_line_items: {
        type: "array" as const,
        description:
          "A rough starting point for a quote, based only on what the customer described (e.g. a diagnostic inspection for a described symptom). Empty array if there isn't enough to go on, or if is_enquiry is false. These are drafts a human reviews before any quote is sent — do not try to be precise about pricing.",
        items: {
          type: "object" as const,
          properties: {
            description: { type: "string" as const },
            estimated_price: {
              type: "string" as const,
              description: "Rough estimate in whole USD, digits only, e.g. \"120\".",
            },
          },
          required: ["description", "estimated_price"],
        },
      },
    },
    required: [
      "is_enquiry",
      "name",
      "email",
      "phone",
      "company",
      "summary",
      "draft_reply",
      "suggested_line_items",
    ],
  },
};

type ExtractedEnquiry = {
  is_enquiry: boolean;
  name: string;
  email: string;
  phone: string;
  company: string;
  summary: string;
  draft_reply: string;
  suggested_line_items: { description: string; estimated_price: string }[];
};

export async function processSimulatedEmail(
  conversation: SimulatedMessage[],
): Promise<EmailIntakeResult> {
  const thread = conversation
    .map((m) => `${m.role === "customer" ? "Customer" : "Business"}: ${m.text.trim()}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      "You triage inbound customer messages for an auto dealership/garage's sales pipeline. " +
      "Extract the customer's contact details and what they need. A lead can only be logged " +
      "once you have a name and at least one way to reach them (email or phone) — if the " +
      "thread doesn't have those yet, draft a short, friendly reply asking for whatever is " +
      "missing.",
    messages: [{ role: "user", content: `Message thread:\n\n${thread}` }],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "record_enquiry" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI didn't return a structured result.");
  }

  const data = toolUse.input as ExtractedEnquiry;

  if (!data.is_enquiry) {
    return { status: "not_an_enquiry", summary: data.summary };
  }

  const emailRaw = data.email.trim();
  const phoneRaw = data.phone.trim();
  const email = emailRaw && isValidEmail(emailRaw) ? normalizeEmail(emailRaw) : "";
  const phone = phoneRaw && isValidPhone(phoneRaw) ? normalizePhone(phoneRaw) : "";
  const company = data.company.trim().slice(0, MAX_LENGTHS.company);

  // A returning customer identified by email/phone continues their existing
  // lead instead of spawning a duplicate — and we already know their name.
  let existingLead = email
    ? await prisma.lead.findFirst({ where: { businessId: DEMO_BUSINESS_ID, email } })
    : null;
  if (!existingLead && phone) {
    existingLead = await prisma.lead.findFirst({ where: { businessId: DEMO_BUSINESS_ID, phone } });
  }

  const extractedName = data.name.trim().slice(0, MAX_LENGTHS.name);
  const guessedName = !extractedName && email ? guessNameFromEmail(email) : "";
  const name = extractedName || existingLead?.name || guessedName;

  // Deterministic gate — don't just trust the model's own read of what's missing.
  const missingFields: string[] = [];
  if (!name) missingFields.push("name");
  if (!email && !phone && !existingLead) missingFields.push("email or phone");

  if (missingFields.length > 0) {
    return {
      status: "needs_info",
      missingFields,
      draftReply:
        data.draft_reply.trim() ||
        "Could you share your name and a phone number or email so we can help?",
      summary: data.summary,
    };
  }

  const messagesData = conversation.map((m) => ({
    role: m.role === "customer" ? ("CUSTOMER" as const) : ("BUSINESS" as const),
    text: m.text.slice(0, 2000),
  }));

  if (existingLead) {
    const note = `New message received via email intake (AI triage).\n\n${data.summary}`.slice(
      0,
      MAX_LENGTHS.note,
    );

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: existingLead.id },
        data: { messages: { create: messagesData } },
      }),
      prisma.activity.create({ data: { leadId: existingLead.id, type: "NOTE", note } }),
      prisma.notification.create({
        data: {
          leadId: existingLead.id,
          type: "NEW_MESSAGE",
          message: `New message from ${existingLead.name}: ${data.summary}`,
        },
      }),
    ]);

    revalidatePath("/dashboard");
    revalidatePath("/leads");
    revalidatePath(`/leads/${existingLead.id}`);
    revalidatePath("/", "layout");

    return {
      status: "created",
      leadId: existingLead.id,
      leadName: existingLead.name,
      summary: data.summary,
      continuedExisting: true,
    };
  }

  const nameNote = guessedName
    ? ` Name inferred from their email address (${email}) — confirm with the customer.`
    : "";
  const note = `Auto-created from simulated email intake (AI triage).\n\n${data.summary}${nameNote}`.slice(
    0,
    MAX_LENGTHS.note,
  );

  const suggestedLineItems = data.suggested_line_items
    .map((item) => ({
      description: item.description.trim().slice(0, MAX_LENGTHS.quoteDescription),
      unitPrice: String(Math.max(0, Math.round(parseForgivingNumber(item.estimated_price)))),
    }))
    .filter((item) => item.description.length > 0);

  const lead = await prisma.lead.create({
    data: {
      businessId: DEMO_BUSINESS_ID,
      name,
      email: email || null,
      phone: phone || null,
      company: company || null,
      source: "EMAIL",
      suggestedLineItems: suggestedLineItems.length > 0 ? JSON.stringify(suggestedLineItems) : null,
      activities: { create: [{ type: "NOTE", note }] },
      messages: { create: messagesData },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/leads");

  return {
    status: "created",
    leadId: lead.id,
    leadName: lead.name,
    summary: data.summary,
    continuedExisting: false,
  };
}
