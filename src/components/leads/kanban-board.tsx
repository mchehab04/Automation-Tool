import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StageSelect } from "@/components/leads/stage-select";
import { PIPELINE_STAGES, STAGE_LABELS, LEAD_SOURCE_LABELS } from "@/lib/pipeline";
import type { Lead } from "@/generated/prisma/client";

export function KanbanBoard({ leads }: { leads: Lead[] }) {
  const columns = PIPELINE_STAGES.map((stage) => ({
    stage,
    leads: leads.filter((lead) => lead.stage === stage),
  }));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {columns.map(({ stage, leads: stageLeads }) => (
        <div key={stage} className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">{STAGE_LABELS[stage]}</h2>
            <Badge variant="secondary">{stageLeads.length}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {stageLeads.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                No leads
              </p>
            ) : (
              stageLeads.map((lead) => (
                <Card key={lead.id} className="gap-2 py-3">
                  <CardHeader className="px-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/leads/${lead.id}`} className="text-sm font-medium hover:underline">
                        {lead.name}
                      </Link>
                      {lead.source !== "MANUAL" ? (
                        <Badge variant="outline" className="shrink-0">
                          {LEAD_SOURCE_LABELS[lead.source]}
                        </Badge>
                      ) : null}
                    </div>
                    {lead.company ? (
                      <p className="text-xs text-muted-foreground">{lead.company}</p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="px-3">
                    <StageSelect leadId={lead.id} stage={lead.stage} />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
