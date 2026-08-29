"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { STAGE_TRANSITIONS, REASON_CODES } from "@/lib/pipeline";
import { generateClosingReport } from "@/lib/actions/lead-report";
import { extractEnquiry, type CatalogItem } from "@/lib/intake/extract-enquiry";
import { buildSuggestedLineItems } from "@/lib/intake/lead-matching";
import {
  MAX_LENGTHS,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
} from "@/lib/validation";
import type { VehicleDetails } from "@/lib/vehicle";
import type { PipelineStage } from "@/generated/prisma/enums";
import { BUSINESS_TIMEZONE, parseUaeDateTimeLocal } from "@/lib/timezone";

const DEMO_BUSINESS_ID = "demo-business";

export async function createLead(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_LENGTHS.name);
  const emailRaw = String(formData.get("email") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim().slice(0, MAX_LENGTHS.company);
  const note = String(formData.get("note") ?? "").trim().slice(0, MAX_LENGTHS.note);

  if (!name) {
    throw new Error("Lead name is required.");
  }
  if (!emailRaw) {
    throw new Error("Email is required.");
  }
  if (!isValidEmail(emailRaw)) {
    throw new Error("That doesn't look like a valid email.");
  }
  if (!phoneRaw) {
    throw new Error("Phone is required.");
  }
  if (!isValidPhone(phoneRaw)) {
    throw new Error("That doesn't look like a valid phone number.");
  }

  const email = normalizeEmail(emailRaw);
  const phone = normalizePhone(phoneRaw);

  // Best-effort: turn the staff-written note into quote-suggestion grounding,
  // same as email intake does with a customer's message. A failure here
  // shouldn't block the lead actually getting created (same "don't let AI
  // failure block the real action" pattern as generateClosingReport).
  let suggestedLineItems: string | undefined;
  let vehicleMake: string | null = null;
  let vehicleModel: string | null = null;
  let vehicleYear: string | null = null;
  if (note) {
    try {
      const catalogItemsRaw = await prisma.serviceCatalogItem.findMany({
        where: { businessId: DEMO_BUSINESS_ID },
      });
      const catalogItems: CatalogItem[] = catalogItemsRaw.map((item) => ({
        description: item.description,
        unitPrice: String(Math.round(item.unitPrice / 100)),
      }));
      const data = await extractEnquiry(note, "manual", undefined, catalogItems);
      const items = buildSuggestedLineItems(data.suggested_line_items);
      if (items.length > 0) suggestedLineItems = JSON.stringify(items);
      vehicleMake = data.vehicle_make.trim().slice(0, MAX_LENGTHS.vehicleField) || null;
      vehicleModel = data.vehicle_model.trim().slice(0, MAX_LENGTHS.vehicleField) || null;
      vehicleYear = data.vehicle_year.trim().slice(0, MAX_LENGTHS.vehicleYear) || null;
    } catch (err) {
      console.error("Failed to generate quote suggestions for manual lead", err);
    }
  }

  const lead = await prisma.lead.create({
    data: {
      businessId: DEMO_BUSINESS_ID,
      name,
      email,
      phone,
      company: company || null,
      source: "MANUAL",
      suggestedLineItems,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      activities: note
        ? { create: [{ type: "NOTE", note }] }
        : undefined,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function updateLeadStage(
  leadId: string,
  nextStage: PipelineStage,
  reasonCode?: string,
  scheduledAt?: string,
  vehicle?: VehicleDetails,
) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  const allowed = STAGE_TRANSITIONS[lead.stage];
  if (!allowed.includes(nextStage)) {
    throw new Error(`Cannot move a lead from ${lead.stage} to ${nextStage}.`);
  }

  // Terminal stages (Won/Lost) require a one-tap reason code — the cheapest,
  // highest-leverage instrumentation for any future lead-scoring work.
  const requiredCodes = REASON_CODES[nextStage];
  if (requiredCodes && !requiredCodes.some((option) => option.code === reasonCode)) {
    throw new Error(`A reason is required to move a lead to ${nextStage}.`);
  }

  // Scheduling a service appointment requires an actual date/time — Won
  // later means that appointment was completed and the car was returned.
  let scheduledDate: Date | null = null;
  if (nextStage === "SCHEDULED") {
    // The dropdown's value is UAE wall-clock digits (see getAvailableSlots),
    // not the server's local time — parse it as such, not via `new Date()`.
    scheduledDate = scheduledAt ? parseUaeDateTimeLocal(scheduledAt) : null;
    if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) {
      throw new Error("Pick a date and time for the appointment.");
    }
  }

  // "Qualified" means the vehicle is identified, not just that contact info
  // exists — required, not optional. Falls back to whatever's already on the
  // lead (AI intake may have pre-filled it) so re-confirming an already-known
  // vehicle isn't forced, but at least one of new-input/existing must cover
  // all three fields.
  let vehicleUpdate: { vehicleMake: string; vehicleModel: string; vehicleYear: string } | undefined;
  if (nextStage === "QUALIFIED") {
    const make = vehicle?.make.trim() || lead.vehicleMake || "";
    const model = vehicle?.model.trim() || lead.vehicleModel || "";
    const year = vehicle?.year.trim() || lead.vehicleYear || "";
    if (!make || !model || !year) {
      throw new Error("Vehicle make, model, and year are required to qualify this lead.");
    }
    vehicleUpdate = { vehicleMake: make, vehicleModel: model, vehicleYear: year };
  }

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: {
        stage: nextStage,
        scheduledAt: scheduledDate ?? undefined,
        ...vehicleUpdate,
      },
    }),
    prisma.activity.create({
      data: {
        leadId,
        type: "STAGE_CHANGE",
        fromStage: lead.stage,
        toStage: nextStage,
        reasonCode: requiredCodes ? reasonCode : null,
        note: scheduledDate
          ? `Service scheduled for ${scheduledDate.toLocaleString("en-US", { timeZone: BUSINESS_TIMEZONE })}.`
          : vehicleUpdate
            ? `Vehicle: ${vehicleUpdate.vehicleYear} ${vehicleUpdate.vehicleMake} ${vehicleUpdate.vehicleModel}`
            : null,
      },
    }),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);

  if (nextStage === "WON" || nextStage === "LOST") {
    try {
      await generateClosingReport(leadId, nextStage, reasonCode);
      revalidatePath(`/leads/${leadId}`);
    } catch (err) {
      // A report failing to generate shouldn't block the lead actually closing.
      console.error("Failed to generate closing report", err);
    }
  }
}

export async function addLeadNote(leadId: string, formData: FormData) {
  const note = String(formData.get("note") ?? "").trim().slice(0, MAX_LENGTHS.note);
  if (!note) return;

  await prisma.activity.create({
    data: { leadId, type: "NOTE", note },
  });

  revalidatePath(`/leads/${leadId}`);
}
