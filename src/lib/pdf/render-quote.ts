import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { QuoteDocument, type QuoteLineItem } from "@/lib/pdf/quote-document";
import { formatQuoteNumber } from "@/lib/quote-number";

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "client"
  );
}

export async function renderQuotePdf(quoteId: string) {
  const quote = await prisma.quote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { lead: { include: { business: true } } },
  });

  const lineItems = JSON.parse(quote.lineItems) as QuoteLineItem[];
  const quoteNumber = quote.number ?? 0;

  // 14-day validity period from date of generation
  const validUntil = new Date(quote.generatedAt);
  validUntil.setDate(validUntil.getDate() + 14);

  const buffer = await renderToBuffer(
    createElement(QuoteDocument, {
      quoteNumber,
      businessName: quote.lead.business.name,
      businessAddress: quote.lead.business.address,
      lead: {
        name: quote.lead.name,
        email: quote.lead.email,
        phone: quote.lead.phone,
        company: quote.lead.company,
        vehicle: {
          make: quote.lead.vehicleMake,
          model: quote.lead.vehicleModel,
          year: quote.lead.vehicleYear,
        },
      },
      lineItems,
      notes: quote.notes,
      totalAmount: quote.totalAmount,
      currency: quote.currency,
      generatedAt: quote.generatedAt,
      validUntil,
    }) as unknown as ReactElement<DocumentProps>,
  );

  const filename = `${slugify(quote.lead.name)}-quotation-${formatQuoteNumber(quoteNumber)}.pdf`;

  return { buffer, filename, quote, quoteNumber };
}
