import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ArrowLeft, Mail, Phone, Building2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StageSelect } from "@/components/leads/stage-select";
import { QuoteForm, type SuggestedLineItem } from "@/components/leads/quote-form";
import { SendQuoteButton } from "@/components/leads/send-quote-button";
import { PendingReplyCard } from "@/components/leads/pending-reply-card";
import { formatQuoteNumber } from "@/lib/quote-number";
import { NoteForm } from "@/components/leads/note-form";
import { prisma } from "@/lib/db";
import {
  STAGE_LABELS,
  LEAD_SOURCE_LABELS,
  getReasonLabel,
  stageBadgeVariant,
  stageBadgeClassName,
} from "@/lib/pipeline";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      activities: { orderBy: { createdAt: "desc" } },
      quotes: { orderBy: { generatedAt: "desc" } },
      messages: { orderBy: { createdAt: "asc" } },
      previousLead: { select: { id: true, name: true, stage: true } },
      followUpLeads: { select: { id: true, name: true, stage: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!lead) notFound();

  // suggestedLineItems is cleared once acted on (see createQuote), so its
  // mere presence means "pending draft" — no need to also check quote count.
  const suggestedLineItems: SuggestedLineItem[] = lead.suggestedLineItems
    ? (JSON.parse(lead.suggestedLineItems) as SuggestedLineItem[])
    : [];

  const reportActivity = lead.activities.find((a) => a.type === "REPORT");
  const timelineActivities = lead.activities.filter((a) => a.type !== "REPORT");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <Link
          href="/leads"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to leads
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
            {lead.company ? <p className="text-sm text-muted-foreground">{lead.company}</p> : null}
            {lead.previousLead ? (
              <p className="text-sm text-muted-foreground">
                Follow-up to a previous lead —{" "}
                <Link
                  href={`/leads/${lead.previousLead.id}`}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {lead.previousLead.name}
                </Link>{" "}
                ({STAGE_LABELS[lead.previousLead.stage]})
              </p>
            ) : null}
            {lead.followUpLeads.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {lead.followUpLeads.length === 1 ? "1 follow-up lead" : `${lead.followUpLeads.length} follow-up leads`}
                {" — "}
                {lead.followUpLeads.map((followUp, i) => (
                  <span key={followUp.id}>
                    {i > 0 ? ", " : ""}
                    <Link
                      href={`/leads/${followUp.id}`}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      {followUp.name}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {lead.source !== "MANUAL" ? (
              <Badge variant="outline">{LEAD_SOURCE_LABELS[lead.source]}</Badge>
            ) : null}
            <Badge variant={stageBadgeVariant(lead.stage)} className={stageBadgeClassName(lead.stage)}>
              {STAGE_LABELS[lead.stage]}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {lead.email ? (
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" /> {lead.email}
                </div>
              ) : null}
              {lead.phone ? (
                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" /> {lead.phone}
                </div>
              ) : null}
              {lead.company ? (
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" /> {lead.company}
                </div>
              ) : null}
              {!lead.email && !lead.phone && !lead.company ? (
                <p className="text-muted-foreground">No contact details on file.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stage</CardTitle>
              <CardDescription>Move this lead forward or mark it lost.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {lead.scheduledAt ? (
                <p className="text-sm text-muted-foreground">
                  Appointment: {lead.scheduledAt.toLocaleString("en-US")}
                </p>
              ) : null}
              <StageSelect leadId={lead.id} stage={lead.stage} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quotes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {lead.quotes.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {lead.quotes.map((quote) => (
                    <li key={quote.id} className="flex flex-col gap-2 border-b pb-2 text-sm last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span>
                          <span className="text-muted-foreground">
                            #{formatQuoteNumber(quote.number ?? 0)}
                          </span>{" "}
                          {(quote.totalAmount / 100).toLocaleString("en-US", {
                            style: "currency",
                            currency: quote.currency,
                          })}{" "}
                          <span className="text-muted-foreground">
                            — {quote.generatedAt.toLocaleDateString("en-US")}
                          </span>
                        </span>
                        <Button
                          render={<a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer" />}
                          nativeButton={false}
                          variant="outline"
                          size="sm"
                        >
                          <FileText className="size-4" /> PDF
                        </Button>
                      </div>
                      {quote.sentAt ? (
                        <p className="text-xs text-muted-foreground">
                          Sent to customer {quote.sentAt.toLocaleString("en-US")}
                        </p>
                      ) : (
                        <SendQuoteButton quoteId={quote.id} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <QuoteForm leadId={lead.id} suggestedLineItems={suggestedLineItems} />
            </CardContent>
          </Card>

          {lead.messages.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Conversation</CardTitle>
                <CardDescription>Raw thread this lead was created from.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {lead.messages.map((message) => (
                    <li
                      key={message.id}
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        message.role === "CUSTOMER"
                          ? "self-start bg-muted"
                          : "self-end ml-auto bg-primary text-primary-foreground"
                      }`}
                    >
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide opacity-70">
                        {message.role === "CUSTOMER" ? "Customer" : "Business"}
                      </p>
                      {message.text}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          {lead.pendingReplyText ? (
            <PendingReplyCard leadId={lead.id} draft={lead.pendingReplyText} />
          ) : null}

          {reportActivity ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-4" /> Closing report
                </CardTitle>
                <CardDescription>
                  Generated automatically when this lead closed, from its notes,
                  conversation, and quotes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{reportActivity.note}</p>
              </CardContent>
            </Card>
          ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <NoteForm leadId={lead.id} />
            <ul className="flex flex-col gap-3 border-t pt-4">
              {timelineActivities.map((activity) => (
                <li key={activity.id} className="text-sm">
                  <p className="text-xs text-muted-foreground">
                    {activity.createdAt.toLocaleString("en-US")}
                  </p>
                  {activity.type === "STAGE_CHANGE" ? (
                    <p>
                      Moved from{" "}
                      <span className="font-medium">
                        {activity.fromStage ? STAGE_LABELS[activity.fromStage] : "—"}
                      </span>{" "}
                      to{" "}
                      <span className="font-medium">
                        {activity.toStage ? STAGE_LABELS[activity.toStage] : "—"}
                      </span>
                      {activity.reasonCode && activity.toStage ? (
                        <span className="text-muted-foreground">
                          {" "}
                          — {getReasonLabel(activity.toStage, activity.reasonCode)}
                        </span>
                      ) : null}
                      {activity.note ? (
                        <span className="block text-muted-foreground">{activity.note}</span>
                      ) : null}
                    </p>
                  ) : (
                    <p>{activity.note}</p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
