"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { MAX_LENGTHS, parseForgivingNumber } from "@/lib/validation";
import type { InvoiceLineItem } from "@/lib/pdf/invoice-document";
import { formatInvoiceNumber } from "@/lib/quote-number";
import { renderInvoicePdf } from "@/lib/pdf/render-invoice";
import { sendLeadEmail } from "@/lib/email/send";

export async function createInvoice(leadId: string, formData: FormData) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  // Server-side gate, not just the UI hiding the form — mirrors this app's
  // established "server actions are the last line of defense" pattern.
  if (lead.stage !== "WON") {
    throw new Error("Invoices can only be generated once a lead is Won.");
  }

  const descriptions = formData.getAll("description").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const unitPrices = formData.getAll("unitPrice").map(String);

  const lineItems: InvoiceLineItem[] = descriptions
    .map((description, i) => ({
      description: description.trim().slice(0, MAX_LENGTHS.quoteDescription),
      quantity: Math.max(1, Math.round(parseForgivingNumber(quantities[i] ?? "1") || 1)),
      unitPrice: Math.max(0, Math.round(parseForgivingNumber(unitPrices[i] ?? "0") * 100)), // dollars -> cents
    }))
    .filter((item) => item.description.length > 0);

  if (lineItems.length === 0) {
    throw new Error("An invoice needs at least one line item.");
  }

  const notes = String(formData.get("notes") ?? "").trim().slice(0, MAX_LENGTHS.quoteNotes);

  const totalAmount = lineItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  const lastInvoice = await prisma.invoice.findFirst({
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const number = (lastInvoice?.number ?? 0) + 1;

  const invoice = await prisma.invoice.create({
    data: {
      leadId,
      number,
      lineItems: JSON.stringify(lineItems),
      notes: notes || null,
      totalAmount,
      currency: "USD",
    },
  });

  await prisma.activity.create({
    data: {
      leadId,
      type: "INVOICE_GENERATED",
      note: `Invoice generated for ${(totalAmount / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      })}.`,
    },
  });

  await prisma.notification.create({
    data: {
      leadId,
      invoiceId: invoice.id,
      type: "INVOICE_SEND_PENDING",
      message: `Invoice #${formatInvoiceNumber(number)} is ready to send to the customer.`,
    },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/", "layout");
  redirect(`/leads/${leadId}?invoice=${invoice.id}`);
}

// Returns { error } for expected failures instead of throwing — see
// reply.ts's sendPendingReply for why (Next.js redacts thrown Server Action
// error messages in production).
export async function sendInvoiceToCustomer(invoiceId: string, message: string): Promise<{ error: string } | undefined> {
  const trimmed = message.trim();
  if (!trimmed) {
    return { error: "Message can't be empty." };
  }

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { lead: { include: { business: true } } },
  });

  if (!invoice.lead.email) {
    return { error: "This lead doesn't have an email address on file to send the invoice to." };
  }

  const number = formatInvoiceNumber(invoice.number ?? 0);
  const { buffer, filename } = await renderInvoicePdf(invoiceId);

  let note: string;
  try {
    ({ note } = await sendLeadEmail(invoice.leadId, {
      to: invoice.lead.email,
      fromName: invoice.lead.business.name,
      subject: `Your invoice from ${invoice.lead.business.name} — #${number}`,
      text: trimmed,
      attachment: { filename, content: buffer, contentType: "application/pdf" },
      label: `Invoice #${number}`,
    }));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send the invoice." };
  }

  await prisma.$transaction([
    prisma.invoice.update({ where: { id: invoice.id }, data: { sentAt: new Date() } }),
    prisma.activity.create({ data: { leadId: invoice.leadId, type: "NOTE", note } }),
    prisma.notification.updateMany({
      where: { invoiceId: invoice.id, read: false },
      data: { read: true },
    }),
  ]);

  revalidatePath(`/leads/${invoice.leadId}`);
  revalidatePath("/", "layout");
}

export async function toggleInvoicePaid(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paidAt: invoice.paidAt ? null : new Date() },
  });

  revalidatePath(`/leads/${invoice.leadId}`);
}
