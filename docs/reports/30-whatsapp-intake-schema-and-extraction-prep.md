# 30 — WhatsApp Intake, Phase 1: Schema + Extraction Prep

## What I did

First phase of WhatsApp intake, scoped to only what has zero dependency on
Meta credentials (the account/app/business-verification setup is still
outstanding on the user's side): added `WHATSAPP` to the `LeadSource` enum,
and generalized the AI extraction pipeline (`extract-enquiry.ts`) so it can
produce WhatsApp-appropriate output via a new `whatsapp` mode. No webhook,
no send-side integration, no UI — those all depend on real Meta credentials
that don't exist yet.

## Main decisions / findings

- **Confirmed most of the intake pipeline is already channel-agnostic** —
  read through `lead-matching.ts`, the `Lead`/`Message` schema, and the
  `PendingReplyCard`-style send pattern before touching anything, and found
  no code changes were actually needed in `lead-matching.ts`: its
  `{ email?, phone? }` contact shape already fits WhatsApp's phone-only
  contact exactly as-is.
- **No shared intake orchestrator exists today** — `email-intake.ts`
  (simulator) and `gmail/intake-runner.ts` (real Gmail) hand-duplicate the
  same extract → match → branch logic; there's no generic
  `intake-runner.ts`. Deliberately didn't extract one now: a WhatsApp
  webhook's real payload shape (and how much of it maps onto the existing
  duplication) isn't known without Meta credentials to test against, so
  guessing at the right abstraction now risks building the wrong one. That
  decision — third hand-duplicate vs. finally sharing an orchestrator — is
  deferred to when the webhook is actually built.
- **Fixed a latent wording bug while generalizing, not just prepping for
  WhatsApp.** The `acknowledgment_message` tool field's description said
  "the ENTIRE **email body**" — but this tool schema is shared across every
  mode's API call, including `simulated`, which never sends email. Changed
  to "the ENTIRE **message**", which is more accurate for the current
  channels too, not just the new one.
- **New `whatsapp` mode mirrors `real`'s "contact info already known"
  framing** — a WhatsApp webhook payload always carries the sender's phone
  number, same certainty as email's From header — but rewrites the tone
  guidance for how people actually text: 1-2 short, conversational
  sentences, no email-style greeting/sign-off. Verified this actually
  changes model behavior, not just prompt wording, by running two real
  extraction calls against the new mode (see Outcome below).
- **Bundled small doc-comment generalizations into the same schema edit** —
  `suggestedLineItems`, `pendingReplyText`, `Message.externalId`, and
  `NotificationType.REPLY_SEND_PENDING` all had comments hardcoded to
  "email"/"Gmail" that are now slightly wrong with a second channel in the
  schema. Comment-only, no migration impact, direct fallout of the same
  change.
- **`LEAD_SOURCE_LABELS` in `pipeline.ts`** needed a `WHATSAPP` entry too —
  caught by `tsc`, not something I'd scoped in the plan, but a genuinely
  required one-line addition since that map is typed `Record<LeadSource,
  string>` and feeds the existing (already-built) leads-by-source dashboard
  chart.

## Outcome

Ran the new `whatsapp` mode directly against two real sample messages:

- A complete message (name, phone, vehicle, and issue all present) produced
  a short, casual `acknowledgment_message` ("Thanks Ahmed! Sounds like your
  brake pads may need attention — we've put together a quote...") with
  `draft_reply` correctly left empty, and grounded `suggested_line_items`.
- A vague message ("hey do you guys do car stuff") produced a short,
  conversational `draft_reply` ("Yep, we sure do! What's going on with your
  car...") with `acknowledgment_message` correctly left empty — confirming
  the mutual-exclusivity gating still holds under the new mode.

Both outputs read distinctly more like a text message than the `real`
mode's email-toned drafts, confirming the prompt change had the intended
effect and not just cosmetic wording.

`npx tsc --noEmit` and `npm run lint` both clean. Full Playwright suite run
twice: first pass had 9/10 green with one failure
(`pipeline.spec.ts`'s vehicle-details step) preceded by a `WebServer:
destination stream closed early` log — re-ran that spec alone and it passed
cleanly, confirming a one-off dev-server hiccup rather than a regression
from the tool-schema wording change. Checked the 8 most recent `Lead` rows
in the live DB afterward — nothing from any test run leaked in.

## Files touched

- `prisma/schema.prisma` — `LeadSource.WHATSAPP`; generalized doc comments
  on `suggestedLineItems`, `pendingReplyText`, `Message.externalId`,
  `NotificationType.REPLY_SEND_PENDING`
- `prisma/migrations/20260830180229_lead_source_whatsapp/` — new
- `src/lib/intake/extract-enquiry.ts` — genericized
  `acknowledgment_message` tool description; new `whatsapp` mode in
  `SYSTEM_PROMPTS`
- `src/lib/pipeline.ts` — `LEAD_SOURCE_LABELS.WHATSAPP`

## Next step

Nothing further until the Meta developer account/app/test number exists.
Once it does: build the webhook route (`/api/webhooks/whatsapp` or
similar) with signature verification, decide the shared-orchestrator
question flagged above using the real webhook payload shape, add a
`sendLeadWhatsApp`-equivalent send helper (Meta Graph API — no email-style
`subject`/`attachment` concepts, quote PDFs need a media-message
equivalent), and a WhatsApp-flavored `PendingReplyCard` counterpart. The
`whatsapp` extraction mode built here is ready for the webhook to call as
soon as it exists.
