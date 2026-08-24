"use client";

import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FieldFooter } from "@/components/forms/field-footer";
import { replayShake } from "@/components/forms/shake";
import { addLeadNote } from "@/lib/actions/leads";
import { MAX_LENGTHS } from "@/lib/validation";

export function NoteForm({ leadId }: { leadId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const error =
    note.trim().length === 0
      ? "Note can't be empty."
      : note.length > MAX_LENGTHS.note
        ? `Keep it under ${MAX_LENGTHS.note} characters.`
        : undefined;
  const isValid = !error;

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        if (!isValid) {
          setTouched(true);
          replayShake(shakeRef.current);
          return;
        }
        await addLeadNote(leadId, formData);
        formRef.current?.reset();
        setNote("");
        setTouched(false);
      }}
      className="flex flex-col gap-2"
    >
      <div ref={shakeRef} className="t-input">
        <Textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            setTouched(true);
            if (error) replayShake(shakeRef.current);
          }}
          placeholder="Add a note…"
          rows={2}
          maxLength={MAX_LENGTHS.note + 50}
          aria-invalid={(touched && Boolean(error)) || undefined}
        />
      </div>
      <FieldFooter error={touched ? error : undefined} count={note.length} max={MAX_LENGTHS.note} />
      <Button type="submit" size="sm" variant="outline" className="self-start" disabled={!isValid}>
        Add note
      </Button>
    </form>
  );
}
