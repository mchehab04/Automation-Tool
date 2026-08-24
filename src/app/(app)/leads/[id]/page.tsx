import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ArrowLeft, Mail, Phone, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StageSelect } from "@/components/leads/stage-select";
import { QuoteForm } from "@/components/leads/quote-form";
import { NoteForm } from "@/components/leads/note-form";
import { prisma } from "@/lib/db";
import { STAGE_LABELS, getReasonLabel, stageBadgeVariant, stageBadgeClassName } from "@/lib/pipeline";

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
    },
  });

  if (!lead) notFound();

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
          </div>
          <Badge variant={stageBadgeVariant(lead.stage)} className={stageBadgeClassName(lead.stage)}>
            {STAGE_LABELS[lead.stage]}
          </Badge>
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
            <CardContent>
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
                    <li key={quote.id} className="flex items-center justify-between text-sm">
                      <span>
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
                    </li>
                  ))}
                </ul>
              )}
              <QuoteForm leadId={lead.id} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <NoteForm leadId={lead.id} />
            <ul className="flex flex-col gap-3 border-t pt-4">
              {lead.activities.map((activity) => (
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
  );
}
