"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { sendLeadEmail } from "@/lib/email/send";
import { sendLeadWhatsApp } from "@/lib/whatsapp/send";
import { originChannel } from "@/lib/lead-channel";

// Returns { error } for expected failures instead of throwing — Next.js
// redacts thrown Server Action error messages in production ("Minified
// React error #441"), so a business-rule failure like "no email on file"
// must be modeled as a return value, not a throw, to actually reach the
// user. See node_modules/next/dist/docs/01-app/01-getting-started/
// 10-error-handling.md.
export async function sendPendingReply(leadId: string, text: string): Promise<{ error: string } | undefined> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { error: "Reply can't be empty." };
  }

  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { business: true },
  });

  // Reply goes back via wherever the lead came from, so it lands in the
  // same thread the customer is already looking at.
  const channel = originChannel(lead);
  if (!channel) {
    return { error: "This lead has no contact info on file to reply to." };
  }

  let note: string;
  try {
    ({ note } =
      channel === "whatsapp"
        ? await sendLeadWhatsApp(leadId, { to: lead.phone!, text: trimmed, label: "Reply" })
        : await sendLeadEmail(leadId, {
            to: lead.email!,
            fromName: lead.business.name,
            subject: `Re: your enquiry`,
            text: trimmed,
            label: "Reply",
          }));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send the reply." };
  }

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
