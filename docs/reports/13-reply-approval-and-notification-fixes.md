# 13 — Reply Approval, Notification Mark-as-Read, and a Name Bug

## What was done

Real-world use of report 12's Gmail intake surfaced a lead named literally `<UNKNOWN>`,
and highlighted that the AI's clarifying-question draft had nowhere to go — it just
sat inert inside an Activity note. Two feature requests plus a bug fix:

1. Fixed `<UNKNOWN>`-style names leaking into the database.
2. Added a real "Accept & send" flow for the AI's drafted clarifying reply.
3. Added per-item and bulk "mark as read" to the notification bell.

## Key decisions

- **The bug wasn't really about intake — it was trusting the model's own escape
  hatch.** The tool schema asks for an empty string when a name is unknown; the model
  instead returned the placeholder text `"<UNKNOWN>"`, which is truthy and sailed past
  the "was a name extracted?" check. Root cause turned out mundane: the actual email
  had an **empty body** (subject-only), so the model had nothing to work with — its
  response was reasonable, the bug was in not normalizing it. Added
  `isPlaceholderText()` (`src/lib/validation.ts`) catching `<unknown>`, `n/a`, `none`,
  `null`, and similar, applied to both `name` and `company` in both intake paths
  (`email` and `phone` were already implicitly protected — `isValidEmail`/`isValidPhone`
  would reject a placeholder string as invalid format on their own).
- **Reply approval scoped to real Gmail intake only**, not the simulator — the
  simulator's approve-and-continue loop already handles this in-browser without a
  persisted "pending reply" concept, and can't always guarantee a real recipient the
  way real intake always can. Mirrors the existing Quote-send pattern closely:
  `Lead.pendingReplyText` (populated/cleared the same lifecycle way
  `suggestedLineItems` already works, but *replaced* not merged — a reply is one
  current draft, not an accumulating list), a `REPLY_SEND_PENDING` notification, and
  `sendPendingReply()` mirroring `sendQuoteToCustomer()`'s exact shape (real-failure
  vs. simulated-vs-configured distinction, audit-trail `Activity` note, notification
  resolution).
- **Accept is editable, not blind-send** (per user decision) — `PendingReplyCard`
  shows the draft in an editable `Textarea` before "Accept & send," same pattern as
  quote line items being editable before "Generate quote."
- **Notification mark-as-read** needed restructuring away from "the whole row is a
  Link" — added a small trailing icon-button per notification (stops propagation so it
  doesn't also navigate) plus a "Mark all read" action next to the list header. Traded
  away Base UI `Menu.Item`'s built-in keyboard arrow-navigation for these rows (now
  plain flex `div`s so two independently-clickable regions can coexist) — accepted as
  a reasonable tradeoff for a notification list, which behaves more like an inbox than
  a strict command menu anyway.

## Outcome

Verified end-to-end against the real Gmail inbox and Postgres database: seeded a
genuinely ambiguous test message ("do you do transmission fluid changes, how much"),
confirmed the AI drafted a clarifying reply, confirmed it landed in
`Lead.pendingReplyText` with a `REPLY_SEND_PENDING` notification, confirmed the card
renders live on the lead page (checked via the actual running dev server's HTML, not
just the data layer), then ran `sendPendingReply()` with edited text and confirmed a
real email sent, `pendingReplyText` cleared, and the notification resolved.
`markAllNotificationsRead()` verified directly (unread count dropped to 0).
`isPlaceholderText()` unit-checked against `<UNKNOWN>`, `N/A`, `None`, `null`, and real
names. `tsc --noEmit` and `npm run lint` both clean.

Found and fixed the actual broken record from the reported screenshot: a real lead
(the user's own live test, sent from their personal Gmail to the business inbox) named
`<UNKNOWN>` with an empty message body — renamed it using the same fallback the fixed
code now applies automatically (guessed from the email address, flagged in a new
Activity note for confirmation), rather than leaving old bad data sitting there after
fixing the code path that created it.

**One thing flagged, not chased further:** the dev log showed a single
`PrismaClientKnownRequestError` from a real (not test-script) browser session polling
`getUnreadNotifications()`, about a minute after this session's dev-server restart
following the schema migrations. Couldn't reproduce — a direct re-check immediately
succeeded, and nothing recurred afterward despite continued real traffic. Most likely
a transient race during Turbopack's post-migration recompile, not an ongoing issue,
but noted here in case it resurfaces.

## Files touched

- `src/lib/validation.ts` — `isPlaceholderText()`
- `src/lib/actions/email-intake.ts`, `src/lib/gmail/intake-runner.ts` — apply the
  placeholder guard; `intake-runner.ts` also sets `pendingReplyText` +
  `REPLY_SEND_PENDING`
- `src/lib/actions/reply.ts` — new, `sendPendingReply()`
- `src/components/leads/pending-reply-card.tsx` — new, wired into
  `src/app/(app)/leads/[id]/page.tsx`
- `src/lib/actions/notifications.ts` — `markAllNotificationsRead()`
- `src/components/notification-bell.tsx` — per-item + bulk mark-read
- `prisma/schema.prisma` — `Lead.pendingReplyText`,
  `NotificationType.REPLY_SEND_PENDING`; two migrations
