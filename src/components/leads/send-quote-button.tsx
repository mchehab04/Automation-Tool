"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendQuoteToCustomer } from "@/lib/actions/quotes";

export function SendQuoteButton({ quoteId }: { quoteId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    setError(null);
    startTransition(async () => {
      try {
        await sendQuoteToCustomer(quoteId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send the quote.");
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" disabled={isPending} onClick={send}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Send to customer
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
