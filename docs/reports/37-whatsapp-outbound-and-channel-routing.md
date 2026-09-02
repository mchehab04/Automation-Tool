# 37 — WhatsApp Outbound Sending + Channel Routing

## What I did

Real WhatsApp outbound sending, plus channel routing for every AI-drafted
message type per the rule the user specified:

- **Reply, booking-confirmation, Won/Lost thank-you** — sent via the
  **origin channel** (wherever the lead came from).
- **Quote, Invoice** — sent via **every available channel** (email if
  present, WhatsApp if present) — documents worth guaranteeing delivery
  on, not thread replies.

## Main decisions / findings

- **Raw `fetch` against Meta's Graph API, no SDK** — Node's built-in
  `fetch`/`FormData`/`Blob` (global since Node 18) cover both the plain
  text-message call and the two-step document-attachment flow (upload the
  PDF via `POST /{phone_number_id}/media` to get a media ID, then send a
  `type: "document"` message referencing it) — no new dependency.
- **`originChannel` vs `availableChannels`** (`src/lib/lead-channel.ts`) —
  two small, separate pure functions rather than one, since they're
  genuinely different rules (single channel vs. every channel), not
  variations of the same logic.
- **New `sendDocumentToAllChannels` shared helper** — `sendQuoteToCustomer`
  and `sendInvoiceToCustomer` would otherwise duplicate identical
  "attempt every available channel, aggregate per-channel results into one
  note, decide overall success" logic. Mirrors `sendLeadEmail`'s existing
  contract (absorbs the failure-path DB write + `revalidatePath`, returns
  a success note for the caller's own transaction), extended to multiple
  channels — overall success means *at least one* channel worked; the
  combined note always states each channel's outcome explicitly, so a
  partial failure stays visible in the Activity timeline even when the UI
  doesn't block on it.
- **`sendLeadWhatsApp`** mirrors `sendLeadEmail` exactly (throws on real
  failure, returns `{ delivered, simulated, note }` otherwise), so the
  three origin-channel actions could branch on channel without changing
  their surrounding try/catch → `{ error }` shape from report 36 at all —
  just which function gets called.

## Outcome

Verified against the real dev server, real database, and **real Meta Graph
API calls** (not simulated) — the existing `WHATSAPP_ACCESS_TOKEN` was
still valid:

- **Reply on a WhatsApp-only lead, unverified test number**: correctly
  routed to the WhatsApp branch, real API call made, real rejection
  received (`(#131030) Recipient phone number not in allowed list` — a
  Meta sandbox restriction, not a bug), and the exact Meta error message
  was written to the Activity feed and shown inline in the UI. Confirms
  the failure path is fully wired end to end, not just theoretically.
- **Reply on a WhatsApp-only lead, real verified test number**: genuinely
  delivered. Activity: `"Reply sent via WhatsApp to +971505769276."`,
  `pendingReplyText` correctly cleared.
- **Quote on a lead with both email and phone**: sent successfully via
  *both* channels in one call. Activity: `"Quote #000022 — emailed to
  channeltest@example.com; sent via WhatsApp to +971505769276."`, `sentAt`
  set. Confirms the two-step PDF-to-WhatsApp-document flow (media upload
  then document message) actually works against the real API, not just
  the plain-text path.
- **Invoice on a WhatsApp-only lead (no email)**: sent successfully via
  WhatsApp alone, no email attempt made. Activity: `"Invoice #000001 —
  sent via WhatsApp to +971505769276."`, `sentAt` set.
- Caught my own testing mistake along the way: an early batch-run test
  showed all three sends as silently doing nothing — turned out to be my
  own script's wait time being too short (a real PDF render + email send +
  two-step WhatsApp media upload legitimately takes 10-20 seconds, not the
  3-5 I first waited), confirmed by re-running each in isolation with a
  longer wait and a screenshot showing the button still mid-spinner at the
  5s mark. Not a code issue — worth noting since it looked like one at
  first.

`npx tsc --noEmit` and `npm run lint` clean. Full Playwright suite —
10/10, including `pipeline.spec.ts`'s existing email-only quote send,
confirming the new multi-channel path doesn't change behavior for a lead
with no phone on file.

## Files touched

- `src/lib/whatsapp/send.ts` — new (`sendWhatsApp`, `sendLeadWhatsApp`)
- `src/lib/lead-channel.ts` — new (`originChannel`, `availableChannels`)
- `src/lib/send-document.ts` — new (`sendDocumentToAllChannels`)
- `src/lib/actions/reply.ts`, `scheduling.ts`, `lead-report.ts` — branch on
  `originChannel` instead of assuming email
- `src/lib/actions/quotes.ts`, `invoices.ts` — use
  `sendDocumentToAllChannels` instead of `sendLeadEmail` directly

## Risks / things to keep in mind

- **`WHATSAPP_ACCESS_TOKEN` is still the temporary 24h user token.** It
  happened to still be valid during this test pass, but it will keep
  expiring daily until swapped for a permanent System User token (Meta
  Business Settings → System Users). When it expires, `sendWhatsApp` falls
  back to the same "simulated" behavior as an unconfigured/missing
  credential (matches `sendEmail`'s existing pattern) rather than crashing
  — but real messages won't go out until it's refreshed or replaced.
- Sending to a phone number that isn't on Meta's verified test-recipient
  list will fail with the exact Meta error surfaced in this report — that
  restriction lifts once the WhatsApp Business Account is fully live
  (business-verified), not something to fix in code.

## Next step

None queued — this closes out the WhatsApp intake + outbound work started
in reports 30, 35, and 36. Swapping in a permanent System User access
token is the main remaining operational (not code) task before relying on
this for real customers.
