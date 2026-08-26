"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { updateLeadStage } from "@/lib/actions/leads";
import { getAvailableSlots, type AvailableDay } from "@/lib/actions/scheduling";
import { STAGE_LABELS, STAGE_TRANSITIONS, REASON_CODES } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/generated/prisma/enums";

export function StageSelect({ leadId, stage }: { leadId: string; stage: PipelineStage }) {
  const [isPending, startTransition] = useTransition();
  const [pendingStage, setPendingStage] = useState<PipelineStage | null>(null);
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  // null = not loaded yet (covers both "hasn't fetched" and "still fetching").
  const [availableDays, setAvailableDays] = useState<AvailableDay[] | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const nextStages = STAGE_TRANSITIONS[stage];

  const isScheduling = pendingStage === "SCHEDULED";
  const loadingSlots = isScheduling && availableDays === null;

  useEffect(() => {
    if (!isScheduling) return;
    let cancelled = false;
    getAvailableSlots().then((days) => {
      if (!cancelled) setAvailableDays(days);
    });
    return () => {
      cancelled = true;
    };
  }, [isScheduling]);

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
    setAvailableDays(null);
    setSelectedDate("");
    setSelectedTime("");
  };

  const handleSelect = (value: PipelineStage) => {
    // Won/Lost require a one-tap reason, and Scheduled requires an
    // appointment time — every other transition is instant.
    if (REASON_CODES[value] || value === "SCHEDULED") {
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

  const confirmSchedule = () => {
    if (!pendingStage || !selectedTime) return;
    commit(pendingStage, undefined, selectedTime);
    closeDialog();
  };

  const reasonOptions = pendingStage ? REASON_CODES[pendingStage] ?? [] : [];
  const timeOptions = availableDays?.find((d) => d.date === selectedDate)?.slots ?? [];

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
              {loadingSlots ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Checking availability…
                </p>
              ) : !availableDays || availableDays.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No open slots in the next week — every business-hours slot is booked.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="scheduleDate">Date</Label>
                    <Select
                      value={selectedDate}
                      onValueChange={(value) => {
                        setSelectedDate(value ?? "");
                        setSelectedTime("");
                      }}
                    >
                      <SelectTrigger id="scheduleDate" className="w-full">
                        <SelectValue placeholder="Pick a date" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDays.map((day) => (
                          <SelectItem key={day.date} value={day.date}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="scheduleTime">Time</Label>
                    <Select
                      value={selectedTime}
                      onValueChange={(value) => setSelectedTime(value ?? "")}
                      disabled={!selectedDate}
                    >
                      <SelectTrigger id="scheduleTime" className="w-full">
                        <SelectValue placeholder="Pick a time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((slot) => (
                          <SelectItem key={slot.value} value={slot.value}>
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button onClick={confirmSchedule} disabled={!selectedTime}>
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
