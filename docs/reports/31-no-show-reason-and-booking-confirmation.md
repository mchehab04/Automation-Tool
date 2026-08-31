# 31 — No-Show Reason Code + Booking-Confirmed Message

## What I did

The first two items from the prioritized pipeline-improvements list: added a
"No show" Lost-reason code, and a booking-confirmation message sent to the
customer once a lead moves to `SCHEDULED` — following the same "pending
message, staff reviews, sends" pattern already built three times for
`pendingReplyText`/`pendingQuoteMessage`/`pendingClosingMessage`.

## Main decisions / findings

- **No-show reason code was truly a one-liner** — `REASON_CODES.LOST` in
  `pipeline.ts` is read dynamically everywhere (the reason dialog, the
  gating in `updateLeadStage`), so adding `{ code: "no_show", label: "No
  show" }` needed no other file touched, no migration.
- **Deliberately used a deterministic template, not an AI call, for the
  booking message** — unlike `pendingClosingMessage` (needs an AI call to
  synthesize a whole conversation into a report), a booking confirmation
  only needs facts already known the instant a lead is scheduled: name,
  appointment time, vehicle. This matches the existing `defaultQuoteMessage`
  precedent (`src/lib/quote-message.ts`, a plain template), not
  `generateClosingReport`'s (an Anthropic tool-use call) — avoids AI
  latency/failure handling for zero actual benefit, while keeping the same
  staff-reviews-before-send UX every other outbound message in this app
  uses.
- **This let the implementation come out simpler than the WON/LOST
  precedent it's modeled on**, not just equivalent to it: because there's no
  AI round-trip, the pending field and its notification could be folded
  directly into `updateLeadStage`'s existing `$transaction` for the
  SCHEDULED case, rather than needing a second post-transaction call wrapped
  in try/catch the way `generateClosingReport` needs (that pattern exists
  specifically to handle AI-call failure, which doesn't apply here).
- **Confirmed vehicle fields can't be empty by the time this runs** — a lead
  can only reach `SCHEDULED` via `QUALIFIED`, and `QUALIFIED`'s existing gate
  already requires vehicle make/model/year to be present. So the booking
  message can safely reference the vehicle without a fallback branch for
  missing data.
- **Reused the exact date-formatting string already shown to staff** —
  `lead.scheduledAt.toLocaleString("en-US", { timeZone: BUSINESS_TIMEZONE })`
  is the same expression already rendered on the lead detail page, so the
  message a customer receives states the same date/time staff sees on
  screen, not a differently-formatted duplicate.
- **Gave the new card its own honest copy** — reused `ClosingMessageCard`'s
  layout exactly, but changed the icon/title away from "drafted by AI" (it
  isn't) to "Booking confirmation ready to send," since claiming AI
  involvement that didn't happen would be the same kind of small
  misrepresentation flagged and removed in report 26.

## Outcome

Verified end-to-end with a temporary debug route (same pattern used in
earlier reports for flows that need a live request context) against the
real dev server and real Neon DB, then deleted the route:

- Scheduling a throwaway lead correctly populated `pendingBookingMessage`
  with the right name/vehicle/appointment time, and created a
  `BOOKING_SEND_PENDING` notification with the expected message.
- Editing and sending it via `sendBookingMessage` correctly cleared the
  pending field, marked the notification read, wrote a `BUSINESS` `Message`
  row with the edited text, and logged the expected NOTE activity.
- A second throwaway lead moved to `LOST` with reason `no_show` correctly
  recorded that reason code on the `STAGE_CHANGE` activity.

`npx tsc --noEmit` and `npm run lint` both clean.

**Found and flagged, unrelated to this work, now resolved**: the Playwright
suite turned up a real `401 authentication_error — "API key is invalid"`
from Anthropic on every AI-dependent call (simulated email intake,
`generateClosingReport`) partway through this session — confirmed via the
dev server logs, not a guess. This was an external credential problem, not a
code regression: none of this report's changes touch AI calls at all — the
debug-route verification above already proved the new code works completely
independent of it, since the booking-confirmation flow deliberately has no
AI dependency. The key had simply expired; the user regenerated it and
updated `.env`. After restarting the dev server (env vars are read at
startup, and the running server predated the update) and rerunning the full
suite: **10/10 passed**, including both previously-blocked AI-dependent
specs. `pipeline.spec.ts`'s earlier vehicle-details flake (reported in 30)
also didn't reproduce on this clean run.

## Files touched

- `src/lib/pipeline.ts` — `no_show` reason code
- `prisma/schema.prisma` — `Lead.pendingBookingMessage`,
  `NotificationType.BOOKING_SEND_PENDING`
- `prisma/migrations/20260831222312_lead_pending_booking_message/`,
  `prisma/migrations/20260831222320_notification_booking_send_pending/` —
  new
- `src/lib/booking-message.ts` — new, `defaultBookingMessage`
- `src/lib/actions/leads.ts` — `updateLeadStage` computes and persists the
  booking message + notification inline in the SCHEDULED transaction
- `src/lib/actions/scheduling.ts` — new `sendBookingMessage`
- `src/components/leads/booking-message-card.tsx` — new
- `src/app/(app)/leads/[id]/page.tsx` — mounts `BookingMessageCard`

## Next step

Next up per the agreed order: authentication for employees (#6) and
automated/self-service scheduling (#7) — both deferred until this pair was
done. Analytics, invoices, and payments stay at the end, as agreed.
