import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { QuoteDocument, formatQuoteNumber, type QuoteLineItem } from "@/lib/pdf/quote-document";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "client"
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { lead: { include: { business: true } } },
  });

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const lineItems = JSON.parse(quote.lineItems) as QuoteLineItem[];
  const quoteNumber = quote.number ?? 0;

  const buffer = await renderToBuffer(
    createElement(QuoteDocument, {
      quoteNumber,
      businessName: quote.lead.business.name,
      lead: {
        name: quote.lead.name,
        email: quote.lead.email,
        company: quote.lead.company,
      },
      lineItems,
      totalAmount: quote.totalAmount,
      currency: quote.currency,
      generatedAt: quote.generatedAt,
    }) as unknown as ReactElement<DocumentProps>,
  );

  const filename = `${slugify(quote.lead.name)}-quotation-${formatQuoteNumber(quoteNumber)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
