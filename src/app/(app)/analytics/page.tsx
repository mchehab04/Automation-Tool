import { DashboardStats, type Stat } from "@/components/stats";
import { ReasonBreakdownCard, type ReasonRow } from "@/components/reason-breakdown-card";
import { prisma } from "@/lib/db";
import { PIPELINE_STAGES, REASON_CODES } from "@/lib/pipeline";
import type { PipelineStage } from "@/generated/prisma/enums";

const DEMO_BUSINESS_ID = "demo-business";

async function getStageCounts(): Promise<Record<PipelineStage, number>> {
  const grouped = await prisma.lead.groupBy({
    by: ["stage"],
    where: { businessId: DEMO_BUSINESS_ID },
    _count: { _all: true },
  });

  const counts = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, 0])) as Record<
    PipelineStage,
    number
  >;
  for (const row of grouped) {
    counts[row.stage] = row._count._all;
  }
  return counts;
}

async function getReasonCounts(stage: "WON" | "LOST"): Promise<ReasonRow[]> {
  const grouped = await prisma.activity.groupBy({
    by: ["reasonCode"],
    where: {
      type: "STAGE_CHANGE",
      toStage: stage,
      lead: { businessId: DEMO_BUSINESS_ID },
    },
    _count: { _all: true },
  });

  const counts = new Map(grouped.map((row) => [row.reasonCode, row._count._all]));

  // Show the full fixed vocabulary, including reasons with zero occurrences
  // so far — a true 0 count, never a fabricated one.
  return (REASON_CODES[stage] ?? []).map((option) => ({
    code: option.code,
    label: option.label,
    count: counts.get(option.code) ?? 0,
  }));
}

export default async function AnalyticsPage() {
  const [stageCounts, wonReasons, lostReasons] = await Promise.all([
    getStageCounts(),
    getReasonCounts("WON"),
    getReasonCounts("LOST"),
  ]);

  const totalLeads = PIPELINE_STAGES.reduce((sum, stage) => sum + stageCounts[stage], 0);
  const closedLeads = stageCounts.WON + stageCounts.LOST;
  const winRate = closedLeads > 0 ? Math.round((stageCounts.WON / closedLeads) * 100) : null;

  const stats: Stat[] = [
    { label: "Total leads", value: String(totalLeads), footnote: "all time" },
    { label: "Leads won", value: String(stageCounts.WON), footnote: "all time" },
    { label: "Leads lost", value: String(stageCounts.LOST), footnote: "all time" },
    {
      label: "Win rate",
      value: winRate === null ? "—" : `${winRate}%`,
      footnote: "of closed leads",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Why leads win or lose, based on the reason captured every time a lead closes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStats stats={stats} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReasonBreakdownCard
          title="Why leads are won"
          description="Reason captured when a lead is marked Won."
          rows={wonReasons}
          accentColor="var(--status-good)"
        />
        <ReasonBreakdownCard
          title="Why leads are lost"
          description="Reason captured when a lead is marked Lost."
          rows={lostReasons}
          accentColor="var(--status-critical)"
        />
      </div>
    </div>
  );
}
