"use client";

import { LineItemsForm, type SeedLineItem } from "@/components/leads/line-items-form";
import { createInvoice } from "@/lib/actions/invoices";

export function InvoiceForm({
  leadId,
  seedLineItems,
}: {
  leadId: string;
  seedLineItems?: SeedLineItem[];
}) {
  const hasSeed = Boolean(seedLineItems && seedLineItems.length > 0);

  return (
    <LineItemsForm
      action={createInvoice.bind(null, leadId)}
      seedLineItems={seedLineItems}
      hint={hasSeed ? "Pre-filled from the latest quote/invoice — review before generating." : undefined}
      submitLabel="Generate invoice"
    />
  );
}
