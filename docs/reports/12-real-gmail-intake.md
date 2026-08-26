# 12 — Real Gmail Inbox Intake (IMAP)

## What was done

Replaced the "paste a message into the simulator" flow with real inbound intake: an
IMAP connection to the business's Gmail inbox (reusing the same App Password already
configured for sending — no OAuth/Google Cloud project needed), running unread messages
through the existing AI triage, and creating/continuing leads automatically. Two
trigger paths: a manual "Check Gmail now" button on `/leads` for local testing, and a
Vercel Cron route for production once deployed.

## Key decisions

- **IMAP + the existing App Password**, not OAuth2 — `imap.gmail.com:993`, same
  `GMAIL_USER`/`GMAIL_APP_PASSWORD` credential already proven working for sending
  (report 10). Removes a Google Cloud Console dependency the project's own deployment
  roadmap had assumed was needed.
- **Real intake never blocks on missing info** (per user decision) — unlike the
  simulator, a real email always has a reliable `From:` header, so a lead is always
  created/continued immediately. Name resolution falls back through: AI-extracted name
  → existing lead's name (if continuing) → the email's own display name → guessed from
  the address → a bare placeholder — each non-reliable step flagged in the lead's note
  for staff to confirm, same transparency pattern as the existing
  name-inferred-from-email case.
- **Non-enquiry mail is skipped, not turned into a lead** (per user decision) — this
  mattered in practice: the first real run processed 5 unread messages sitting in the
  test inbox, 4 of which were the app's *own* earlier outbound quote-confirmation test
  emails (self-send artifacts from reports 10/11 testing) — all 4 were correctly
  recognized as not-a-customer-enquiry and skipped, while the one genuine new message
  was processed correctly.
- **Idempotency needs more than `\Seen`.** Added `Message.externalId` (the email's RFC
  `Message-ID` header, `@unique`) written in the same transaction as the lead
  create/update. `\Seen` is only set *after* a successful DB write (using imapflow's
  default `BODY.PEEK` fetch, which doesn't mark messages read on its own), and a
  duplicate-processing race is caught via Prisma's `P2002` unique-constraint error
  rather than trusted to flag timing alone.
- **Shared a light refactor with the simulator** rather than duplicating the AI call:
  extracted the Anthropic client/tool schema (`src/lib/intake/extract-enquiry.ts`,
  `mode: "simulated" | "real"` only varies the system prompt) and the lead-matching /
  suggestion-merging helpers (`src/lib/intake/lead-matching.ts`) so both paths can't
  drift apart on the parts that are genuinely identical, while keeping each path's
  control flow (the simulator's `needs_info` dead-end vs. real intake's always-create)
  separate since they're deliberately different.
- **Added a `NEW_LEAD` notification type** (fired for both real intake and, as a small
  consistency follow-up, the simulator's new-lead branch too) — previously only
  continuations and quote-sends surfaced a notification; a wholly new, unattended lead
  arriving from real email is exactly the case most worth surfacing in the bell.

## Outcome

Hit one infrastructure surprise: `prisma migrate deploy` itself couldn't reach the
Neon Postgres database (`P1001`) on this machine, even though the app's own `pg`-based
connection (same credentials) worked fine — traced to the hostname resolving to both
IPv4 and IPv6 addresses, with Prisma's native migration engine apparently unable to
route over IPv6 on this network while Node's driver falls back to IPv4 automatically.
Forcing `--dns-result-order=ipv4first` didn't help (the Rust engine does its own DNS
resolution, not through Node's). Worked around it by applying both migrations' DDL
directly via a raw `pg` script and manually inserting matching rows into Prisma's
`_prisma_migrations` tracking table (correct SHA-256 checksums included) so the
migration history stays consistent for any environment where `prisma migrate deploy`
does work normally (e.g. Vercel's build).

Verified end-to-end against the real Gmail inbox and Postgres database: seeded a real
test message via the already-working `sendEmail()`, confirmed it was correctly parsed,
matched to the right existing lead by the real sender address, and recorded with a
real `Message-ID`; ran intake again immediately and confirmed 0 messages reprocessed
(the `\Seen` exclusion + `externalId` uniqueness both hold); verified the manual
"Check Gmail now" button's actual server action end-to-end (the underlying data writes
succeeded; `revalidatePath` itself only fails outside a live Next request context, the
same harness-only limitation noted in reports 09–11, not a real bug); verified the
cron route's `CRON_SECRET` auth guard rejects both a missing and an incorrect header.
`tsc --noEmit` and `npm run lint` both clean.

**Not independently tested this pass:** the brand-new-lead creation branch via real
IMAP specifically — the test Gmail account can only send to itself, and its one
existing match (a real "Sarah Kim" test lead already in the shared dev database) meant
every self-sent test message matched that lead rather than creating a new one.
Deleting that lead just to force a fresh match would have destroyed real accumulated
test history, so instead verified the one genuinely new piece of that branch (the
`NEW_LEAD` notification enum value) narrowly at the database level, and relied on the
new-lead transaction shape being otherwise identical to the simulator's already
extensively-tested equivalent.

## Files touched

- `src/lib/intake/extract-enquiry.ts`, `src/lib/intake/lead-matching.ts` — new, shared
  logic extracted from `email-intake.ts`
- `src/lib/actions/email-intake.ts` — refactored to use the shared modules; also fires
  `NEW_LEAD` now
- `src/lib/gmail/imap-client.ts`, `parse-message.ts`, `intake-runner.ts` — new, the
  IMAP fetch/parse/triage engine
- `src/lib/actions/gmail-intake.ts` — new, `checkGmailNow()` server action
- `src/components/leads/gmail-check-button.tsx` — new, wired into
  `src/app/(app)/leads/page.tsx`
- `src/app/api/cron/gmail-intake/route.ts`, `vercel.json` — new, the production trigger
- `prisma/schema.prisma` — `Message.externalId`, `NotificationType.NEW_LEAD`; two
  migrations (`message_external_id`, `notification_new_lead`)
- `package.json` — added `imapflow`, `mailparser`, `@types/mailparser`
- `.env` — added `CRON_SECRET` (local testing only; needs setting in Vercel too before
  the cron route will work there)
