import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dashboard } from "@/components/dashboard";
import type { Stat } from "@/components/stats";
import type { LeadsVolumeRow } from "@/components/leads-volume-chart";
import type { SourceDatum } from "@/components/leads-by-source-chart";
import { prisma } from "@/lib/db";
import { PIPELINE_STAGES, LEAD_SOURCE_LABELS } from "@/lib/pipeline";
import type { PipelineStage } from "@/generated/prisma/enums";

const DEMO_BUSINESS_ID = "demo-business";
const VOLUME_DAYS = 60;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

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

async function getLeadsVolume(): Promise<LeadsVolumeRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - (VOLUME_DAYS - 1));
  since.setHours(0, 0, 0, 0);

  const leads = await prisma.lead.findMany({
    where: { businessId: DEMO_BUSINESS_ID, createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < VOLUME_DAYS; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets.set(toIsoDate(d), 0);
  }

  for (const lead of leads) {
    const key = toIsoDate(lead.createdAt);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets, ([date, leads]) => ({ date, leads }));
}

async function getLeadsBySource(): Promise<SourceDatum[]> {
  const grouped = await prisma.lead.groupBy({
    by: ["source"],
    where: { businessId: DEMO_BUSINESS_ID },
    _count: { _all: true },
  });

  return grouped
    .map((row) => ({
      source: row.source,
      label: LEAD_SOURCE_LABELS[row.source],
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}

async function getRecentLeads() {
  return prisma.lead.findMany({
    where: { businessId: DEMO_BUSINESS_ID },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

async function getNewLeadsDelta(): Promise<{ thisWeek: number; deltaPct: number | null }> {
  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const [thisWeek, priorWeek] = await Promise.all([
    prisma.lead.count({
      where: { businessId: DEMO_BUSINESS_ID, createdAt: { gte: oneWeekAgo } },
    }),
    prisma.lead.count({
      where: { businessId: DEMO_BUSINESS_ID, createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } },
    }),
  ]);

  const deltaPct = priorWeek > 0 ? ((thisWeek - priorWeek) / priorWeek) * 100 : null;
  return { thisWeek, deltaPct };
}

export default async function DashboardPage() {
  const [stageCounts, leadsVolume, leadsBySource, recentLeads, newLeads] = await Promise.all([
    getStageCounts(),
    getLeadsVolume(),
    getLeadsBySource(),
    getRecentLeads(),
    getNewLeadsDelta(),
  ]);

  const totalLeads = PIPELINE_STAGES.reduce((sum, stage) => sum + stageCounts[stage], 0);
  const activeLeads =
    stageCounts.NEW + stageCounts.QUALIFIED + stageCounts.QUOTE_SENT + stageCounts.SCHEDULED;
  const winRate =
    stageCounts.WON + stageCounts.LOST > 0
      ? Math.round((stageCounts.WON / (stageCounts.WON + stageCounts.LOST)) * 100)
      : null;

  const stats: Stat[] = [
    { label: "Total leads", value: String(totalLeads), footnote: "all time" },
    { label: "Active in pipeline", value: String(activeLeads), footnote: "not yet closed" },
    {
      label: "Win rate",
      value: winRate === null ? "—" : `${winRate}%`,
      footnote: "of closed leads",
    },
    {
      label: "New this week",
      value: String(newLeads.thisWeek),
      footnote: "vs prior week",
      delta: newLeads.deltaPct ?? undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="relative flex h-40 items-end overflow-hidden rounded-xl border p-6 sm:h-48">
        <Image
          src="/dashboard-banner.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="relative flex w-full items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
            <p className="text-sm text-white/80">Your pipeline at a glance — intake through quote.</p>
          </div>
          <Button render={<Link href="/leads/new" />} nativeButton={false}>
            Add lead
          </Button>
        </div>
      </div>

      <Dashboard
        stats={stats}
        stageCounts={stageCounts}
        leadsVolume={leadsVolume}
        leadsBySource={leadsBySource}
        recentLeads={recentLeads}
      />
    </div>
  );
}
