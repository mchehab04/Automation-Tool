"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  MAX_LENGTHS,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
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

const DEMO_BUSINESS_ID = "demo-business";

export type SimulatedMessage = { role: "customer" | "business"; text: string };

export type EmailIntakeResult =
  | { status: "created"; leadId: string; leadName: string; summary: string; continuedExisting: boolean }
  | { status: "needs_info"; missingFields: string[]; draftReply: string; summary: string }
  | { status: "not_an_enquiry"; summary: string };

export async function processSimulatedEmail(
  conversation: SimulatedMessage[],
): Promise<EmailIntakeResult> {
  const thread = conversation
    .map((m) => `${m.role === "customer" ? "Customer" : "Business"}: ${m.text.trim()}`)
    .join("\n\n");

  const data = await extractEnquiry(thread, "simulated");

  if (!data.is_enquiry) {
    return { status: "not_an_enquiry", summary: data.summary };
  }

  const emailRaw = data.email.trim();
  const phoneRaw = data.phone.trim();
  const email = emailRaw && isValidEmail(emailRaw) ? normalizeEmail(emailRaw) : "";
  const phone = phoneRaw && isValidPhone(phoneRaw) ? normalizePhone(phoneRaw) : "";
  const companyRaw = data.company.trim();
  const company = !isPlaceholderText(companyRaw) ? companyRaw.slice(0, MAX_LENGTHS.company) : "";

  const existingLead = await findExistingLeadByContact(DEMO_BUSINESS_ID, { email, phone });

  const nameRaw = data.name.trim();
  const extractedName = !isPlaceholderText(nameRaw) ? nameRaw.slice(0, MAX_LENGTHS.name) : "";
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

  const newSuggestedLineItems = buildSuggestedLineItems(data.suggested_line_items);

  if (existingLead) {
    const note = `New message received via email intake (AI triage).\n\n${data.summary}`.slice(
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
          messages: { create: messagesData },
          suggestedLineItems: mergedSuggestions.length > 0 ? JSON.stringify(mergedSuggestions) : undefined,
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

  const lead = await prisma.lead.create({
    data: {
      businessId: DEMO_BUSINESS_ID,
      name,
      email: email || null,
      phone: phone || null,
      company: company || null,
      source: "EMAIL",
      suggestedLineItems: newSuggestedLineItems.length > 0 ? JSON.stringify(newSuggestedLineItems) : null,
      activities: { create: [{ type: "NOTE", note }] },
      messages: { create: messagesData },
    },
  });

  await prisma.notification.create({
    data: {
      leadId: lead.id,
      type: "NEW_LEAD",
      message: `New lead from simulated email intake: ${data.summary}`,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/", "layout");

  return {
    status: "created",
    leadId: lead.id,
    leadName: lead.name,
    summary: data.summary,
    continuedExisting: false,
  };
}
