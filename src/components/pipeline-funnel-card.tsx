import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import type { PipelineStage } from "@/generated/prisma/enums";

export function PipelineFunnelCard({
	counts,
	className,
	...props
}: ComponentProps<typeof Card> & { counts: Record<PipelineStage, number> }) {
	return (
		<Card className={cn("shadow-none md:col-span-2 dark:ring-0", className)} {...props}>
			<CardHeader>
				<CardTitle>Pipeline completion</CardTitle>
				<CardDescription>How many leads sit at each stage right now.</CardDescription>
			</CardHeader>
			<CardContent>
				<FunnelChart counts={counts} />
			</CardContent>
		</Card>
	);
}
