"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleInvoicePaid } from "@/lib/actions/invoices";

export function InvoicePaidToggle({ invoiceId, paid }: { invoiceId: string; paid: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="self-start"
      disabled={isPending}
      onClick={() => startTransition(() => toggleInvoicePaid(invoiceId))}
    >
      {paid ? "Mark as unpaid" : "Mark as paid"}
    </Button>
  );
}
