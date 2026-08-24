"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { MAX_LENGTHS, parseForgivingNumber } from "@/lib/validation";
import type { QuoteLineItem } from "@/lib/pdf/quote-document";

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

  const quote = await prisma.quote.create({
    data: {
      leadId,
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

  revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}?quote=${quote.id}`);
}
