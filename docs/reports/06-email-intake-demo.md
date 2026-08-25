# 06 — In-App Demo: Automatic Email Lead Intake with AI Triage

## What was done

The user tested the manual lead-entry flow and wanted a demo of *automatic* entry —
without waiting on the external Phase 0 no-code setup (n8n, Gmail API/Pub-Sub, Slack)
scoped in [05-email-intake-phase0-scoping.md](05-email-intake-phase0-scoping.md). Built
a self-contained in-app simulator instead: paste a customer email, real Claude
(`claude-sonnet-5`, tool-use forced to a `record_enquiry` schema) extracts contact
details, and the app auto-creates a `Lead` if there's enough info to reach the
customer, or drafts a follow-up question if not.

## Key decisions

- **Deterministic completeness gate, not model trust.** The model's own `is_enquiry`/
  `draft_reply` output is used, but whether a lead is actually created is decided in
  code: a name plus at least one of email/phone. The model can't accidentally skip the
  gate by mis-judging its own output.
- **Human-in-the-loop preserved even in the demo.** When info is missing, the AI's
  draft reply is shown for edit-and-approve before it's appended to the simulated
  thread — matching the human-in-the-loop principle from report 05, even though no real
  customer is ever contacted here.
- **No new infra.** Reused the `ANTHROPIC_API_KEY` already in `.env` (from the
  `scrape-leads` skill) and the already-scaffolded `LeadSource.EMAIL` enum value — no
  schema migration needed.
- Added a shared `LEAD_SOURCE_LABELS` map in `src/lib/pipeline.ts` (previously
  duplicated inline in the dashboard) and surfaced it as an "Email" badge on kanban
  cards and the lead detail page, so auto-created leads are visually distinguishable
  from manual ones.

## Outcome

Verified directly against the real Anthropic API and the dev SQLite database (no
headless-browser tooling was available in this Windows/Git-Bash environment, so the
server action was exercised via a standalone `tsx` script instead of a full
click-through — noted here per the "say so explicitly" rule):

- Complete-info message → lead created with correct name/phone and an audit `Activity`
  note.
- Missing-info message → returned a sensible drafted follow-up instead of creating a
  lead; supplying the missing info in a second turn then created the lead.
- Clearly irrelevant message (spam) → classified as not an enquiry, no lead created.

Test leads created during verification were deleted afterward. `tsc --noEmit` and
`npm run lint` both pass. The dev server's rendered HTML for `/leads/simulate` and
`/leads` was checked directly (page text, buttons) since UI automation wasn't
available.

## Files touched

- `src/lib/actions/email-intake.ts` — new server action, AI extraction + creation gate
- `src/components/leads/email-intake-simulator.tsx` — new client component (chat-style
  simulator with approve-before-send)
- `src/app/(app)/leads/simulate/page.tsx` — new page
- `src/app/(app)/leads/page.tsx` — added "Simulate email intake" entry point
- `src/lib/pipeline.ts` — added `LEAD_SOURCE_LABELS`
- `src/app/(app)/dashboard/page.tsx` — use shared `LEAD_SOURCE_LABELS`
- `src/components/leads/kanban-board.tsx`, `src/app/(app)/leads/[id]/page.tsx` — source
  badge for non-manual leads
- `package.json` — added `@anthropic-ai/sdk`
