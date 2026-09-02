# 36 — Fixed: Send Actions Threw Errors That Got Redacted in Production

## What happened

Testing the live WhatsApp webhook, clicking "Accept & send" on a WhatsApp
lead's AI-drafted reply crashed with **"Minified React error #441"**
instead of a real message. Looked up the actual meaning (React's own
public error-code mapping, since the minified text is useless on its own):

> An error occurred in the Server Components render. The specific message
> is omitted in production builds to avoid leaking sensitive details.

## Root cause

`sendPendingReply` correctly `throw`s `new Error("This lead doesn't have
an email address on file to reply to.")` when a lead has no email — exactly
what happens for every WhatsApp-sourced lead, since WhatsApp leads only
ever have a phone number. That's a completely expected, intentional
business-rule error, not a bug.

The problem: **Next.js redacts thrown Server Action error messages in
production** (confirmed against this exact installed version's own docs,
`node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`,
per `AGENTS.md`'s standing instruction to check the local docs rather than
assume). The docs are explicit: *"For [expected] errors, avoid using
try/catch blocks and throw errors. Instead, model expected errors as
return values."* Throwing is reserved for genuinely uncaught, unexpected
bugs (which get redacted on purpose, so internal details don't leak to
end users) — this app's `throw new Error(userFacingMessage)` pattern for
*expected* validation failures was exactly backwards per this Next.js
version's own model, and every environment this session tested against
was local dev (which never redacts), so the bug was invisible until now.

## Fix

Every `send*` action shares this exact same `!lead.email` throw (and the
same risk from `sendLeadEmail` itself throwing on delivery failure) — not
just `sendPendingReply`. Fixed the actual root cause everywhere it exists,
not just the one path that got reported:

- `sendPendingReply` (`reply.ts`)
- `sendQuoteToCustomer` (`quotes.ts`)
- `sendInvoiceToCustomer` (`invoices.ts`)
- `sendBookingMessage` (`scheduling.ts`)
- `sendClosingMessage` (`lead-report.ts`)

Each now returns `{ error: string } | undefined` instead of throwing for
both cases (empty message, no email on file) and wraps the `sendLeadEmail`
call in its own `try/catch` so a real delivery failure also returns
cleanly instead of throwing. Their five matching card components
(`PendingReplyCard`, `SendQuoteCard`, `SendInvoiceCard`,
`BookingMessageCard`, `ClosingMessageCard`) all had the identical
`try { await send...() } catch (err) { setError(...) }` pattern — updated
each to `const result = await send...(); if (result?.error)
setError(result.error);`.

## Verification

Recreated the exact failing scenario locally (a WhatsApp-sourced lead —
phone only, no email — with a pending reply) and clicked "Accept & send":
now shows the correct, clean message ("This lead doesn't have an email
address on file to reply to.") inline, no crash. `npx tsc --noEmit` and
`npm run lint` clean. Full Playwright suite — 10/10 (including
`pipeline.spec.ts`, which exercises `sendQuoteToCustomer`'s happy path,
confirming the refactor didn't break normal sending).

## Files touched

- `src/lib/actions/reply.ts`, `quotes.ts`, `scheduling.ts`,
  `lead-report.ts`, `src/lib/actions/invoices.ts` — return `{ error }`
  instead of throwing
- `src/components/leads/pending-reply-card.tsx`,
  `send-quote-card.tsx`, `send-invoice-card.tsx`,
  `booking-message-card.tsx`, `closing-message-card.tsx` — read the
  returned result instead of catching a throw

## Risks / things to keep in mind

**This same pattern (throwing for expected/validation errors) exists
throughout the rest of the app** — login, employee management, invoice/
quote creation validation, business settings, catalog CRUD, and more all
throw plain `Error`s for expected failures the same way these five did.
Every one of them will show this same generic redacted message in
production the first time a user actually triggers that specific
validation path live. Scoped this fix to the five `send*` actions because
they're the ones a WhatsApp lead (no email) is guaranteed to hit
immediately and repeatedly — not because the rest of the app is exempt
from the same bug. Worth a dedicated pass auditing every other thrown
`Error` in a server action, converting each to the same return-value
pattern, as a follow-up.

## Also flagged, not a bug

The user also asked about a `$0` unit price the AI suggested for "rear
tire replacement." Checked the demo catalog (`prisma/seed.ts`) — it has
"Tire rotation" but no "Tire replacement" entry, so the AI had nothing to
ground a price estimate on and returned `0` rather than fabricate a
number. This is the review-before-send design working as intended (the
line-item form is explicitly editable *because* AI estimates need
checking before a quote goes out) — not a code defect. If this class of
job comes up often, the real fix is adding a "Tire replacement" line to
the service catalog via `/settings` so future estimates have something
real to ground on, not a code change.
