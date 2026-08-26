# 10 — Real Gmail Sending for Quotes

## What was done

Wired up real email delivery for the "Send to customer" flow built in report 09,
replacing the stubbed `src/lib/email/send.ts`. Scoped to sending only (not inbound
Gmail intake, which stays a separate, larger piece — see report 05).

Mid-task, discovered a concurrent session had migrated the app's database from local
SQLite to a hosted Neon Postgres instance (`prisma/schema.prisma` datasource, `.env`
`DATABASE_URL`, `src/lib/db.ts`'s adapter, and a fresh `prisma/migrations/` history —
see report 08-postgres-migration.md). Paused to confirm with the user before touching
anything further, since it changed the ground under the DB-dependent parts of this
work; user confirmed it was intentional (their own other session) and asked to hold
off on live verification until it settled.

## Key decisions

- **Gmail App Password over OAuth2**, per the options laid out in report 05 — no
  Google Cloud project/consent screen needed, just 2-Step Verification + a generated
  16-character password. `nodemailer`'s `service: "gmail"` transport handles the SMTP
  details.
- **Graceful fallback preserved.** `sendEmail()` only builds a real transport if both
  `GMAIL_USER` and `GMAIL_APP_PASSWORD` are set; otherwise it still returns the old
  `{ delivered: false, simulated: true }` shape. Nothing broke for the window between
  writing the code and the credentials actually being configured.
- **A real send failure is now distinguished from "not configured yet."** Previously
  any non-delivery looked the same. Now `sendQuoteToCustomer` only marks a quote
  `sentAt`/resolves its notification on success or the known-simulated case — a genuine
  provider error is surfaced back to the `SendQuoteButton` instead of being silently
  recorded as sent.
- **Extracted PDF rendering into `src/lib/pdf/render-quote.ts`**, shared by the
  download route and the new send path (which needs the PDF as an email attachment,
  not just a downloadable response) — avoids duplicating the `renderToBuffer`/
  `QuoteDocument` setup.

## Outcome

Verified in two parts rather than one combined test, because `sendQuoteToCustomer` now
transitively imports `@react-pdf/renderer` (needed for the attachment), which hits the
same `@react-pdf/hyphenate` ESM-exports issue under a standalone `tsx` script noted in
report 09 — a test-harness limitation, not an app bug:

- **Gmail credentials**: called `sendEmail()` directly (no PDF import) with a real
  attachment — delivered successfully to the configured Gmail address.
- **PDF rendering under Postgres**: created a real `Quote` row via Prisma, then fetched
  it through the actual running dev server's `/api/quotes/[id]/pdf` route — 200,
  valid single-page PDF, confirming `src/lib/db.ts`'s Postgres switch had already been
  picked up by the dev server without a restart (it's a normally-watched `src/` file,
  unlike the generated Prisma client from earlier incidents).
- Both pieces are simple, type-checked function composition in
  `sendQuoteToCustomer` — Gmail send and PDF render independently confirmed working is
  sufficient confidence without forcing a combined test through a workaround.

Test leads/quotes created for verification were deleted immediately after; confirmed
zero stray rows remain. `tsc --noEmit` and `npm run lint` both pass. Did not restart
the dev server or run anything destructive against the shared Postgres DB beyond the
explicitly-cleaned-up test rows, per the user's hold-off request.

## Files touched

- `src/lib/email/send.ts` — real `nodemailer` Gmail transport with fallback
- `src/lib/pdf/render-quote.ts` — new, shared PDF-rendering helper
- `src/app/api/quotes/[id]/pdf/route.ts` — simplified to use the shared helper
- `src/lib/actions/quotes.ts` — `sendQuoteToCustomer` attaches the real PDF, sends
  from the business name, distinguishes real failure from simulated
- `src/components/leads/send-quote-button.tsx` — surfaces a send error inline
- `package.json` — added `nodemailer`, `@types/nodemailer`
