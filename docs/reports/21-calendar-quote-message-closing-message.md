# 21 — Calendar Tab, Quote Acknowledgment Message, Won/Lost Thank-You Message

## What was done

Three requests tackled together:

1. **Calendar tab** — a month-grid view of booked leads (`/calendar`), UAE-anchored, with a
   week-view toggle added right after (see below).
2. **Quote acknowledgment message** — every quote-send now shows an editable message box
   instead of firing off a bare "please find your quote attached" with no acknowledgment of
   what the customer actually asked for.
3. **Won/Lost thank-you message** — a short, AI-personalized thank-you drafted when a lead
   closes, reviewed/edited by staff before sending — same tone difference by outcome (warm
   and confirming for Won, gracious and door-open for Lost).

## Key decisions

- **Calendar built by hand, no new dependency.** `react-day-picker` (what shadcn's Calendar
  wraps) wasn't installed anywhere in this project, this project's shadcn setup uses a
  non-stock `"base-nova"` style + a custom registry of unverified Base-UI compatibility, and
  the feature needs heavy custom per-day content (a list of booked leads per cell) regardless
  — a library wouldn't have saved meaningful work. Grid math goes through `timezone.ts`'s
  `toUaeParts`/`fromUaeParts` (not `date-fns`'s calendar helpers, which have no timezone
  awareness), mirroring `getAvailableSlots()`'s established pattern exactly. Verified this
  concretely against the live dev server, spanning a real month boundary (Aug 30 → Sep 2),
  not just by code review.
- **`acknowledgment_message` mirrors `draft_reply`'s existing mutual-exclusivity**: the AI
  populates one or the other, never both — `draft_reply` when something's missing/unclear,
  `acknowledgment_message` (written as the complete email body for the eventual quote) when
  nothing is. Real Gmail intake trusts the model's own judgment (same as it already does for
  `draft_reply`); the simulator doesn't (it has its own deterministic "is anything missing"
  gate that can disagree with the model), so it falls back to a shared
  `defaultQuoteMessage()` template when the model leaves the field blank.
- **Every quote-send gets an editable message, not just fresh-info leads** (confirmed with
  the user) — `SendQuoteButton` became `SendQuoteCard`, prefilled from
  `lead.pendingQuoteMessage` when one was drafted, else the same generic fallback template.
- **`generateClosingReport` restructured from a plain-text completion to forced tool-use**
  (mirrors `extractEnquiry`'s pattern) so the internal report and the customer-facing
  thank-you are two distinct, reliable fields instead of one blob to parse. The prompt-
  building code (transcript/notes/quotes assembly) is untouched — only the response contract
  changed. `generateClosingReport` keeps its `Promise<void>` signature and writes both
  outputs itself (all context it needs is already in scope).
- **Extracted a shared `sendLeadEmail()` helper and retrofitted both pre-existing send flows
  to use it** (`sendPendingReply`, `sendQuoteToCustomer`), rather than adding a third
  near-identical copy of the "send → branch three ways on delivered/simulated/failed →
  Activity note" logic that both of them already hand-duplicated (their own code comments
  said so). Only the failure path is fully absorbed into the helper — the success-path note
  is returned so each caller still writes it inside its own transaction alongside its own
  field-clearing/notification-marking, preserving each flow's exact existing atomicity.
  Behavior-preserving code motion, confirmed via a direct regression test.
- **Migration split**: the two new `Lead` columns (`pendingQuoteMessage`,
  `pendingClosingMessage`) combined into one migration; the new `NotificationType` enum
  value kept in its own separate migration, matching this project's established precedent
  for enum changes.
- **Week view added as a follow-up**: a `view=week&start=YYYY-MM-DD` mode alongside the
  original `month=YYYY-MM` mode, sharing the same UAE-anchored grid math, entry-lookup map,
  and cell JSX — only the cell-generation branch and the entry cap differ (month caps at 3
  with a "+N more" label since cells are small and packed 5-6 per row; week has no cap since
  each day gets a full-width row). Switching view always jumps to the week/month containing
  "today" rather than trying to preserve whatever date context was being viewed — simplest
  predictable behavior, no state to carry across the toggle.

## Outcome

- **Test-harness note, not a new bug**: verifying `generateClosingReport` through
  `updateLeadStage` in a standalone script hit the known "revalidatePath outside a live
  request context" artifact — but earlier in the function than in past sessions, since
  `updateLeadStage` calls `revalidatePath` *before* reaching its WON/LOST branch. Worked
  around by calling `generateClosingReport` directly (bypassing `updateLeadStage`), which is
  how the real app never has this problem — `revalidatePath` only breaks outside a live
  Next.js request context, and the real UI always has one.
- **Quote acknowledgment**: ran the simulator with all info present in one message — confirmed
  `pendingQuoteMessage` was populated. Verified the full generate → edit → send flow against
  the real live dev server (via a temporary debug route, cleaned up after — `createQuote`/
  `sendQuoteToCustomer` pull in `@react-pdf/renderer`, which breaks under standalone `tsx`,
  same as every prior PDF-touching verification this project): the sent email body was
  exactly the staff-edited text (not the old hardcoded one-liner), the PDF was still attached,
  `pendingQuoteMessage` cleared to `null`, stage auto-advanced to `QUOTE_SENT`.
- **Won/Lost thank-you**: closed one throwaway lead Won, one Lost. Both produced a correct
  internal `REPORT` activity, a `pendingClosingMessage`, and a `THANK_YOU_SEND_PENDING`
  notification, independently of each other. Confirmed genuinely different tone by outcome —
  Won: *"thank you for choosing us... looking forward to getting those squeaky brakes fixed
  up"*; Lost: *"we appreciate you taking the time to consider us... hope to see you down the
  road"*. Sent the Won message via `sendClosingMessage`, confirmed clearing/notification-read/
  `Message` row all worked.
- **Regression**: confirmed `sendPendingReply` behaves identically after the `sendLeadEmail`
  retrofit (reply sent, `pendingReplyText` cleared, `Message` row recorded).
- **Calendar**: seeded 6 leads spanning the Aug/Sep 2026 boundary and verified against the
  real live dev server — correct day placement in UAE time, the "+1 more" cap correctly
  triggered on a 4-booking day, a `LOST` lead correctly absent from the grid, the next
  month's leading boundary day correctly rendered muted with its entry, "today" correctly
  highlighted, prev/next nav links correctly computed, and pre-existing real leads (not just
  test data) rendered correctly alongside them.
- **Week view**: seeded 5 leads in the current UAE week (4 on one day, which would have
  triggered month view's "+1 more" cap) plus 1 in the following week. Verified against the
  live dev server: default `?view=week` correctly resolved to the week containing today
  (labeled "Aug 23 – Aug 29, 2026"), all 4 same-day entries rendered with no cap/no "+more"
  label, the next-week lead was correctly absent until navigating to `start=2026-08-30`
  (label recomputed correctly, next lead appeared), and both Month/Week toggle links render.
- `npx tsc --noEmit`, `npm run lint`, and a full `npm run build` all clean.

## Files touched

- `prisma/schema.prisma` — `Lead.pendingQuoteMessage`/`pendingClosingMessage`,
  `NotificationType.THANK_YOU_SEND_PENDING`
- `prisma/migrations/20260828111431_lead_pending_messages/`,
  `prisma/migrations/20260828111440_notification_thank_you_pending/` — new
- `src/lib/intake/extract-enquiry.ts` — new `acknowledgment_message` tool field
- `src/lib/gmail/intake-runner.ts`, `src/lib/actions/email-intake.ts` — wire
  `pendingQuoteMessage` into both intake paths
- `src/lib/quote-message.ts` — new, shared `defaultQuoteMessage()` template
- `src/lib/email/send.ts` — new shared `sendLeadEmail()` helper
- `src/lib/actions/reply.ts`, `src/lib/actions/quotes.ts` — retrofitted to use
  `sendLeadEmail`; `sendQuoteToCustomer` gains a `message` param and clears
  `pendingQuoteMessage`
- `src/lib/actions/lead-report.ts` — `generateClosingReport` restructured to forced
  tool-use; new `sendClosingMessage`
- `src/components/leads/send-quote-card.tsx` — new (replaces `send-quote-button.tsx`)
- `src/components/leads/closing-message-card.tsx` — new
- `src/app/(app)/leads/[id]/page.tsx` — mounts both new cards
- `src/app/(app)/calendar/page.tsx` — new month-grid calendar page, with a week-view toggle
- `src/components/app-shared.tsx` — new "Calendar" nav entry
