import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { QuoteDocument, type QuoteLineItem } from "@/lib/pdf/quote-document";

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

  const buffer = await renderToBuffer(
    createElement(QuoteDocument, {
      quoteId: quote.id,
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

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="quote-${quote.id.slice(-8)}.pdf"`,
    },
  });
}
