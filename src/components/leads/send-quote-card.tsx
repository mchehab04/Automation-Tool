"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { sendQuoteToCustomer } from "@/lib/actions/quotes";

// Sits inline inside a quote's list item on the lead detail page (not a
// top-level Card like PendingReplyCard — that would double up on the
// surrounding Quotes card). Same "review and edit before send" pattern.
export function SendQuoteCard({ quoteId, initialMessage }: { quoteId: string; initialMessage: string }) {
  const [text, setText] = useState(initialMessage);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    setError(null);
    startTransition(async () => {
      try {
        await sendQuoteToCustomer(quoteId, text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send the quote.");
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} className="text-sm" />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button size="sm" disabled={isPending || !text.trim()} onClick={send}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Send to customer
      </Button>
    </div>
  );
}
