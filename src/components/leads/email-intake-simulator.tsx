"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail, Sparkles, CheckCircle2, RotateCcw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  processSimulatedEmail,
  type SimulatedMessage,
  type EmailIntakeResult,
} from "@/lib/actions/email-intake";

const EXAMPLES = {
  complete:
    "Hi, this is Sarah Kim (555-201-4488). My 2019 Honda Civic's check engine light " +
    "came on and it's making a rattling noise under the hood. Could someone take a " +
    "look this week?",
  missingInfo:
    "Hey, my car's making a weird grinding noise when I brake — can someone check it " +
    "out? Not sure how much this kind of thing usually costs.",
};

type PendingReply = { draftReply: string; missingFields: string[]; summary: string };

export function EmailIntakeSimulator() {
  const [conversation, setConversation] = useState<SimulatedMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingReply, setPendingReply] = useState<PendingReply | null>(null);
  const [replyEdit, setReplyEdit] = useState("");
  const [result, setResult] = useState<EmailIntakeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFresh = conversation.length === 0 && !pendingReply && !result;

  const reset = () => {
    setConversation([]);
    setDraft("");
    setPendingReply(null);
    setReplyEdit("");
    setResult(null);
    setError(null);
  };

  const sendCustomerMessage = async () => {
    const text = draft.trim();
    if (!text) return;

    setError(null);
    setLoading(true);
    const nextConversation: SimulatedMessage[] = [...conversation, { role: "customer", text }];

    try {
      const response = await processSimulatedEmail(nextConversation);
      setConversation(nextConversation);
      setDraft("");

      if (response.status === "needs_info") {
        setPendingReply({
          draftReply: response.draftReply,
          missingFields: response.missingFields,
          summary: response.summary,
        });
        setReplyEdit(response.draftReply);
      } else {
        setResult(response);
      }
    } catch {
      setError("Something went wrong calling the AI. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const approveAndSend = () => {
    if (!pendingReply) return;
    setConversation((c) => [...c, { role: "business", text: replyEdit.trim() }]);
    setPendingReply(null);
    setReplyEdit("");
  };

  return (
    <div className="flex flex-col gap-4">
      {conversation.length > 0 ? (
        <ul className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
          {conversation.map((entry, i) => (
            <li
              key={i}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                entry.role === "customer"
                  ? "self-start bg-background border"
                  : "self-end bg-primary text-primary-foreground"
              }`}
            >
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide opacity-70">
                {entry.role === "customer" ? "Customer" : "Business (AI draft, approved)"}
              </p>
              {entry.text}
            </li>
          ))}
        </ul>
      ) : null}

      {result ? (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          {result.status === "created" ? (
            <>
              <p className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-4 text-status-good" />
                {result.continuedExisting
                  ? "Added to an existing lead — this customer already had one"
                  : "Lead created from simulated email intake"}
              </p>
              <p className="text-sm text-muted-foreground">{result.summary}</p>
              <Button render={<Link href={`/leads/${result.leadId}`} />} nativeButton={false} className="self-start">
                View {result.leadName}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Not logged as a lead</p>
              <p className="text-sm text-muted-foreground">
                The AI didn&apos;t read this as a genuine enquiry: {result.summary}
              </p>
            </>
          )}
          <Button variant="outline" size="sm" className="self-start" onClick={reset}>
            <RotateCcw className="size-4" /> Start another simulation
          </Button>
        </div>
      ) : pendingReply ? (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4" />
            AI drafted a reply — missing: {pendingReply.missingFields.join(", ")}
          </p>
          <Textarea
            value={replyEdit}
            onChange={(e) => setReplyEdit(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">
            Edit if needed, then approve to simulate sending it and continue the thread.
          </p>
          <Button size="sm" className="self-start" onClick={approveAndSend} disabled={!replyEdit.trim()}>
            Approve &amp; send
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {isFresh ? (
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="cursor-pointer"
                onClick={() => setDraft(EXAMPLES.complete)}
              >
                Fill: complete info example
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer"
                onClick={() => setDraft(EXAMPLES.missingInfo)}
              >
                Fill: missing info example
              </Badge>
            </div>
          ) : null}
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              isFresh
                ? "Paste or write the customer's message…"
                : "Simulate the customer's reply…"
            }
            rows={3}
            maxLength={1000}
            disabled={loading}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="self-start" onClick={sendCustomerMessage} disabled={loading || !draft.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            {loading ? "Reading with AI…" : "Send message"}
          </Button>
        </div>
      )}
    </div>
  );
}
