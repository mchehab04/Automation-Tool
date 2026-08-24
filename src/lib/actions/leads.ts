"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { STAGE_TRANSITIONS, REASON_CODES } from "@/lib/pipeline";
import {
  MAX_LENGTHS,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
} from "@/lib/validation";
import type { PipelineStage } from "@/generated/prisma/enums";

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
  if (emailRaw && !isValidEmail(emailRaw)) {
    throw new Error("That doesn't look like a valid email.");
  }
  if (phoneRaw && !isValidPhone(phoneRaw)) {
    throw new Error("That doesn't look like a valid phone number.");
  }

  const email = emailRaw ? normalizeEmail(emailRaw) : "";
  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";

  const lead = await prisma.lead.create({
    data: {
      businessId: DEMO_BUSINESS_ID,
      name,
      email: email || null,
      phone: phone || null,
      company: company || null,
      source: "MANUAL",
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

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: { stage: nextStage },
    }),
    prisma.activity.create({
      data: {
        leadId,
        type: "STAGE_CHANGE",
        fromStage: lead.stage,
        toStage: nextStage,
        reasonCode: requiredCodes ? reasonCode : null,
      },
    }),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function addLeadNote(leadId: string, formData: FormData) {
  const note = String(formData.get("note") ?? "").trim().slice(0, MAX_LENGTHS.note);
  if (!note) return;

  await prisma.activity.create({
    data: { leadId, type: "NOTE", note },
  });

  revalidatePath(`/leads/${leadId}`);
}
