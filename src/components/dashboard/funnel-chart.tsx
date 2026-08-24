"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis, LabelList, ResponsiveContainer } from "recharts";
import { STAGE_LABELS, PIPELINE_STAGES } from "@/lib/pipeline";
import type { PipelineStage } from "@/generated/prisma/enums";

// In-progress stages use the categorical palette (identity, not outcome).
// Won/Lost are status outcomes, not just another category, so they use the
// reserved status palette (good/critical) instead of the next chart slot.
const STAGE_COLORS: Record<PipelineStage, string> = {
  NEW: "var(--chart-1)",
  QUALIFIED: "var(--chart-2)",
  QUOTE_SENT: "var(--chart-3)",
  WON: "var(--status-good)",
  LOST: "var(--status-critical)",
};

export function FunnelChart({ counts }: { counts: Record<PipelineStage, number> }) {
  const data = PIPELINE_STAGES.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: counts[stage] ?? 0,
    fill: STAGE_COLORS[stage],
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          className="fill-muted-foreground"
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} className="fill-muted-foreground" />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.stage} fill={entry.fill} />
          ))}
          <LabelList dataKey="count" position="top" fontSize={12} className="fill-foreground" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
