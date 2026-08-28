import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { stageBadgeVariant, stageBadgeClassName } from "@/lib/pipeline";
import { BUSINESS_TIMEZONE, toUaeParts, fromUaeParts, type UaeDateParts } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/generated/prisma/enums";

const DEMO_BUSINESS_ID = "demo-business";
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Month cells are small and packed 5-6 per row — cap entries and overflow
// into a "+N more" label. Week cells have a whole row to themselves, so
// there's no cap there (see CELL_ENTRY_CAP usage below).
const MONTH_CELL_ENTRY_CAP = 3;

type CalendarEntry = { id: string; name: string; stage: PipelineStage; scheduledAt: Date };
type CalendarCell = {
  key: string;
  day: number;
  dim: boolean;
  isToday: boolean;
  entries: CalendarEntry[];
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateKey(p: Pick<UaeDateParts, "year" | "month" | "day">): string {
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
}

function parseDateParam(raw: string | undefined): { year: number; month: number; day: number } | null {
  const match = raw ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw) : null;
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

function parseMonthParam(raw: string | undefined): { year: number; month: number } {
  const match = raw ? /^(\d{4})-(\d{2})$/.exec(raw) : null;
  if (match) return { year: Number(match[1]), month: Number(match[2]) - 1 };
  const now = toUaeParts(new Date());
  return { year: now.year, month: now.month };
}

function buildMonthParam(year: number, month: number): string {
  return `${year}-${pad(month + 1)}`;
}

function buildDateParam(p: { year: number; month: number; day: number }): string {
  return dateKey(p);
}

// Sunday-anchored start of the UAE week containing this date.
function startOfUaeWeek(p: { year: number; month: number; day: number }): { year: number; month: number; day: number } {
  const weekday = toUaeParts(fromUaeParts(p.year, p.month, p.day)).weekday;
  return toUaeParts(fromUaeParts(p.year, p.month, p.day - weekday));
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string; start?: string }>;
}) {
  const { view: viewRaw, month: monthParamRaw, start: startParamRaw } = await searchParams;
  const view = viewRaw === "week" ? "week" : "month";

  // Grid math is UAE-anchored via timezone.ts (not date-fns's calendar
  // helpers, which have no timezone awareness) — mirrors getAvailableSlots().
  let gridStart: Date;
  let gridEnd: Date;
  let cellDefs: { year: number; month: number; day: number; dim: boolean }[];
  let label: string;
  let prevHref: string;
  let nextHref: string;

  if (view === "week") {
    const requested = parseDateParam(startParamRaw) ?? toUaeParts(new Date());
    const weekStart = startOfUaeWeek(requested);
    gridStart = fromUaeParts(weekStart.year, weekStart.month, weekStart.day);
    gridEnd = fromUaeParts(weekStart.year, weekStart.month, weekStart.day + 7);
    cellDefs = Array.from({ length: 7 }, (_, i) =>
      toUaeParts(fromUaeParts(weekStart.year, weekStart.month, weekStart.day + i)),
    ).map((p) => ({ ...p, dim: false }));

    const weekEndParts = toUaeParts(fromUaeParts(weekStart.year, weekStart.month, weekStart.day + 6));
    const startLabel = gridStart.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: BUSINESS_TIMEZONE });
    const endLabel = fromUaeParts(weekEndParts.year, weekEndParts.month, weekEndParts.day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: BUSINESS_TIMEZONE,
    });
    label = `${startLabel} – ${endLabel}`;

    const prevStart = toUaeParts(fromUaeParts(weekStart.year, weekStart.month, weekStart.day - 7));
    const nextStart = toUaeParts(fromUaeParts(weekStart.year, weekStart.month, weekStart.day + 7));
    prevHref = `/calendar?view=week&start=${buildDateParam(prevStart)}`;
    nextHref = `/calendar?view=week&start=${buildDateParam(nextStart)}`;
  } else {
    const { year, month } = parseMonthParam(monthParamRaw);
    const firstOfMonth = fromUaeParts(year, month, 1);
    const firstWeekday = toUaeParts(firstOfMonth).weekday; // 0 = Sun
    const lastOfMonth = fromUaeParts(year, month + 1, 0); // day 0 of next month = last day of this month
    const daysInMonth = toUaeParts(lastOfMonth).day;
    const totalCells = Math.ceil((daysInMonth + firstWeekday) / 7) * 7;
    gridStart = fromUaeParts(year, month, 1 - firstWeekday);
    gridEnd = fromUaeParts(year, month, 1 - firstWeekday + totalCells);
    cellDefs = Array.from({ length: totalCells }, (_, i) => {
      const p = toUaeParts(fromUaeParts(year, month, 1 - firstWeekday + i));
      return { ...p, dim: p.month !== month };
    });
    label = firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: BUSINESS_TIMEZONE });

    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    prevHref = `/calendar?month=${buildMonthParam(prevYear, prevMonth)}`;
    nextHref = `/calendar?month=${buildMonthParam(nextYear, nextMonth)}`;
  }

  const leads = await prisma.lead.findMany({
    where: {
      businessId: DEMO_BUSINESS_ID,
      scheduledAt: { gte: gridStart, lt: gridEnd },
      // A Lost lead's slot is freed (see getAvailableSlots) — it shouldn't
      // visually claim a calendar day either.
      stage: { not: "LOST" },
    },
    select: { id: true, name: true, stage: true, scheduledAt: true },
    orderBy: { scheduledAt: "asc" },
  });

  const entriesByDate = new Map<string, CalendarEntry[]>();
  for (const lead of leads) {
    if (!lead.scheduledAt) continue;
    const entry: CalendarEntry = { id: lead.id, name: lead.name, stage: lead.stage, scheduledAt: lead.scheduledAt };
    const key = dateKey(toUaeParts(lead.scheduledAt));
    const bucket = entriesByDate.get(key);
    if (bucket) bucket.push(entry);
    else entriesByDate.set(key, [entry]);
  }

  const todayKey = dateKey(toUaeParts(new Date()));

  const cells: CalendarCell[] = cellDefs.map((p) => {
    const key = dateKey(p);
    return { key, day: p.day, dim: p.dim, isToday: key === todayKey, entries: entriesByDate.get(key) ?? [] };
  });

  const entryCap = view === "week" ? Infinity : MONTH_CELL_ENTRY_CAP;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Booked appointments, in UAE time.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-md border p-0.5">
            <Button
              variant={view === "month" ? "secondary" : "ghost"}
              size="sm"
              render={<Link href="/calendar" />}
              nativeButton={false}
            >
              Month
            </Button>
            <Button
              variant={view === "week" ? "secondary" : "ghost"}
              size="sm"
              render={<Link href="/calendar?view=week" />}
              nativeButton={false}
            >
              Week
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              render={<Link href={prevHref} />}
              nativeButton={false}
              aria-label={`Previous ${view}`}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-32 text-center text-sm font-medium">{label}</span>
            <Button
              variant="outline"
              size="icon-sm"
              render={<Link href={nextHref} />}
              nativeButton={false}
              aria-label={`Next ${view}`}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-xs">
            {WEEKDAY_LABELS.map((weekdayLabel) => (
              <div key={weekdayLabel} className="bg-muted px-2 py-1.5 text-center font-medium text-muted-foreground">
                {weekdayLabel}
              </div>
            ))}
            {cells.map((cell) => (
              <div
                key={cell.key}
                className={cn(
                  "flex flex-col gap-1 bg-card p-1.5",
                  view === "week" ? "min-h-40 sm:min-h-56" : "min-h-24 sm:min-h-28",
                  cell.dim && "bg-muted/40 text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "text-xs",
                    cell.isToday &&
                      "flex size-5 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {cell.day}
                </span>
                <div className="flex flex-col gap-0.5">
                  {cell.entries.slice(0, entryCap).map((entry) => (
                    <Badge
                      key={entry.id}
                      render={<Link href={`/leads/${entry.id}`} />}
                      variant={stageBadgeVariant(entry.stage)}
                      className={cn(stageBadgeClassName(entry.stage), "w-full justify-start truncate")}
                    >
                      {entry.scheduledAt.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: BUSINESS_TIMEZONE,
                      })}{" "}
                      {entry.name}
                    </Badge>
                  ))}
                  {entryCap !== Infinity && cell.entries.length > entryCap ? (
                    <span className="px-1 text-[10px] text-muted-foreground">
                      +{cell.entries.length - entryCap} more
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
