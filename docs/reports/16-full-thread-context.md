# 16 — Full Conversation Context for Real Gmail Intake

## What was done

Closed the context gap flagged while answering the user's question about multi-message
back-and-forth: real Gmail intake was triaging each inbound message using only that
message's own text, plus (as of report 14) a structured summary of already-drafted
quote items — never the actual prior conversation. A short, context-dependent reply
("yes that works for me") had nothing to resolve "that" against.

## Key decisions

- **Fetch the lead's prior `Message` history before calling the AI**, same ordering
  trick as report 14's suggestion-context fix — the lead lookup already happens before
  the AI call (real headers make the email known up front), so fetching its messages
  at the same time was free. Full thread (all prior messages + the new one, oldest
  first) replaces the single-message text sent to the model.
- **Found and fixed a second bug while wiring this up**: `sendPendingReply()`
  (report 13) never recorded the business's own sent reply as a `Message` — only
  `Activity` notes captured it, in human-summary form, not the raw text. That meant
  even with full-thread context, the model would only ever see the customer's half of
  the conversation. Now every approved reply is saved as a `Message` with
  `role: "BUSINESS"`, so the thread reconstruction is actually bidirectional.
- Kept the report-14 "already drafted" structured suggestion summary alongside the raw
  thread rather than replacing it — the two serve different purposes: prose context
  for understanding intent, a compact current-state summary so exact
  quantities/prices already agreed on don't get lost in a long narrative.

## Outcome

Verified the fix demonstrates real functional value, not just nicer prose. Called
`extractEnquiry()` directly with the same short reply ("Yes that works for me, see you
then!") twice — isolated vs. with the full 3-turn thread it was actually replying to:

- **Without context**: `is_enquiry: false` — the model reasonably read a bare
  confirmation with no new request as not an enquiry. Under the *old* code, this
  outcome triggers `skippedNotEnquiry` — meaning a real customer's confirmation reply
  would have been **silently discarded and never even recorded**, not just
  summarized poorly. This was a real, if not yet observed, data-loss bug, not merely a
  quality issue.
- **With context**: `is_enquiry: true`, with an accurate summary tying the confirmation
  back to the actual appointment being confirmed.

Confirmed live through the real `runGmailIntake()` path too: seeded "Sounds good,
thanks!" as a real follow-up email on the test lead's existing thread (rear tire
replacement + AC check already discussed) — correctly continued the lead
(`leadsContinued: 1`, not skipped) with a summary correctly referencing both prior
topics, none of which were present in the new message's own text. `tsc --noEmit` and
`npm run lint` clean.

## Files touched

- `src/lib/gmail/intake-runner.ts` — fetches and prepends prior `Message` history
  before calling `extractEnquiry`
- `src/lib/actions/reply.ts` — `sendPendingReply` now also records a `Message`
  (`role: BUSINESS`) for the sent reply
