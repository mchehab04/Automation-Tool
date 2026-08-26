# 15 — Available-Slot Dropdown for Scheduling

## What was done

Replaced the free-form `datetime-local` input used when moving a lead to `Scheduled`
with a proper availability-aware picker: a Date dropdown, then a Time dropdown showing
only genuinely open 30-minute slots. No schema change — `Lead.scheduledAt` already
existed and already drove everything downstream (closing report, the appointment line
on the lead page); this was purely a query + UI change.

## Key decisions

- **Config as three named constants** (`src/lib/scheduling.ts`): 9:00 AM–5:00 PM,
  Mon–Fri, next 7 days — confirmed with the user as sensible defaults, deliberately
  kept in one small file rather than scattered through logic, per the explicit "30
  minutes for now, can update later" framing.
- **Overlap check, not exact-timestamp match**, when excluding already-booked slots —
  a pre-existing appointment scheduled off the half-hour grid (from before this
  feature existed, via the old free-form input) still correctly blocks the slot it
  falls inside, rather than silently being invisible to the new availability logic.
- **A booking's slot stays "taken" even if the lead is later marked Lost** — no
  cancellation-awareness built. Simplest correct behavior for v1; flagged as a known
  limitation rather than solved, since freeing a slot back up on cancellation is a
  separate feature (would need an explicit "this appointment was cancelled" action,
  which doesn't exist).
- **Timezone handling stays exactly as implicit as the rest of the app already is** —
  no IANA timezone infrastructure introduced. `scheduledAt` has always been
  parsed/displayed using whatever timezone the running Node process considers local;
  this plan keeps that rather than fixing it as a side effect of an unrelated feature.
  Flagged (again) as something to revisit once actually deployed to Vercel, whose
  servers won't default to the business's real timezone.
- **Avoided a React Compiler lint violation** (`react-hooks/set-state-in-effect`) by
  not calling `setState` synchronously in the fetch effect — instead of a separate
  `loadingSlots` boolean set imperatively, `availableDays` starts `null` and
  `loadingSlots` is derived (`isScheduling && availableDays === null`), so the only
  `setState` call happens inside the fetch's `.then`.

## Outcome

Verified directly against the real Postgres database: `getAvailableSlots()` correctly
returned 5 open business days out of the next 7 calendar days (weekend excluded), with
today showing fewer slots than a full day (already-past times of day correctly
excluded) and full future days showing all 16 half-hour slots from 9:00 AM to 4:30 PM.
Booked a test lead into a specific slot via `updateLeadStage` (unchanged — the dropdown
just feeds it the same datetime-local-format string the old input did) and confirmed
that exact slot no longer appeared in a subsequent availability check; cleaned up the
test lead afterward. `tsc --noEmit` and `npm run lint` both clean.

One transient error appeared in the dev log mid-edit (`TypeError: Cannot read
properties of null (reading 'find')`, ~01:23:07) — an artifact of a live-connected
browser catching an intermediate state between writing `availableDays.find(...)` and
adding the null-guard moments later in the same edit sequence, not a bug in the final
code; no errors since, and the fix (`availableDays?.find(...)`) is confirmed present.

## Files touched

- `src/lib/scheduling.ts` — new, config constants
- `src/lib/actions/scheduling.ts` — new, `getAvailableSlots()`
- `src/components/leads/stage-select.tsx` — Date/Time dropdowns replace the
  datetime-local input for the Scheduled case
