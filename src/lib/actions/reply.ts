"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { sendLeadEmail } from "@/lib/email/send";

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

  const { note } = await sendLeadEmail(leadId, {
    to: lead.email,
    fromName: lead.business.name,
    subject: `Re: your enquiry`,
    text: trimmed,
    label: "Reply",
  });

  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { pendingReplyText: null } }),
    prisma.activity.create({ data: { leadId, type: "NOTE", note } }),
    // Recorded even when only simulated (not actually delivered), so the
    // conversation history AI context is built from later reflects what
    // staff approved, not just what the customer sent.
    prisma.message.create({ data: { leadId, role: "BUSINESS", text: trimmed } }),
    prisma.notification.updateMany({
      where: { leadId, type: "REPLY_SEND_PENDING", read: false },
      data: { read: true },
    }),
  ]);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/", "layout");
}
