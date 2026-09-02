import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { InvoiceDocument, type InvoiceLineItem } from "@/lib/pdf/invoice-document";
import { formatInvoiceNumber } from "@/lib/quote-number";
import { slugify } from "@/lib/pdf/render-quote";

export async function renderInvoicePdf(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { lead: { include: { business: true } } },
  });

  const lineItems = JSON.parse(invoice.lineItems) as InvoiceLineItem[];
  const invoiceNumber = invoice.number ?? 0;

  const buffer = await renderToBuffer(
    createElement(InvoiceDocument, {
      invoiceNumber,
      businessName: invoice.lead.business.name,
      businessAddress: invoice.lead.business.address,
      lead: {
        name: invoice.lead.name,
        email: invoice.lead.email,
        phone: invoice.lead.phone,
        company: invoice.lead.company,
        vehicle: {
          make: invoice.lead.vehicleMake,
          model: invoice.lead.vehicleModel,
          year: invoice.lead.vehicleYear,
        },
      },
      lineItems,
      notes: invoice.notes,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      generatedAt: invoice.generatedAt,
      paid: Boolean(invoice.paidAt),
    }) as unknown as ReactElement<DocumentProps>,
  );

  const filename = `${slugify(invoice.lead.name)}-invoice-${formatInvoiceNumber(invoiceNumber)}.pdf`;

  return { buffer, filename, invoice, invoiceNumber };
}
