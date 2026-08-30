"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldFooter } from "@/components/forms/field-footer";
import { updateBusinessDetails } from "@/lib/actions/business-settings";
import { MAX_LENGTHS } from "@/lib/validation";

export function BusinessDetailsForm({
  initialName,
  initialAddress,
}: {
  initialName: string;
  initialAddress: string;
}) {
  const [name, setName] = useState(initialName);
  const [address, setAddress] = useState(initialAddress);
  const [saving, setSaving] = useState(false);

  const nameError = name.trim().length === 0 ? "Business name is required." : undefined;
  const isValid = !nameError;

  return (
    <form
      action={async (formData) => {
        if (!isValid) return;
        setSaving(true);
        try {
          await updateBusinessDetails(formData);
          toast.success("Business details saved.");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to save.");
        } finally {
          setSaving(false);
        }
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="business-name">
          Business name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="business-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_LENGTHS.businessName + 20}
          aria-invalid={Boolean(nameError) || undefined}
        />
        <FieldFooter error={nameError} count={name.length} max={MAX_LENGTHS.businessName} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="business-address">Address</Label>
        <Input
          id="business-address"
          name="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street, area, city, country"
          maxLength={MAX_LENGTHS.businessAddress + 20}
        />
        <FieldFooter count={address.length} max={MAX_LENGTHS.businessAddress} />
        <p className="text-xs text-muted-foreground">Printed on every quote PDF, under the business name.</p>
      </div>

      <Button type="submit" className="self-start" disabled={!isValid || saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
