"use client";

import { useState, useTransition } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { sendClosingMessage } from "@/lib/actions/lead-report";

export function ClosingMessageCard({ leadId, draft }: { leadId: string; draft: string }) {
  const [text, setText] = useState(draft);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    setError(null);
    startTransition(async () => {
      try {
        await sendClosingMessage(leadId, text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send the thank-you message.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" /> Thank-you message drafted by AI
        </CardTitle>
        <CardDescription>Review and edit before sending — nothing is sent automatically.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={2000} />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button size="sm" className="self-start" disabled={isPending || !text.trim()} onClick={send}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Accept &amp; send
        </Button>
      </CardContent>
    </Card>
  );
}
