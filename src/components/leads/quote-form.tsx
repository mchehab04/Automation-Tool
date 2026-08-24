"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldFooter } from "@/components/forms/field-footer";
import { replayShake } from "@/components/forms/shake";
import { createQuote } from "@/lib/actions/quotes";
import { MAX_LENGTHS, parseForgivingNumber } from "@/lib/validation";

type Row = { id: number; description: string; quantity: string; unitPrice: string; touched: boolean };

let nextId = 1;

const emptyRow = (): Row => ({
  id: nextId++,
  description: "",
  quantity: "1",
  unitPrice: "0",
  touched: false,
});

function rowError(row: Row): string | undefined {
  if (row.description.trim().length === 0) return "Add a description.";
  if (row.description.length > MAX_LENGTHS.quoteDescription) {
    return `Keep it under ${MAX_LENGTHS.quoteDescription} characters.`;
  }
  if (parseForgivingNumber(row.unitPrice) < 0) return "Price can't be negative.";
  if (parseForgivingNumber(row.quantity) <= 0) return "Quantity must be at least 1.";
  return undefined;
}

export function QuoteForm({ leadId }: { leadId: string }) {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const shakeRefs = useRef(new Map<number, HTMLDivElement>());

  const shakeRow = (id: number) => replayShake(shakeRefs.current.get(id) ?? null);

  const addRow = () => setRows((r) => [...r, emptyRow()]);
  const removeRow = (id: number) => {
    setRows((r) => (r.length > 1 ? r.filter((row) => row.id !== id) : r));
    shakeRefs.current.delete(id);
  };
  const updateRow = (id: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const touchRow = (id: number, hasError: boolean) => {
    updateRow(id, { touched: true });
    if (hasError) shakeRow(id);
  };

  const total = rows.reduce(
    (sum, r) =>
      sum +
      Math.max(1, Math.round(parseForgivingNumber(r.quantity) || 1)) *
        Math.max(0, parseForgivingNumber(r.unitPrice)),
    0,
  );

  const isValid = rows.every((row) => !rowError(row));

  return (
    <form
      action={createQuote.bind(null, leadId)}
      onSubmit={(event) => {
        if (!isValid) {
          event.preventDefault();
          setRows((r) => r.map((row) => ({ ...row, touched: true })));
          rows.forEach((row) => {
            if (rowError(row)) shakeRow(row.id);
          });
        }
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-3">
        {rows.map((row, i) => {
          const liveError = rowError(row);
          const error = row.touched ? liveError : undefined;
          return (
            <div key={row.id} className="flex flex-col gap-1">
              <div
                ref={(el) => {
                  if (el) shakeRefs.current.set(row.id, el);
                  else shakeRefs.current.delete(row.id);
                }}
                className="t-input grid grid-cols-[1fr_5rem_6rem_2rem] items-end gap-2"
              >
                <div className="flex flex-col gap-1">
                  {i === 0 && <Label className="text-xs">Description</Label>}
                  <Input
                    name="description"
                    value={row.description}
                    onChange={(e) => updateRow(row.id, { description: e.target.value })}
                    onBlur={() => touchRow(row.id, Boolean(liveError))}
                    placeholder="Service or item"
                    aria-invalid={Boolean(error) || undefined}
                    maxLength={MAX_LENGTHS.quoteDescription + 20}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  {i === 0 && <Label className="text-xs">Qty</Label>}
                  <Input
                    name="quantity"
                    inputMode="numeric"
                    value={row.quantity}
                    onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                    onBlur={() => touchRow(row.id, Boolean(liveError))}
                    aria-invalid={Boolean(error) || undefined}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  {i === 0 && <Label className="text-xs">Unit price</Label>}
                  <Input
                    name="unitPrice"
                    inputMode="decimal"
                    value={row.unitPrice}
                    onChange={(e) => updateRow(row.id, { unitPrice: e.target.value })}
                    onBlur={() => touchRow(row.id, Boolean(liveError))}
                    placeholder="$0.00"
                    aria-invalid={Boolean(error) || undefined}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.id)}
                  aria-label="Remove line item"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <FieldFooter
                error={error}
                count={row.description.length}
                max={MAX_LENGTHS.quoteDescription}
              />
            </div>
          );
        })}
      </div>

      <Button type="button" variant="outline" size="sm" className="self-start" onClick={addRow}>
        <Plus className="size-4" /> Add line item
      </Button>

      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-lg font-semibold">
          {total.toLocaleString("en-US", { style: "currency", currency: "USD" })}
        </span>
      </div>

      <Button type="submit" disabled={!isValid}>
        Generate quote
      </Button>
    </form>
  );
}
