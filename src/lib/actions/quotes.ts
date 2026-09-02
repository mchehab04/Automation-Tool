"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { MAX_LENGTHS, parseForgivingNumber } from "@/lib/validation";
import type { QuoteLineItem } from "@/lib/pdf/quote-document";
import { formatQuoteNumber } from "@/lib/quote-number";
import { renderQuotePdf } from "@/lib/pdf/render-quote";
import { sendLeadEmail } from "@/lib/email/send";

export async function createQuote(leadId: string, formData: FormData) {
  const descriptions = formData.getAll("description").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const unitPrices = formData.getAll("unitPrice").map(String);

  const lineItems: QuoteLineItem[] = descriptions
    .map((description, i) => ({
      description: description.trim().slice(0, MAX_LENGTHS.quoteDescription),
      quantity: Math.max(1, Math.round(parseForgivingNumber(quantities[i] ?? "1") || 1)),
      unitPrice: Math.max(0, Math.round(parseForgivingNumber(unitPrices[i] ?? "0") * 100)), // dollars -> cents
    }))
    .filter((item) => item.description.length > 0);

  if (lineItems.length === 0) {
    throw new Error("A quote needs at least one line item.");
  }

  const notes = String(formData.get("notes") ?? "").trim().slice(0, MAX_LENGTHS.quoteNotes);

  const totalAmount = lineItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  const lastQuote = await prisma.quote.findFirst({
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const number = (lastQuote?.number ?? 0) + 1;

  const quote = await prisma.quote.create({
    data: {
      leadId,
      number,
      lineItems: JSON.stringify(lineItems),
      notes: notes || null,
      totalAmount,
      currency: "USD",
    },
  });

  // The AI-suggested draft (if any) has now been acted on — clear it so it
  // doesn't linger on the form for a future quote. A later message can still
  // populate a fresh one.
  await prisma.lead.update({ where: { id: leadId }, data: { suggestedLineItems: null } });

  await prisma.activity.create({
    data: {
      leadId,
      type: "QUOTE_GENERATED",
      note: `Quote generated for ${(totalAmount / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      })}.`,
    },
  });

  await prisma.notification.create({
    data: {
      leadId,
      quoteId: quote.id,
      type: "QUOTE_SEND_PENDING",
      message: `Quote #${formatQuoteNumber(number)} is ready to send to the customer.`,
    },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/", "layout");
  redirect(`/leads/${leadId}?quote=${quote.id}`);
}

// Returns { error } for expected failures instead of throwing — see
// reply.ts's sendPendingReply for why (Next.js redacts thrown Server Action
// error messages in production).
export async function sendQuoteToCustomer(quoteId: string, message: string): Promise<{ error: string } | undefined> {
  const trimmed = message.trim();
  if (!trimmed) {
    return { error: "Message can't be empty." };
  }

  const quote = await prisma.quote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { lead: { include: { business: true } } },
  });

  if (!quote.lead.email) {
    return { error: "This lead doesn't have an email address on file to send the quote to." };
  }

  const number = formatQuoteNumber(quote.number ?? 0);
  const { buffer, filename } = await renderQuotePdf(quoteId);

  let note: string;
  try {
    ({ note } = await sendLeadEmail(quote.leadId, {
      to: quote.lead.email,
      fromName: quote.lead.business.name,
      subject: `Your quote from ${quote.lead.business.name} — #${number}`,
      text: trimmed,
      attachment: { filename, content: buffer, contentType: "application/pdf" },
      label: `Quote #${number}`,
    }));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send the quote." };
  }

  // A sent quote is the real-world event the "Quote Sent" stage represents —
  // fast-forward it automatically rather than making staff remember to also
  // flip the stage dropdown. Only from earlier stages: never rewinds a lead
  // that's already past this point (Scheduled/Won/Lost), and never fires on
  // a resend of a later quote once the lead has moved on.
  const shouldAdvanceStage = quote.lead.stage === "NEW" || quote.lead.stage === "QUALIFIED";

  await prisma.$transaction([
    prisma.quote.update({ where: { id: quote.id }, data: { sentAt: new Date() } }),
    prisma.activity.create({ data: { leadId: quote.leadId, type: "NOTE", note } }),
    prisma.lead.update({
      where: { id: quote.leadId },
      data: {
        pendingQuoteMessage: null,
        ...(shouldAdvanceStage ? { stage: "QUOTE_SENT" as const } : {}),
      },
    }),
    ...(shouldAdvanceStage
      ? [
          prisma.activity.create({
            data: {
              leadId: quote.leadId,
              type: "STAGE_CHANGE" as const,
              fromStage: quote.lead.stage,
              toStage: "QUOTE_SENT" as const,
              note: "Auto-advanced to Quote Sent — a quote was sent to the customer.",
            },
          }),
        ]
      : []),
    prisma.notification.updateMany({
      where: { quoteId: quote.id, read: false },
      data: { read: true },
    }),
  ]);

  revalidatePath(`/leads/${quote.leadId}`);
  if (shouldAdvanceStage) {
    revalidatePath("/dashboard");
    revalidatePath("/leads");
  }
  revalidatePath("/", "layout");
}
