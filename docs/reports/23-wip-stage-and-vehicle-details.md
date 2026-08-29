# 23 — WIP Pipeline Stage and Vehicle Details at QUALIFIED

## What I did

Built the two near-term-backlog items from report 22's UAE research review: a new
`IN_PROGRESS` pipeline stage between `SCHEDULED` and `WON`, and required vehicle
make/model/year capture at `QUALIFIED`. Both were framed in report 22 as real
pipeline-correctness gaps independent of any specific market, not UAE-specific work.

## Main decisions / findings

- **Both gates are hard requirements, confirmed with the user first** — vehicle
  details are required to reach `QUALIFIED` (mirrors the existing Won/Lost
  reason-code pattern), not optional fields. `SCHEDULED → WON` no longer exists as a
  direct transition; every lead must pass through `IN_PROGRESS` now.
- **Vehicle details captured via a dialog on the QUALIFIED transition**, not on the
  initial "Add lead" form — mirrors the existing reason-code dialog in
  `stage-select.tsx` exactly (`StageSelect` gained a third dialog branch alongside
  the existing reason-picker and scheduling ones). Pre-fills from whatever AI email
  intake already extracted, so staff confirm/correct rather than retype.
- **`IN_PROGRESS` is deliberately just the stage itself, not a quote-revision
  workflow.** Report 22's own research noted that supplementary repairs discovered
  mid-job change the quote while a lead is in this stage — genuinely true, but a
  separate, larger feature. Documented that scoping boundary directly in the schema
  comment so it doesn't get silently assumed later.
- **AI extraction (`extractEnquiry`) now also pulls vehicle make/model/year** when
  mentioned, wired into both intake paths (simulated and real Gmail) with the same
  "fill gaps, never overwrite a confirmed value" pattern the codebase already uses
  for `company` — a later email can't silently clobber what staff already confirmed
  through the QUALIFIED dialog.
- **Didn't re-run `db:seed`** — it has a known lead-duplication bug (report 20:
  `prisma.lead.create` isn't idempotent). Instead wrote a one-off backfill script
  updating the 6 existing QUALIFIED-or-later demo leads with vehicle info by email,
  matching what report 20 itself did when it hit the same situation.
- **Hit the same dead-IPv6-route problem as report 08** applying the migration —
  `prisma migrate dev` still can't reach the database from this machine. Used the
  same established workaround: generated the incremental SQL via
  `prisma migrate diff` between the last-committed schema and the current one (both
  local files, no DB connection needed), applied it through a raw `pg` connection
  with `setDefaultResultOrder("ipv4first")`, and hand-inserted the
  `_prisma_migrations` tracking row.
- **Found and fixed a real footgun while verifying**: a dev server (PID 2312) had
  been running since before this session's schema change and was serving requests
  against a stale, pre-regenerate Prisma client — every `QUALIFIED` transition
  failed with `Unknown argument 'vehicleMake'` until it was killed and restarted.
  Second time this exact failure mode has shown up in this project (also hit during
  the Postgres migration, report 08) — a long-running dev server doesn't
  automatically pick up a regenerated Prisma client.

## Why this matters

"Qualified" now actually means something closer to what the word implies — a lead
with an identified vehicle, not just a name and a phone number. And the pipeline can
finally represent "the car is here and being worked on" instead of jumping straight
from a booked appointment to done, which was a real blind spot for anything but an
instant same-day job.

## Risks / things to keep in mind

- Every existing `SCHEDULED`-stage lead in the live database (if any exist beyond
  the throwaway test leads used for verification) is now stuck — it can only move to
  `IN_PROGRESS`, not directly to `WON`. Worth checking the live data for any
  real lead currently sitting at `SCHEDULED`.
- The vehicle-details gate has no admin override — if the UI dialog is ever
  bypassed (a future API integration, a script), `updateLeadStage` still enforces
  the gate server-side, but there's no way to force-qualify a lead without vehicle
  info even if a business genuinely doesn't need it for some job type. Not a problem
  for the current single-vertical (auto garage) scope; worth remembering if
  `BusinessCategory` ever actually gets branched on.

## Files touched

- `prisma/schema.prisma` — `PipelineStage.IN_PROGRESS`, `Lead.vehicleMake/Model/Year`
- `prisma/migrations/20260829091333_wip_stage_and_vehicle_details/` — new
- `src/lib/pipeline.ts` — stage list, labels, transitions
- `src/lib/vehicle.ts` — new, shared `VehicleDetails` type + `formatVehicle()`
- `src/lib/validation.ts` — `MAX_LENGTHS.vehicleField`/`vehicleYear`
- `src/lib/actions/leads.ts` — `updateLeadStage` gains the `vehicle` param + gate
- `src/components/leads/stage-select.tsx` — new QUALIFIED dialog branch
- `src/components/leads/kanban-board.tsx`, `src/app/(app)/leads/[id]/page.tsx` —
  pass `vehicle` prop to `StageSelect`; detail page also displays it
- `src/components/dashboard/funnel-chart.tsx` — `IN_PROGRESS` chart color
- `src/lib/intake/extract-enquiry.ts` — `vehicle_make/model/year` extraction fields
- `src/lib/actions/email-intake.ts`, `src/lib/gmail/intake-runner.ts` — wire
  extracted vehicle fields into both intake paths
- `prisma/seed.ts` — demo leads' vehicle data (6 existing rows backfilled directly,
  not via a seed re-run)

## Next step

Check the live database for any real lead currently at `SCHEDULED` before this
ships anywhere it matters — it'll need to pass through `IN_PROGRESS` now. Otherwise
this closes out both near-term items from report 22; UAE-specific work
(WhatsApp, DVI, parts tiering, insurance LPO, VAT) stays deferred per that report's
decision.
