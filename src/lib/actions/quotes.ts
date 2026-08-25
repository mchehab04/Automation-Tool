"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { MAX_LENGTHS, parseForgivingNumber } from "@/lib/validation";
import type { QuoteLineItem } from "@/lib/pdf/quote-document";
import { formatQuoteNumber } from "@/lib/quote-number";
import { sendEmail } from "@/lib/email/send";

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
      totalAmount,
      currency: "USD",
    },
  });

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

export async function sendQuoteToCustomer(quoteId: string) {
  const quote = await prisma.quote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { lead: true },
  });

  if (!quote.lead.email) {
    throw new Error("This lead doesn't have an email address on file to send the quote to.");
  }

  const number = formatQuoteNumber(quote.number ?? 0);
  const result = await sendEmail({
    to: quote.lead.email,
    subject: `Your quote — #${number}`,
    text: `Hi ${quote.lead.name}, please find your quote #${number} attached.`,
  });

  await prisma.$transaction([
    prisma.quote.update({ where: { id: quote.id }, data: { sentAt: new Date() } }),
    prisma.activity.create({
      data: {
        leadId: quote.leadId,
        type: "NOTE",
        note: result.delivered
          ? `Quote #${number} emailed to ${quote.lead.email}.`
          : `Quote #${number} approved to send to ${quote.lead.email} — no email provider is configured yet, so this wasn't actually delivered.`,
      },
    }),
    prisma.notification.updateMany({
      where: { quoteId: quote.id, read: false },
      data: { read: true },
    }),
  ]);

  revalidatePath(`/leads/${quote.leadId}`);
  revalidatePath("/", "layout");
}
