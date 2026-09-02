"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { SLOT_MINUTES, BUSINESS_HOURS, OPEN_WEEKDAYS, BOOKING_WINDOW_DAYS } from "@/lib/scheduling";
import { BUSINESS_TIMEZONE, toUaeParts, fromUaeParts } from "@/lib/timezone";
import { sendLeadEmail } from "@/lib/email/send";
import { sendLeadWhatsApp } from "@/lib/whatsapp/send";
import { originChannel } from "@/lib/lead-channel";

export type AvailableDay = {
  date: string; // "YYYY-MM-DD", for grouping
  label: string; // "Mon, Aug 31"
  slots: { value: string; label: string }[]; // value: "YYYY-MM-DDTHH:mm" (datetime-local format)
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Matches the format <input type="datetime-local"> produces. Renders the
// UAE wall-clock digits of this instant (not the server's local digits) —
// updateLeadStage parses this shape back via parseUaeDateTimeLocal, which
// assumes the same convention.
function toDateTimeLocalString(d: Date): string {
  const p = toUaeParts(d);
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hours)}:${pad(p.minutes)}`;
}

export async function getAvailableSlots(): Promise<AvailableDay[]> {
  const now = new Date();
  const nowUae = toUaeParts(now);
  const windowStart = fromUaeParts(nowUae.year, nowUae.month, nowUae.day);
  const windowEnd = fromUaeParts(nowUae.year, nowUae.month, nowUae.day + BOOKING_WINDOW_DAYS);

  const booked = await prisma.lead.findMany({
    // A Lost lead's booking no longer holds its slot — the appointment
    // isn't happening, so it should become available again. A Won lead's
    // slot correctly stays blocked (the service actually happened).
    where: { scheduledAt: { gte: windowStart, lt: windowEnd }, stage: { not: "LOST" } },
    select: { scheduledAt: true },
  });
  const bookedTimes = booked.map((b) => b.scheduledAt!);

  // Overlap check, not exact-match — a pre-existing appointment scheduled
  // off the half-hour grid (e.g. from before this feature existed) should
  // still block the slot it falls inside, not just an exact-timestamp twin.
  const isTaken = (slotStart: Date, slotEnd: Date) =>
    bookedTimes.some((b) => b >= slotStart && b < slotEnd);

  const days: AvailableDay[] = [];

  for (let dayOffset = 0; dayOffset < BOOKING_WINDOW_DAYS; dayOffset++) {
    const dayStart = fromUaeParts(nowUae.year, nowUae.month, nowUae.day + dayOffset);
    if (!OPEN_WEEKDAYS.includes(toUaeParts(dayStart).weekday)) continue;

    const dayEnd = fromUaeParts(nowUae.year, nowUae.month, nowUae.day + dayOffset, BUSINESS_HOURS.endHour, 0);

    const slots: { value: string; label: string }[] = [];
    let t = fromUaeParts(nowUae.year, nowUae.month, nowUae.day + dayOffset, BUSINESS_HOURS.startHour, 0);

    while (t < dayEnd) {
      const slotEnd = new Date(t.getTime() + SLOT_MINUTES * 60 * 1000);
      if (t > now && !isTaken(t, slotEnd)) {
        slots.push({
          value: toDateTimeLocalString(t),
          label: t.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: BUSINESS_TIMEZONE,
          }),
        });
      }
      // Pure elapsed-time arithmetic — immune to any timezone/DST
      // reinterpretation, unlike mutating via setMinutes/getMinutes.
      t = new Date(t.getTime() + SLOT_MINUTES * 60 * 1000);
    }

    if (slots.length > 0) {
      days.push({
        date: toDateTimeLocalString(dayStart).slice(0, 10),
        label: dayStart.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: BUSINESS_TIMEZONE,
        }),
        slots,
      });
    }
  }

  return days;
}

// Returns { error } for expected failures instead of throwing — see
// reply.ts's sendPendingReply for why (Next.js redacts thrown Server Action
// error messages in production).
export async function sendBookingMessage(leadId: string, text: string): Promise<{ error: string } | undefined> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { error: "Message can't be empty." };
  }

  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { business: true },
  });

  const channel = originChannel(lead);
  if (!channel) {
    return { error: "This lead has no contact info on file to send to." };
  }

  let note: string;
  try {
    ({ note } =
      channel === "whatsapp"
        ? await sendLeadWhatsApp(leadId, { to: lead.phone!, text: trimmed, label: "Booking confirmation" })
        : await sendLeadEmail(leadId, {
            to: lead.email!,
            fromName: lead.business.name,
            subject: `Your appointment with ${lead.business.name} is confirmed`,
            text: trimmed,
            label: "Booking confirmation",
          }));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send the booking confirmation." };
  }

  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { pendingBookingMessage: null } }),
    prisma.activity.create({ data: { leadId, type: "NOTE", note } }),
    prisma.message.create({ data: { leadId, role: "BUSINESS", text: trimmed } }),
    prisma.notification.updateMany({
      where: { leadId, type: "BOOKING_SEND_PENDING", read: false },
      data: { read: true },
    }),
  ]);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/", "layout");
}
