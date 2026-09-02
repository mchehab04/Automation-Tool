import { NextResponse } from "next/server";
import { renderInvoicePdf } from "@/lib/pdf/render-invoice";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { buffer, filename } = await renderInvoicePdf(id).catch(() => ({
    buffer: null,
    filename: null,
  }));

  if (!buffer) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
