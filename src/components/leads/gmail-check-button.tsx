"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkGmailNow, type GmailCheckResult } from "@/lib/actions/gmail-intake";

function summaryText(result: GmailCheckResult): { text: string; isError: boolean } {
  if (result.status === "not_configured") {
    return { text: "GMAIL_USER / GMAIL_APP_PASSWORD aren't set — nothing to check.", isError: true };
  }
  if (result.status === "error") {
    return { text: `Couldn't check Gmail: ${result.message}`, isError: true };
  }
  if (result.processed === 0) {
    return { text: "No new messages.", isError: false };
  }
  const parts = [
    result.leadsCreated ? `${result.leadsCreated} lead${result.leadsCreated === 1 ? "" : "s"} created` : null,
    result.leadsContinued
      ? `${result.leadsContinued} continued on existing lead${result.leadsContinued === 1 ? "" : "s"}`
      : null,
    result.skippedNotEnquiry ? `${result.skippedNotEnquiry} skipped (not an enquiry)` : null,
    result.errors ? `${result.errors} failed (will retry next check)` : null,
  ].filter(Boolean);
  return {
    text: `Checked ${result.processed} new message${result.processed === 1 ? "" : "s"} — ${parts.join(", ")}.`,
    isError: false,
  };
}

export function GmailCheckButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<GmailCheckResult | null>(null);

  const check = () => {
    setResult(null);
    startTransition(async () => {
      setResult(await checkGmailNow());
    });
  };

  const summary = result ? summaryText(result) : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" disabled={isPending} onClick={check}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
        Check Gmail now
      </Button>
      {summary ? (
        <p className={`text-xs ${summary.isError ? "text-destructive" : "text-muted-foreground"}`}>
          {summary.text}
        </p>
      ) : null}
    </div>
  );
}
