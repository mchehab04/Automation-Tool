"use client";

import { useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendQuoteToCustomer } from "@/lib/actions/quotes";

export function SendQuoteButton({ quoteId }: { quoteId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          void sendQuoteToCustomer(quoteId);
        })
      }
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      Send to customer
    </Button>
  );
}
