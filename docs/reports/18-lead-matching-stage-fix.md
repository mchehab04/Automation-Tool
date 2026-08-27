# 18 — Stage-Aware Lead Matching (Stop Reopening WON/LOST Leads)

## What was done

Fixed a bug the user spotted while reviewing lead-matching behavior: `findExistingLeadByContact()`
(`src/lib/intake/lead-matching.ts`), used by both real Gmail intake and the in-app
simulator to decide "continue an existing lead vs. create a new one," matched purely on
`businessId` + `email`/`phone` with no `stage` awareness. A customer whose earlier lead had
already closed `WON` or `LOST` and who emailed again about something new got silently
appended to the already-closed lead instead of starting a fresh one.

## Key decisions

- **`findExistingLeadByContact` now excludes closed leads** (`stage: { notIn: ["WON", "LOST"] }`
  on both its email and phone queries, via a shared `CLOSED_STAGES` constant) — it only ever
  returns an open lead to continue.
- **New `findMostRecentClosedLead()`** mirrors the same email-then-phone lookup, scoped to
  `stage: { in: CLOSED_STAGES }`, ordered by `updatedAt: "desc"` (a customer could have
  multiple past closed leads — use the most recent). Called only in each intake path's
  create-branch, only when there's no open lead, purely to link and prefill — never to
  append messages to.
- **New `Lead.previousLeadId` self-relation** (`onDelete: SetNull`, explicit rather than
  default), so a follow-up lead is traceably linked to the customer's prior closed
  engagement rather than being a disconnected new row. Confirmed leads are never deleted
  anywhere in the app today (grepped for `prisma.lead.delete`/`deleteMany` — only generated
  client boilerplate matched), so `SetNull` is mostly a theoretical choice made for
  correctness if that ever changes, not a currently-exercised path.
- **Name/company prefill from the closed lead**, same convenience the existing
  `existingLead?.name` fallback already gave continuing leads — added as a new fallback
  tier in both intake paths' name chains, plus (new) a company fallback that didn't exist
  before at all (company previously had no cross-lead fallback, even for open leads).
- **Real bug caught during verification, not by inspection**: my first pass wrote the
  company fallback as `!isPlaceholderText(companyRaw) ? companyRaw : closedLead?.company`.
  `isPlaceholderText("")` is `false` (it only matches specific placeholder phrases, not
  genuine emptiness), so a message that simply doesn't mention a company — the normal case
  for a short follow-up — sailed through as `company: ""` instead of ever reaching the
  fallback. Fixed by requiring `companyRaw` to be truthy first:
  `companyRaw && !isPlaceholderText(companyRaw) ? ... : closedLead?.company || ""`. Applied
  to both `intake-runner.ts` and `email-intake.ts`.
- **Flagged, not fixed (out of scope)**: `intake-runner.ts`'s existing `existingLead?.name`
  fallback tier is unreachable dead code — `name` is only read in the create-branch, which
  by definition only runs when `existingLead` is falsy, so that tier can never fire. Predates
  this change; left untouched per the plan's scope, noted here for the record.
- **Minimal UI addition** on the lead detail page (`src/app/(app)/leads/[id]/page.tsx`):
  if a lead has a `previousLead`, a small line links back to it; if a lead has
  `followUpLeads`, a small line lists them. Reuses the page's existing `Link`/`STAGE_LABELS`
  imports, no new component.
- **Migration via the established raw-pg workaround** (reports 08, 17): `prisma migrate dev`
  failed with the same `P1001` seen every time on this machine; hand-wrote the
  `AlterTable`/`CreateIndex`/`AddForeignKey` SQL, applied via a raw `pg.Pool` script after
  re-verifying the checksum algorithm against the most recent existing migration row, and
  hand-inserted the `_prisma_migrations` bookkeeping row.

## Outcome

- Read-only sanity check against the real test mailbox's contact
  (`test.automation.tool1@gmail.com`, the LOST "Sarah Kim" lead): `findExistingLeadByContact`
  now correctly returns `null`; `findMostRecentClosedLead` correctly returns her lead. No
  side effects — her real data was untouched.
- End-to-end test via the simulator on a throwaway contact: first message created a new
  lead (brake pad quote); marked it `LOST`; second message (battery replacement, same
  email, no name restated) correctly created a **second, distinct** lead rather than
  appending to the closed one — confirmed exactly 2 leads exist for that email, not 1.
  The new lead's `previousLeadId` pointed at the closed lead; name/company were correctly
  prefilled from it; its initial note read *"Name and company carried over from a previous
  (closed) lead... This customer has a previous lead that closed as Lost — linked as
  history."*; the closed lead's `followUpLeads` reverse relation correctly listed the new
  lead.
- Regression check: a second throwaway contact left at the default `NEW` stage, sent a
  follow-up message — confirmed it still continued the same lead (exactly 1 lead for that
  email, unchanged from today's existing behavior for open leads).
- All throwaway test leads deleted afterward. `tsc --noEmit` and `npm run lint` both clean.

## Files touched

- `prisma/schema.prisma` — new `Lead.previousLeadId`/`previousLead`/`followUpLeads`
  self-relation, `@@index([previousLeadId])`
- `prisma/migrations/20260827134529_lead_previous_lead_link/migration.sql` — new
- `src/lib/intake/lead-matching.ts` — `CLOSED_STAGES` constant, `findExistingLeadByContact`
  now stage-filtered, new `findMostRecentClosedLead`
- `src/lib/gmail/intake-runner.ts` — closed-lead lookup, name/company prefill, linkage note
  and `previousLeadId` on create
- `src/lib/actions/email-intake.ts` — same, for the simulator path
- `src/app/(app)/leads/[id]/page.tsx` — query extended with `previousLead`/`followUpLeads`,
  small linkage UI in the header
