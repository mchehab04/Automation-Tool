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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLeadStage } from "@/lib/actions/leads";
import { STAGE_LABELS, STAGE_TRANSITIONS, REASON_CODES } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/generated/prisma/enums";

export function StageSelect({ leadId, stage }: { leadId: string; stage: PipelineStage }) {
  const [isPending, startTransition] = useTransition();
  const [pendingStage, setPendingStage] = useState<PipelineStage | null>(null);
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const nextStages = STAGE_TRANSITIONS[stage];

  if (nextStages.length === 0) {
    return (
      <span className="text-xs font-medium text-muted-foreground">{STAGE_LABELS[stage]} (final)</span>
    );
  }

  const commit = (target: PipelineStage, code?: string, when?: string) => {
    startTransition(() => {
      void updateLeadStage(leadId, target, code, when);
    });
  };

  const closeDialog = () => {
    setPendingStage(null);
    setReasonCode(null);
    setScheduledAt("");
  };

  const handleSelect = (value: PipelineStage) => {
    // Won/Lost require a one-tap reason, and Scheduled requires an
    // appointment time — every other transition is instant.
    if (REASON_CODES[value] || value === "SCHEDULED") {
      setPendingStage(value);
      setReasonCode(null);
      setScheduledAt("");
    } else {
      commit(value);
    }
  };

  const confirmReason = () => {
    if (!pendingStage || !reasonCode) return;
    commit(pendingStage, reasonCode);
    closeDialog();
  };

  const confirmSchedule = () => {
    if (!pendingStage || !scheduledAt) return;
    commit(pendingStage, undefined, scheduledAt);
    closeDialog();
  };

  const reasonOptions = pendingStage ? REASON_CODES[pendingStage] ?? [] : [];
  const isScheduling = pendingStage === "SCHEDULED";

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
          {isScheduling ? (
            <>
              <DialogHeader>
                <DialogTitle>When is the appointment?</DialogTitle>
                <DialogDescription>
                  Won will later mean the service was completed and the car was
                  returned — this just books the slot.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scheduledAt">Date &amp; time</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button onClick={confirmSchedule} disabled={!scheduledAt}>
                  Confirm
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
