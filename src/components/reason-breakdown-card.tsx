import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export type ReasonRow = { code: string; label: string; count: number };

export function ReasonBreakdownCard({
	title,
	description,
	rows,
	accentColor,
	className,
	...props
}: ComponentProps<typeof Card> & {
	title: string;
	description: string;
	rows: ReasonRow[];
	/** CSS color value, e.g. "var(--status-good)". */
	accentColor: string;
}) {
	const total = rows.reduce((sum, r) => sum + r.count, 0);
	const sorted = [...rows].sort((a, b) => b.count - a.count);
	const maxCount = Math.max(1, ...rows.map((r) => r.count));

	return (
		<Card className={cn("shadow-none dark:ring-0", className)} {...props}>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				{total === 0 ? (
					<p className="py-8 text-center text-sm text-muted-foreground">
						No closed leads with this outcome yet.
					</p>
				) : (
					<ul className="flex flex-col gap-3">
						{sorted.map((row) => {
							const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
							const widthPct = Math.round((row.count / maxCount) * 100);
							return (
								<li key={row.code} className="flex flex-col gap-1">
									<div className="flex items-center justify-between text-sm">
										<span className="font-medium">{row.label}</span>
										<span className="text-muted-foreground tabular-nums">
											{row.count} · {pct}%
										</span>
									</div>
									<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full transition-all"
											style={{ width: `${widthPct}%`, backgroundColor: accentColor }}
										/>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
