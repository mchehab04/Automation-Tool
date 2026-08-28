# 20 — Business Category Tag, UAE Scheduling Timezone, Lost Frees Slot

## What was done

Three items from the "what's next" list, tackled together since each was small:

1. Added `Business.category` (the previously-deferred multi-vertical field) and tagged
   every `ServiceCatalogItem` with the same category — schema-level prep for future
   verticals beyond auto-garage, not a behavior change yet.
2. Fixed the known rough edge that scheduling had no real timezone handling — hardcoded
   the business's timezone to UAE (`Asia/Dubai`).
3. Fixed the known rough edge that a `LOST` lead's booked slot never freed back up.

## Key decisions

- **`BusinessCategory` enum** (`AUTO_GARAGE`, `HOUSE_MAINTENANCE`, `REAL_ESTATE`), added to
  both `Business` and `ServiceCatalogItem`, both defaulting to `AUTO_GARAGE` so existing
  data stays valid with no special-casing. Confirmed with the user this means "tag each
  catalogue item with the business vertical it belongs to" (not per-item sub-categories
  like Parts/Labor, and not scoping the catalogue query itself — nothing currently needs to
  filter by it, since a catalogue item is already 1:1 scoped to one business via
  `businessId`, which has exactly one category).
- **UAE timezone via a fixed UTC+4 offset, not a new dependency.** UAE never observes
  daylight saving time, which makes a hand-rolled fixed-offset approach safe here in a way
  it wouldn't be for most timezones — no `date-fns-tz`/`luxon` needed. New
  `src/lib/timezone.ts` provides `toUaeParts`/`fromUaeParts` (construct/read UAE wall-clock
  Date parts) and `parseUaeDateTimeLocal` (parse the scheduling dropdown's
  `"YYYY-MM-DDTHH:mm"` value as UAE time, not ambiguous server-local time). Display
  formatting (`toLocaleString` etc.) just passes `timeZone: "Asia/Dubai"` — `Intl` handles
  that natively and correctly, no manual math needed there.
- **Scoped the timezone fix to `scheduledAt` specifically** — slot generation
  (`getAvailableSlots`), the parsing in `updateLeadStage`, and the handful of places
  `scheduledAt` itself is displayed (lead detail page, the stage-change activity note, the
  AI closing report). Deliberately did not sweep every other timestamp in the app (activity
  feed, quote dates, analytics charts) — that wasn't part of the flagged rough edge and is a
  separate, larger task.
- **Lost frees the slot, Won doesn't** — one added clause to `getAvailableSlots()`'s
  `where` filter (`stage: { not: "LOST" }`). No schema change needed; `updateLeadStage`
  already leaves `scheduledAt` untouched on every transition, so this is purely a read-side
  fix.
- **Elapsed-time arithmetic instead of local Date mutators** when stepping through slots
  (`t = new Date(t.getTime() + SLOT_MINUTES * 60_000)` instead of `t.setMinutes(...)`) —
  immune to any timezone/DST reinterpretation, since it operates on the absolute instant
  rather than re-reading/rewriting local field getters.

## Outcome

- Made a mistake mid-task worth recording honestly: re-running `db:seed` to populate the
  new `category` field re-triggered the known seed-duplication bug (9 demo leads
  duplicated again), and my cleanup query — "delete the newer of any name+email duplicate
  under demo-business" — also caught and deleted a "Sarah Kim" lead that wasn't part of the
  demo-seed list at all. That heuristic was safe the first time this pattern came up
  (report 17) but stopped being safe once the lead-matching fix (report 18) made a
  legitimate second lead with the same name/email an expected, correct outcome for a
  repeat contact. Confirmed the user's actual long-running "Sarah Kim" test lead (full
  history intact) and a separate older no-email "Sarah Kim" lead were both untouched — only
  a third, unaccounted-for row was lost, irrecoverably. User confirmed this was fine to
  move past, but noting it plainly rather than glossing over it, per the reason this note
  exists at all: don't trust a blanket cleanup heuristic a second time without re-checking
  whether its safety assumption still holds.
- Verified the timezone fix is genuinely server-timezone-independent, not just correct by
  coincidence: ran the full booking flow once under the dev machine's actual local offset
  (which happens to already be UTC+4), then again with the Node process's timezone forced
  to `America/Los_Angeles` (`$env:TZ` in PowerShell — confirmed the forced offset actually
  took effect, from -240 to +420 minutes). Both runs produced byte-identical results: same
  slot labels (9:00 AM–4:30 PM range, first three shown as 3:00/3:30/4:00 PM given the time
  of day tested), same stored UTC instant for a booked slot, exactly 4 hours behind the
  UAE wall-clock time picked.
- Verified Lost-frees-slot / Won-stays-blocked in the same run: booked a lead into a slot,
  confirmed it disappeared from `getAvailableSlots()`; marked that lead `LOST`, confirmed
  the exact same slot reappeared; booked a second lead into it and marked that one `WON`,
  confirmed the slot stayed blocked afterward. All throwaway test leads cleaned up.
- `npx tsc --noEmit` and `npm run lint` both clean.

## Files touched

- `prisma/schema.prisma` — new `BusinessCategory` enum, `Business.category`,
  `ServiceCatalogItem.category`
- `prisma/migrations/20260828103951_business_category/migration.sql` — new
- `prisma/seed.ts` — sets `category: "AUTO_GARAGE"` explicitly on the demo business and its
  catalogue items
- `src/lib/timezone.ts` — new, UAE timezone helpers
- `src/lib/actions/scheduling.ts` — `getAvailableSlots()` rewritten to generate/label slots
  in UAE time regardless of server timezone; added the Lost-frees-slot filter
- `src/lib/actions/leads.ts` — `updateLeadStage` parses the scheduling dropdown's value as
  UAE time; its activity note formats in UAE time
- `src/app/(app)/leads/[id]/page.tsx` — "Appointment: ..." line formats in UAE time
- `src/lib/actions/lead-report.ts` — closing report's appointment line formats in UAE time
