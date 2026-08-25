# 09 — Service Scheduling, In-App Notifications, and Lead Continuity

## What was done

Follow-up to report 08. Four asks from user feedback after trying the quote-drafting
demo:

1. Send the quote email to the customer once an employee approves it.
2. Redefine "Won" — the user wanted it to mean the service was completed and the car
   returned, with an explicit scheduling step in between.
3. In-app notifications for approval-style actions, instead of requiring staff to sit
   on a specific page.
4. A new email/message from a customer who already has a lead should continue that
   lead, not create a duplicate.

## Key decisions

- **Real email delivery deferred by explicit user choice** ("build the flow, skip real
  delivery" — no Gmail/SMTP/Resend credentials exist yet). Built `src/lib/email/send.ts`
  as an isolated stub (`sendEmail()` logs and returns `{ delivered: false, simulated:
  true }`); swapping in a real provider later is a one-file change. Everything around
  it — the approval click, the audit-trail `Activity`, the notification, `Quote.sentAt`
  — is fully wired now.
- **New `SCHEDULED` pipeline stage** between Quote Sent and Won
  (`QUOTE_SENT → SCHEDULED → WON`), requiring an actual date/time (captured via the
  same reason-code-style confirmation dialog `StageSelect` already used for Won/Lost).
  `Lead.scheduledAt` stores it; `Won` now means the appointment happened and the car
  was returned, not just that the quote was accepted. Existing reason codes and
  analytics were left as-is — they still read correctly under the new meaning.
- **Notifications are a real, queryable model** (`Notification`: leadId, type, message,
  read), not just client-side state — deliberately, so "needs your attention" survives
  a closed tab. Wired the header's already-present (but previously non-functional)
  bell icon to a polling dropdown (`src/components/notification-bell.tsx`, 15s
  interval) listing unread items linking to the lead. Two triggers wired so far:
  quote generated (`QUOTE_SEND_PENDING`) and a new message landing on an existing lead
  (`NEW_MESSAGE`). Approving/sending marks the relevant notification read.
- **Lead continuity via email/phone matching**, not a stable message-thread ID — the
  simulator has no real email headers to key off of, so `processSimulatedEmail` looks
  up an existing lead by the *extracted* email (then phone) before creating a new one.
  If found: the new messages append to that lead's `Message` history, a `NOTE`
  Activity and a `NEW_MESSAGE` notification are created, and the existing lead's name
  is reused so the customer isn't asked to re-introduce themselves. Documented
  limitation: if a returning customer's message doesn't repeat their email/phone, this
  simulator has no way to recognize them (unlike a real inbox, which has a reliable
  From: header) — worth revisiting once real Gmail/WhatsApp intake exists.

## Outcome

Verified end-to-end via a standalone `tsx` script against the real Anthropic API and
dev database (no browser automation available in this environment): first contact
creates a lead; a second message from the same email appends to the same lead (1 lead,
2 messages, 1 `NEW_MESSAGE` notification, not a duplicate); walking a lead through
Qualified → Quote Sent → Scheduled (with a captured date) → Won produces a closing
report that correctly cites the appointment date; generating a quote creates a
`QUOTE_SEND_PENDING` notification, and calling the send action sets `Quote.sentAt`,
logs the (simulated, undelivered) send to the Activity feed, and resolves the
notification.

**One real bug caught and fixed during this pass:** `quotes.ts` (a server action) was
importing `formatQuoteNumber` from `quote-document.tsx`, which pulls in the entire
`@react-pdf/renderer` dependency — harmless under Next's bundler but broke a
standalone Node script trying to exercise the same code (`ERR_PACKAGE_PATH_NOT_EXPORTED`
from `@react-pdf/hyphenate`'s ESM exports map). Factored the trivial formatter out to
`src/lib/quote-number.ts` so quote-related server actions no longer transitively
depend on the PDF renderer at all — a real bundle-size/coupling fix, not just a
test-harness workaround.

`tsc --noEmit` and `npm run lint` both pass. Dev server restarted after each schema
migration (learned from report 07's incident) and smoke-checked via `curl`.

## Files touched

- `prisma/schema.prisma` — `SCHEDULED` stage, `Lead.scheduledAt`, `Notification` model
  + `NotificationType`, `Quote.sentAt`; 5 migrations
- `src/lib/pipeline.ts` — stage labels/transitions include `SCHEDULED`
- `src/lib/actions/leads.ts` — `updateLeadStage` captures `scheduledAt`
- `src/components/leads/stage-select.tsx` — appointment date/time dialog
- `src/lib/actions/email-intake.ts` — existing-lead matching, `NEW_MESSAGE` notification
- `src/lib/actions/quotes.ts` — quote notification, `sendQuoteToCustomer`
- `src/lib/email/send.ts` — new, stubbed email delivery
- `src/lib/actions/notifications.ts` — new, `getUnreadNotifications`/`markNotificationRead`
- `src/components/notification-bell.tsx` — new, wired into `app-header.tsx`
- `src/components/leads/send-quote-button.tsx` — new
- `src/lib/quote-number.ts` — new (extracted from `quote-document.tsx`)
- `src/app/(app)/leads/[id]/page.tsx`, `kanban-board.tsx`, `dashboard/page.tsx`,
  `funnel-chart.tsx` — SCHEDULED stage support, quote-send UI, scheduled-date display
