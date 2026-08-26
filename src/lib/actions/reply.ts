"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";

export async function sendPendingReply(leadId: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Reply can't be empty.");
  }

  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { business: true },
  });

  if (!lead.email) {
    throw new Error("This lead doesn't have an email address on file to reply to.");
  }

  const result = await sendEmail({
    to: lead.email,
    fromName: lead.business.name,
    subject: `Re: your enquiry`,
    text: trimmed,
  });

  // A real send failure shouldn't be recorded as sent — surface it so the
  // employee knows to retry, same pattern as sendQuoteToCustomer.
  if (!result.delivered && !result.simulated) {
    await prisma.activity.create({
      data: {
        leadId,
        type: "NOTE",
        note: `Reply failed to send to ${lead.email}: ${result.error ?? "unknown error"}.`,
      },
    });
    revalidatePath(`/leads/${leadId}`);
    throw new Error(result.error ?? "Failed to send the reply.");
  }

  const note = result.delivered
    ? `Reply emailed to ${lead.email}.`
    : `Reply approved to send to ${lead.email} — no email provider is configured yet, so this wasn't actually delivered.`;

  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { pendingReplyText: null } }),
    prisma.activity.create({ data: { leadId, type: "NOTE", note } }),
    prisma.notification.updateMany({
      where: { leadId, type: "REPLY_SEND_PENDING", read: false },
      data: { read: true },
    }),
  ]);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/", "layout");
}
