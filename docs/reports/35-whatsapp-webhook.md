# 35 — WhatsApp Intake, Phase 2: Live Webhook

## What I did

Wired the actual WhatsApp webhook so real inbound messages create/update
leads — the receiving half of WhatsApp intake. Phase 1 (report 30) had
already built everything reusable for this (`LeadSource.WHATSAPP`, the
`"whatsapp"` extraction mode, channel-agnostic lead matching); this phase
is the webhook route plus the intake-processing logic that calls it.

Scoped to receiving only, stated plainly rather than silently built:
no outbound WhatsApp sending yet. The AI's draft reply/acknowledgment still
lands in the existing `pendingReplyText`/`pendingQuoteMessage` fields, so
staff see the draft on the lead same as with email — they just can't
one-click-send it via WhatsApp until a `sendWhatsAppMessage` helper and
WhatsApp-flavored send UI get built as a real follow-up.

## Main decisions / findings

- **Zero schema changes** — everything Phase 1 built (the `WHATSAPP` enum
  value, `Message.externalId`, `lead-matching.ts`'s phone-based lookup) was
  already generic enough to reuse untouched.
- **`whatsapp/intake-runner.ts` mirrors `gmail/intake-runner.ts`'s
  `processOneMessage` closely** rather than sharing an abstraction with it
  — the two have almost no actual overlap once you strip out email's
  IMAP-specific half (mark-seen, mailbox search, streaming), so a shared
  function would mostly be conditionals for parts that don't apply to a
  webhook at all. A third close-but-independent implementation was the
  right call here, matching what report 30 already flagged as the decision
  to make once a real payload shape existed.
- **Signature verification fails closed** — no `WHATSAPP_APP_SECRET`
  configured → `500`, not "process anyway." Same policy as the existing
  Gmail cron route's `CRON_SECRET` check, for the same reason: this is a
  public endpoint that writes to the database, so trusting an unverified
  POST would let anyone inject fake leads.
- **Failures return 500, not 200** — Meta's own webhook retry mechanism is
  the safety net for transient failures (a DB blip), so no bespoke retry
  queue was built. Duplicate/already-processed messages (`P2002` on
  `Message.externalId`) are the one exception — handled as a normal no-op
  inside the intake runner itself.
- **No outbound send helper, no media-message handling** — neither is used
  by anything in this pass. Skipped rather than built speculatively.

## Outcome

No public HTTPS URL exists yet to receive a *real* WhatsApp-to-webhook
delivery from Meta's servers (that needs a deployment first) — everything
below was verified locally against the real dev server and DB, computing
webhook payloads and HMAC signatures the same way Meta actually does:

- GET handshake: correct `hub.verify_token` echoes `hub.challenge` back
  (200); wrong token → 403.
- POST with a correctly-computed `X-Hub-Signature-256` → processed (200);
  wrong signature → 401; missing signature → 401; `WHATSAPP_APP_SECRET`
  unset entirely → 500.
- A real webhook-shaped payload (name, vehicle, and request all in the
  message text) created a real lead: `source: "WHATSAPP"`, phone correctly
  normalized to `+971501234567`, vehicle correctly extracted, and
  `pendingQuoteMessage` populated with a genuinely short, WhatsApp-toned
  acknowledgment (not email-style) — confirms the Phase 1 `"whatsapp"`
  extraction mode is actually reachable end-to-end through this new path,
  not just independently testable.
- Re-sent the identical payload (same `wamid` message ID) — confirmed no
  duplicate lead or `Message` row (idempotency via `Message.externalId`
  actually works against a webhook re-delivery, not just in theory).
- Sent a second, different message from the same phone number — confirmed
  it continued the existing lead (still 1 lead for that phone) rather than
  creating a second one, and the AI correctly merged a new suggested line
  item (a brake check) alongside the original oil-change one.

`npx tsc --noEmit` and `npm run lint` clean. Full Playwright suite: 9/10 on
the first run (`pipeline.spec.ts` hit the same cold-server-first-run flake
already documented in reports 30/31 — confirmed not a regression by
re-running it alone, which passed).

## Files touched

- `.env.example`, `.env` — `WHATSAPP_ACCESS_TOKEN`,
  `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` (blank locally — not
  yet obtained), `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (generated one)
- `src/lib/whatsapp/intake-runner.ts` — new, `processWhatsAppMessage`
- `src/app/api/webhooks/whatsapp/route.ts` — new, GET handshake + POST
  signature verification and processing
- `src/proxy.ts` — matcher excludes `api/webhooks` alongside the existing
  `api/cron` carve-out

## Live verification (post-deploy)

The user deployed and configured the webhook in Meta's dashboard; two real
issues surfaced and got fixed, neither in code:

1. **Wrong URL initially** — the first callback URL tried was a Vercel
   *preview* deployment URL (has a random hash in it), which Vercel's own
   Deployment Protection (SSO) gates behind a login redirect before any
   request reaches app code. Fix: use the stable production domain
   (Vercel → Domains tab) instead.
2. **App Secret mismatch, then a real Meta-side gap** — after fixing the
   URL, verification succeeded but every real POST came back `401 Invalid
   signature`. Confirmed via Vercel's logs (`User-Agent: facebookexternalua`
   on the failing requests — genuinely Meta, not a local test) that Meta
   *was* delivering, just with a signature our secret didn't match.
   Re-copying/resetting the App Secret in Meta and updating Vercel fixed
   verification (confirmed via a temporary, minimal diagnostic log — no
   secret or HMAC output logged, just body length, Meta's own signature
   header, and a match boolean; removed once the fix was confirmed).
   After that, Meta's own **Test** button worked (200, real AI call ran)
   but real customer-sent messages still weren't arriving at all. Root
   cause: subscribing to the `messages` field in the **App's** webhook
   config only sets up the app's side — the **WhatsApp Business Account**
   must separately be told to forward its events to that app, via
   `POST /{waba-id}/subscribed_apps` with the access token. This isn't
   exposed as a button in the current dashboard flow, only reachable via
   that direct Graph API call. Once run, a real WhatsApp message correctly
   created a lead: right name, phone normalized, vehicle extracted, and a
   genuinely relevant AI-drafted clarifying question
   (`pendingReplyText`) — the full pipeline confirmed working end-to-end
   against Meta's real infrastructure, not just simulated payloads.

`src/app/api/webhooks/whatsapp/route.ts` is back to its original form (the
temporary diagnostic logging was removed after the fix was confirmed).

## Next step

Outbound sending (a `sendWhatsAppMessage` helper, a WhatsApp-flavored
reply/quote send UI) is the natural next piece — not started here.
