import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { STAGE_LABELS, stageBadgeVariant, stageBadgeClassName } from "@/lib/pipeline";
import type { PipelineStage } from "@/generated/prisma/enums";
import { ArrowRightIcon } from "lucide-react";

export type RecentLeadRow = {
	id: string;
	name: string;
	company: string | null;
	stage: PipelineStage;
	createdAt: Date;
};

function formatRelativeDate(date: Date): string {
	const diffMs = Date.now() - date.getTime();
	const diffMinutes = Math.round(diffMs / 60000);
	if (diffMinutes < 1) return "Just now";
	if (diffMinutes < 60) return `${diffMinutes}m ago`;
	const diffHours = Math.round(diffMinutes / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	const diffDays = Math.round(diffHours / 24);
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function RecentLeadsTable({
	leads,
	className,
	...props
}: ComponentProps<typeof Card> & { leads: RecentLeadRow[] }) {
	return (
		<Card className={cn("gap-0 shadow-none md:col-span-2 dark:ring-0", className)} {...props}>
			<CardHeader className="border-b">
				<CardTitle>Recent leads</CardTitle>
				<CardDescription>Latest {leads.length} leads added to the pipeline</CardDescription>
			</CardHeader>
			<CardContent className="p-0">
				{leads.length === 0 ? (
					<p className="py-8 text-center text-sm text-muted-foreground">No leads yet.</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead className="pl-6">Name</TableHead>
								<TableHead className="hidden sm:table-cell">Company</TableHead>
								<TableHead className="text-right">Added</TableHead>
								<TableHead className="pr-6 text-right">Stage</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{leads.map((lead) => (
								<TableRow className="h-14 hover:bg-muted/50" key={lead.id}>
									<TableCell className="max-w-36 truncate pl-6 font-medium">
										<Link href={`/leads/${lead.id}`} className="hover:underline">
											{lead.name}
										</Link>
									</TableCell>
									<TableCell className="hidden max-w-32 sm:table-cell">
										<span className="line-clamp-1 text-muted-foreground text-sm">
											{lead.company ?? "—"}
										</span>
									</TableCell>
									<TableCell className="text-right text-muted-foreground text-sm">
										{formatRelativeDate(lead.createdAt)}
									</TableCell>
									<TableCell className="pr-6 text-right">
										<Badge variant={stageBadgeVariant(lead.stage)} className={stageBadgeClassName(lead.stage)}>
										{STAGE_LABELS[lead.stage]}
									</Badge>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
				<div className="flex justify-center border-t py-3">
					<Button size="sm" variant="ghost" render={<Link href="/leads" />} nativeButton={false}>
						View all leads
						<ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
