"use client";

import { useState, useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updateLeadStage } from "@/lib/actions/leads";
import { STAGE_LABELS, STAGE_TRANSITIONS, REASON_CODES } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/generated/prisma/enums";

export function StageSelect({ leadId, stage }: { leadId: string; stage: PipelineStage }) {
  const [isPending, startTransition] = useTransition();
  const [pendingStage, setPendingStage] = useState<PipelineStage | null>(null);
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const nextStages = STAGE_TRANSITIONS[stage];

  if (nextStages.length === 0) {
    return (
      <span className="text-xs font-medium text-muted-foreground">{STAGE_LABELS[stage]} (final)</span>
    );
  }

  const commit = (target: PipelineStage, code?: string) => {
    startTransition(() => {
      void updateLeadStage(leadId, target, code);
    });
  };

  const closeDialog = () => {
    setPendingStage(null);
    setReasonCode(null);
  };

  const handleSelect = (value: PipelineStage) => {
    // Won/Lost require a one-tap reason before they commit — every other
    // transition is instant, same as before.
    if (REASON_CODES[value]) {
      setPendingStage(value);
      setReasonCode(null);
    } else {
      commit(value);
    }
  };

  const confirmReason = () => {
    if (!pendingStage || !reasonCode) return;
    commit(pendingStage, reasonCode);
    closeDialog();
  };

  const reasonOptions = pendingStage ? REASON_CODES[pendingStage] ?? [] : [];

  return (
    <>
      <Select
        value=""
        disabled={isPending}
        onValueChange={(value) => handleSelect(value as PipelineStage)}
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue placeholder={isPending ? "Moving…" : `Move from ${STAGE_LABELS[stage]}`} />
        </SelectTrigger>
        <SelectContent>
          {nextStages.map((s) => (
            <SelectItem key={s} value={s}>
              Move to {STAGE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={pendingStage !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingStage ? `Why is this lead ${STAGE_LABELS[pendingStage].toLowerCase()}?` : ""}
            </DialogTitle>
            <DialogDescription>
              Pick one reason — this is what powers lead scoring down the line.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {reasonOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => setReasonCode(option.code)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  reasonCode === option.code
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-input hover:bg-muted",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={confirmReason} disabled={!reasonCode}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
