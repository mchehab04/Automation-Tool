"use server";

import { prisma } from "@/lib/db";
import { SLOT_MINUTES, BUSINESS_HOURS, OPEN_WEEKDAYS, BOOKING_WINDOW_DAYS } from "@/lib/scheduling";

export type AvailableDay = {
  date: string; // "YYYY-MM-DD", for grouping
  label: string; // "Mon, Aug 31"
  slots: { value: string; label: string }[]; // value: "YYYY-MM-DDTHH:mm" (datetime-local format)
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Matches the format <input type="datetime-local"> produces — updateLeadStage
// already parses this shape via `new Date(scheduledAt)`.
function toDateTimeLocalString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function getAvailableSlots(): Promise<AvailableDay[]> {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + BOOKING_WINDOW_DAYS);

  const booked = await prisma.lead.findMany({
    where: { scheduledAt: { gte: windowStart, lt: windowEnd } },
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
    const day = new Date(windowStart);
    day.setDate(day.getDate() + dayOffset);
    if (!OPEN_WEEKDAYS.includes(day.getDay())) continue;

    const dayEnd = new Date(day);
    dayEnd.setHours(BUSINESS_HOURS.endHour, 0, 0, 0);

    const slots: { value: string; label: string }[] = [];
    const t = new Date(day);
    t.setHours(BUSINESS_HOURS.startHour, 0, 0, 0);

    while (t < dayEnd) {
      const slotEnd = new Date(t.getTime() + SLOT_MINUTES * 60 * 1000);
      if (t > now && !isTaken(t, slotEnd)) {
        slots.push({
          value: toDateTimeLocalString(t),
          label: t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        });
      }
      t.setMinutes(t.getMinutes() + SLOT_MINUTES);
    }

    if (slots.length > 0) {
      days.push({
        date: toDateTimeLocalString(day).slice(0, 10),
        label: day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        slots,
      });
    }
  }

  return days;
}
