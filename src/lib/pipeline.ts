import type { PipelineStage } from "@/generated/prisma/enums";

export const PIPELINE_STAGES: PipelineStage[] = [
  "NEW",
  "QUALIFIED",
  "QUOTE_SENT",
  "WON",
  "LOST",
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  NEW: "New",
  QUALIFIED: "Qualified",
  QUOTE_SENT: "Quote Sent",
  WON: "Won",
  LOST: "Lost",
};

// Stages a lead can move to from its current stage. Linear forward progression,
// plus the ability to mark a lead Lost from any active stage.
export const STAGE_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  NEW: ["QUALIFIED", "LOST"],
  QUALIFIED: ["QUOTE_SENT", "LOST"],
  QUOTE_SENT: ["WON", "LOST"],
  WON: [],
  LOST: [],
};

export type ReasonCode = { code: string; label: string };

// One-tap, no-free-text reason codes captured whenever a lead closes.
// Deliberately a small fixed vocabulary per stage, not free text — this is
// the day-one instrumentation the future lead-scoring/ML gate depends on.
export const REASON_CODES: Partial<Record<PipelineStage, ReasonCode[]>> = {
  WON: [
    { code: "price_fit", label: "Price was right" },
    { code: "financing_approved", label: "Financing approved" },
    { code: "trade_in_accepted", label: "Trade-in accepted" },
    { code: "repeat_customer", label: "Repeat / referral customer" },
    { code: "other", label: "Other" },
  ],
  LOST: [
    { code: "price", label: "Price too high" },
    { code: "no_response", label: "Went unresponsive" },
    { code: "competitor", label: "Chose a competitor" },
    { code: "financing_fell_through", label: "Financing fell through" },
    { code: "timing", label: "Bad timing" },
    { code: "other", label: "Other" },
  ],
};

export function getReasonLabel(stage: PipelineStage, code: string): string {
  const options = REASON_CODES[stage];
  return options?.find((option) => option.code === code)?.label ?? code;
}

// Won/Lost are status outcomes, not just another category — they use the
// reserved status palette (good/critical), never a categorical chart color.
export function stageBadgeVariant(stage: PipelineStage): "secondary" | "destructive" {
  return stage === "LOST" ? "destructive" : "secondary";
}

export function stageBadgeClassName(stage: PipelineStage): string | undefined {
  return stage === "WON" ? "bg-status-good/10 text-status-good" : undefined;
}
