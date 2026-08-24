import { LeadsBySourceChart, type SourceDatum } from "@/components/leads-by-source-chart";
import { LeadsVolumeChart, type LeadsVolumeRow } from "@/components/leads-volume-chart";
import { PipelineFunnelCard } from "@/components/pipeline-funnel-card";
import { RecentLeadsTable, type RecentLeadRow } from "@/components/recent-leads-table";
import { DashboardStats, type Stat } from "@/components/stats";
import type { PipelineStage } from "@/generated/prisma/enums";

export function Dashboard({
	stats,
	stageCounts,
	leadsVolume,
	leadsBySource,
	recentLeads,
}: {
	stats: readonly Stat[];
	stageCounts: Record<PipelineStage, number>;
	leadsVolume: LeadsVolumeRow[];
	leadsBySource: SourceDatum[];
	recentLeads: RecentLeadRow[];
}) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<DashboardStats stats={stats} />
			<LeadsVolumeChart data={leadsVolume} />
			<LeadsBySourceChart data={leadsBySource} />
			<PipelineFunnelCard counts={stageCounts} />
			<RecentLeadsTable leads={recentLeads} />
		</div>
	);
}
