# 11 — Fixing the AI-Suggested Quote Draft Lifecycle

## What was done

Two bugs reported against the AI-suggested quote line items feature (report 08),
both surfaced by real testing rather than found in review:

1. **Merged-message suggestions were silently dropped.** When a new message matched
   an existing lead (report 09's continuity feature), `processSimulatedEmail` still
   computed `suggested_line_items` from the AI but never applied them to the lead —
   only the brand-new-lead code path did. Fixed by computing the suggestion once and
   applying it on both paths, merging (appending, not replacing) into whatever was
   already drafted so an earlier symptom isn't lost if a later message doesn't repeat
   it. Capped at 8 items.
2. **The merge fix above still didn't show up in the UI for one specific lead** — the
   actual root cause. The lead detail page only ever displayed
   `lead.suggestedLineItems` when `lead.quotes.length === 0`, so once *any* quote
   existed on a lead, every future AI suggestion from later messages was correctly
   stored in the database but never rendered — a real design flaw, not a repeat of bug
   1. `suggestedLineItems` wasn't tracking "has this draft been acted on," it was
   conflated with "has this lead ever had a quote."

## Key decisions

- **`suggestedLineItems` is now a proper pending-draft flag, not gated by quote
  history.** `createQuote` clears it to `null` the moment staff generates a quote from
  it (the draft has been acted on). The lead page's display condition simplified to
  just `Boolean(lead.suggestedLineItems)` — no more quote-count check needed, since
  presence now unambiguously means "there's an unacted-on draft." A later message can
  populate a fresh draft even on a lead that already has quotes, which is exactly the
  real scenario that surfaced this (a returning customer describing a second, unrelated
  issue after already receiving one quote).

## Outcome

Verified against the real Postgres DB and running dev server via a temporary debug
route (removed after): confirmed a draft populates on first contact, clears the moment
`createQuote` runs, and a subsequent message about a different issue populates a fresh
draft — all on the same lead, quote history notwithstanding. Also re-verified the
report-09 merge fix in isolation (two messages, two different symptoms, both ended up
in the merged draft, still one lead). `tsc --noEmit` and `npm run lint` both clean.

One pre-existing real lead in the shared dev DB ("Sarah Kim" test data) still carries
stale/duplicated suggested items from before this fix — harmless (editable/removable
in the quote form, and will clear itself the next time a quote is generated from it)
but not proactively cleaned up, since it's the user's own test data.

## Files touched

- `src/lib/actions/email-intake.ts` — suggestion computed once, applied + merged on
  both the new-lead and continuing-lead paths
- `src/lib/actions/quotes.ts` — `createQuote` clears `suggestedLineItems` once used
- `src/app/(app)/leads/[id]/page.tsx` — display condition no longer checks quote count
