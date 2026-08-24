# 02 — Reason Codes (from Chatroom Debate) + Form UX Pass

## What was done

Updated the existing Next.js/Prisma app (found already scaffolded at the project root, built outside this session — kanban board, lead detail pages, quote generation with PDF export) in two ways, scoped down from the full chatroom plan per explicit user direction (cheap high-value pieces only; no auth/multi-tenancy this pass):

**1. One-tap reason codes on Won/Lost** — the ML/Data Pragmatist agent's "single highest-leverage day-one investment" from the chatroom debate.
- Added `reasonCode String?` to the `Activity` model (migration `20260823155834_add_reason_code`).
- Added a fixed, per-stage reason vocabulary in `src/lib/pipeline.ts` (`REASON_CODES`) — 5 options for Won, 6 for Lost, deliberately no free text, matching the debate's explicit "one tap, no free text" UX directive.
- `StageSelect` now opens a dialog with one-tap reason buttons when a lead is moved to Won/Lost; the move doesn't commit until a reason is picked. Non-terminal moves are unchanged (instant).
- `updateLeadStage` server action rejects the transition if a terminal stage is requested without a valid reason code.
- The reason is shown inline in the lead's activity feed ("Moved to Lost — Price too high").

**2. Form UX pass**, applying 4 of the 6 user-specified UX notes (the other 2 — pre-fill if logged in, password requirements — don't apply yet, no auth exists):
- **Don't allow submit until valid, highlight required fields**: New-lead form, quote line items, and note form are now client components with per-field validation; submit buttons are disabled until the form is valid, and invalid fields get `aria-invalid` (which the existing design system already styles with a destructive border/ring).
- **Inline validation**: errors appear per-field after that field is touched (blur), not only on submit attempt.
- **Character counts**: added on every field with a length limit (name, company, note, quote line-item description) via a shared `FieldFooter` component.
- **Forgiving formatting**: phone numbers accept any punctuation (only digit count is checked); quote unit price/quantity inputs switched from strict `type="number"` to text + `inputMode`, so "$1,200.50" parses the same as "1200.50" instead of being unusable. Server actions apply the same parsing so client and server never disagree.

## Key decisions

- Did **not** implement multi-tenancy, auth, the full `lead_events` audit schema, or heuristic lead scoring in this pass — those are real infrastructure work and were explicitly deferred per the user's scope choice.
- Reused the existing `Activity` table for the reason code rather than introducing the chatroom's separate `lead_events` table — the existing schema already serves the same audit purpose at this stage; a dedicated event-sourcing table is a Phase 1+ concern once multi-tenancy work starts.
- Validation logic lives in one shared `src/lib/validation.ts`, imported by both client components and server actions, so client-side and server-side rules can't drift apart.

## Outcome

`tsc --noEmit` and `eslint` both pass clean. Dev server smoke-tested at `/dashboard`, `/leads`, `/leads/new` (all 200) after the changes. Did not run a full `next build` since the dev server was live and shares the `.next` cache.

## Files touched

- `prisma/schema.prisma`, new migration `prisma/migrations/20260823155834_add_reason_code/`
- `src/lib/pipeline.ts` — reason code vocabulary
- `src/lib/validation.ts` (new) — shared client/server validation helpers
- `src/lib/actions/leads.ts`, `src/lib/actions/quotes.ts`
- `src/components/leads/stage-select.tsx`, `quote-form.tsx`, `note-form.tsx`, `lead-form.tsx` (new)
- `src/components/forms/field-footer.tsx` (new)
- `src/app/(app)/leads/new/page.tsx`, `src/app/(app)/leads/[id]/page.tsx`
