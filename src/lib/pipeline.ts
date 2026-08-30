import type { PipelineStage, LeadSource } from "@/generated/prisma/enums";

export const PIPELINE_STAGES: PipelineStage[] = [
  "NEW",
  "QUALIFIED",
  "QUOTE_SENT",
  "SCHEDULED",
  "IN_PROGRESS",
  "WON",
  "LOST",
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  NEW: "New",
  QUALIFIED: "Qualified",
  QUOTE_SENT: "Quote Sent",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  // Won means the service was completed and the car was returned to the
  // customer — not just that the quote was accepted.
  WON: "Won",
  LOST: "Lost",
};

// Stages a lead can move to from its current stage. Linear forward progression,
// plus the ability to mark a lead Lost from any active stage.
export const STAGE_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  NEW: ["QUALIFIED", "LOST"],
  QUALIFIED: ["QUOTE_SENT", "LOST"],
  QUOTE_SENT: ["SCHEDULED", "LOST"],
  SCHEDULED: ["IN_PROGRESS", "LOST"],
  IN_PROGRESS: ["WON", "LOST"],
  WON: [],
  LOST: [],
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  MANUAL: "Manual",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
};

export type ReasonCode = { code: string; label: string };

// One-tap, no-free-text reason codes captured whenever a lead closes.
// Deliberately a small fixed vocabulary per stage, not free text — this is
// the day-one instrumentation the future lead-scoring/ML gate depends on.
export const REASON_CODES: Partial<Record<PipelineStage, ReasonCode[]>> = {
  WON: [
    { code: "price_fit", label: "Price was right" },
    { code: "insurance_covered", label: "Insurance covered the repair" },
    { code: "quick_availability", label: "Could fit them in quickly" },
    { code: "repeat_customer", label: "Repeat / referral customer" },
    { code: "other", label: "Other" },
  ],
  LOST: [
    { code: "price", label: "Price too high" },
    { code: "no_response", label: "Went unresponsive" },
    { code: "competitor", label: "Chose a competitor" },
    { code: "parts_unavailable", label: "Needed parts weren't available in time" },
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
