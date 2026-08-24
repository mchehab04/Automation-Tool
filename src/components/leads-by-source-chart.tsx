"use client";

import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { LabelList, Pie, PieChart } from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
} from "@/components/ui/chart";

export type SourceDatum = { source: string; label: string; count: number };

const PALETTE = ["var(--chart-1)", "var(--chart-3)", "var(--chart-5)", "var(--chart-2)", "var(--chart-4)"];

export function LeadsBySourceChart({
	data,
	className,
	...props
}: ComponentProps<typeof Card> & { data: SourceDatum[] }) {
	const total = data.reduce((sum, d) => sum + d.count, 0);

	const chartData = data.map((d, i) => ({
		...d,
		share: total > 0 ? Math.round((d.count / total) * 100) : 0,
		fill: PALETTE[i % PALETTE.length],
	}));

	const chartConfig = Object.fromEntries([
		["share", { label: "Share" }],
		...chartData.map((d) => [d.source, { label: d.label, color: d.fill }]),
	]) satisfies ChartConfig;

	return (
		<Card className={cn("flex flex-col shadow-none dark:ring-0", className)} {...props}>
			<CardHeader className="items-center space-y-1 pb-0 sm:items-start">
				<CardTitle>Leads by source</CardTitle>
				<CardDescription>Where leads have come in from, all time.</CardDescription>
			</CardHeader>
			<CardContent className="my-auto">
				{total === 0 ? (
					<p className="py-12 text-center text-sm text-muted-foreground">No leads yet.</p>
				) : (
					<ChartContainer className="mx-auto aspect-square max-h-72 w-full" config={chartConfig}>
						<PieChart accessibilityLayer>
							<Pie
								cornerRadius={8}
								data={chartData}
								dataKey="share"
								innerRadius={36}
								nameKey="source"
								outerRadius="88%"
								stroke="var(--card)"
								strokeWidth={4}
							>
								<LabelList
									className="fill-background font-medium"
									dataKey="share"
									fill="currentColor"
									fontWeight={500}
									formatter={(label: unknown) => {
										const n = Number(label);
										return Number.isFinite(n) ? `${n}%` : String(label ?? "");
									}}
									position="inside"
									stroke="none"
								/>
							</Pie>
							<ChartLegend content={<ChartLegendContent nameKey="source" />} />
						</PieChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
