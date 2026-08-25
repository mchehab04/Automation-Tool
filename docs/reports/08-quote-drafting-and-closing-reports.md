# 08 — Quote Drafting, Raw Message Storage, and Auto-Generated Closing Reports

## What was done

Follow-up to [06-email-intake-demo.md](06-email-intake-demo.md). Testing the demo
surfaced two real gaps and one confusing-but-not-a-bug observation:

- The Quotes section stayed empty after AI intake — expected (quoting was never in
  scope for the intake step), but worth making less of a dead end.
- The raw customer message wasn't stored anywhere, only the AI's summary — no way to
  audit what was actually said.
- A created lead showed different name/phone than the message the user described
  testing with — traced to the user testing with their own real details rather than
  the literal example text, confirmed by checking existing seed/manual lead data, not
  a code bug (the AI call never receives any identity data beyond the raw thread text).

Built: AI-drafted quote line-item suggestions, a stored raw-message transcript per
lead, and an automatically generated close-out report when a lead reaches Won/Lost.

## Key decisions

- **Quote suggestions are a draft, not an action.** `record_enquiry`'s tool schema now
  also asks for `suggested_line_items` (description + rough USD estimate) based only on
  what the customer described. These prefill the existing `QuoteForm` (only when the
  lead has zero quotes yet) with an "AI-suggested — review before generating" hint —
  staff still has to click "Generate quote" themselves. No new state machine, no
  auto-sent pricing.
- **Raw conversation gets its own model, not another Activity type.** Added
  `Message` (`role: CUSTOMER | BUSINESS`, `text`, `leadId`) alongside the existing
  `Activity` model rather than overloading `Activity.note` — keeps human-facing
  summaries (Activity) separate from source material (Message), and makes the
  transcript independently queryable/auditable.
- **Closing reports are grounded only in what's actually on record.** `generateClosingReport`
  (`src/lib/actions/lead-report.ts`) builds its prompt from real `Message`, `Activity`
  (notes only), and `Quote` rows for the lead — verified in testing that when a test
  script had a `QUOTE_GENERATED` activity note but no real `Quote` row, the AI correctly
  said "no quotes were recorded" rather than treating the stray note text as fact.
  Stored as a new `ActivityType.REPORT`, rendered in its own "Closing report" card on
  the lead page rather than mixed into the plain note feed.
- **Report generation runs synchronously inside `updateLeadStage`**, gated to WON/LOST
  transitions only, wrapped in try/catch so a report failure never blocks the actual
  stage change — there's no background job infra in this app, and a few seconds of
  added latency on a terminal-stage transition is an acceptable tradeoff for a demo.

## Outcome

Verified end-to-end against the real Anthropic API and dev database via standalone
`tsx` scripts (no headless-browser tool available in this environment, consistent with
report 06):

- Complete-info intake → lead created with `suggestedLineItems` populated and the full
  conversation persisted as `Message` rows.
- Walking a lead NEW → QUALIFIED → QUOTE_SENT → WON (with a reason code) → a `REPORT`
  activity is created, and its content only reflects real `Quote`/`Message` rows, not
  fabricated activity text.
- One test run's `revalidatePath` calls threw outside a live Next request context (expected,
  not a bug — `revalidatePath` requires the real server runtime) and masked the report
  step in that script; re-verified by calling `generateClosingReport` directly and by
  code inspection that `updateLeadStage`'s ordering is correct.

**Incident during testing:** a cleanup script's `deleteMany` matched on lead name and
accidentally deleted the real seed lead "Priya Nair" from `prisma/seed.ts` (not test
data — the name collided with a test scenario's name). Caught immediately by listing
leads before/after; restored by re-inserting that one seed record with its original
`stage`/`createdAt`/activities rather than re-running the full seed (which would have
duplicated the other 8 demo leads). All other leads confirmed intact afterward,
including the user's own manually-created and AI-created "Mohamad Chehab" leads.

`tsc --noEmit` and `npm run lint` both pass. Live dev server smoke-checked via `curl`
(200 on `/dashboard` and `/leads`).

## Files touched

- `prisma/schema.prisma` — added `Message`/`MessageRole`, `ActivityType.REPORT`,
  `Lead.suggestedLineItems`; migration `20260824212441_add_messages_and_reports`
- `src/lib/actions/email-intake.ts` — extended tool schema with `suggested_line_items`,
  persists `Message` rows on lead creation
- `src/lib/actions/lead-report.ts` — new, `generateClosingReport`
- `src/lib/actions/leads.ts` — `updateLeadStage` triggers the closing report on WON/LOST
- `src/components/leads/quote-form.tsx` — accepts `suggestedLineItems`, prefills rows
- `src/app/(app)/leads/[id]/page.tsx` — Conversation card, Closing report card, passes
  suggestions into `QuoteForm`
