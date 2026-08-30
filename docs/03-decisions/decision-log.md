# Decision Log

Append-only. A decision that later gets reversed gets a *new* entry that says so and
points back — this file never edits history. Backfilled 2026-08-25 from the reports in
`docs/reports/`; every entry below cites the report it came from.

---

## Launch vertical: auto dealership

- **Date:** 2026-08-24
- **Context:** 5-agent chatroom debate on GTM strategy for the SME pipeline tool.
- **Reason:** Founder has network access to sign pilot #1 at a dealership. The GTM
  Strategist agent reversed their own initial pick once the group traced the argument
  through to "who actually signs the pilot" rather than which market is structurally
  cleanest.
- **Alternatives considered:** Home services / contractors — the GTM Strategist's
  original recommendation on market-structure grounds, dropped in favor of
  distribution access.
- **Risk / follow-up:** Conflates distribution access with product-market fit. Later
  narrowed — see "Vertical narrowed to car garage" below. Source:
  `docs/reports/01-idea-scoping-chatroom.md`.

## Vertical narrowed to car garage / auto maintenance

- **Date:** 2026-08-25
- **Context:** Inventory of the built app found almost no dealership-specific code
  (schema was already vertical-agnostic; only 3 of 11 reason codes assumed a
  dealership).
- **Reason:** Car garage is the closest adjacent vertical to "auto dealership" —
  minimizes rework versus reopening the full 5-agent vertical debate.
- **Alternatives considered:** Reopening the original vertical debate from scratch —
  rejected as unnecessary churn given how little dealership-specific surface existed.
- **Risk / follow-up:** The original dealership debate record (`01-idea-scoping-chatroom.md`,
  `active/chatroom/chatroom_report.md`) was deliberately left unedited rather than
  rewritten to say "car garage" — it's a record of what was actually debated, not the
  current target. Source: `docs/reports/05-vertical-pivot-car-garage.md`.

## Tenant isolation: schema-per-tenant during pilot, migrate to shared-schema+RLS at a numeric trigger

- **Date:** 2026-08-24
- **Context:** Chatroom debate, Security Engineer agent.
- **Reason:** Reasoned through failure-mode *silence* vs. *loudness* (a schema-per-tenant
  bug fails loudly; a shared-schema RLS bug can fail silently), not just failure
  probability. CI-tested RLS gets built as day-one scaffolding regardless.
- **Alternatives considered:** Shared-schema + RLS from day one — the Security
  Engineer's own Round 1 recommendation, reversed after the silent-failure argument.
- **Risk / follow-up:** Not implemented yet — the MVP built in report 02 is
  single-tenant. Needs reconciling once real multi-tenant deployment (Phase 2) starts.
  Source: `docs/reports/01-idea-scoping-chatroom.md`.

## No trained ML model at launch

- **Date:** 2026-08-24
- **Context:** Chatroom debate, ML/Data Pragmatist agent.
- **Reason:** A transparent, tenant-editable heuristic score + LLM intent tagging was
  judged a *better sales-demo artifact* than premature ML, not just a cost-saving
  compromise.
- **Alternatives considered:** Training a model at launch — rejected as premature
  given the data volume available.
- **Risk / follow-up:** Gated behind ≥500 resolved leads, ≥90% reason-code coverage,
  and contractual opt-in — none of those thresholds are met yet. Source:
  `docs/reports/01-idea-scoping-chatroom.md`.

## Reused the `Activity` table for reason codes instead of a new `lead_events` table

- **Date:** 2026-08-24
- **Context:** Implementing one-tap Won/Lost reason codes.
- **Reason:** The existing `Activity` table already serves the same audit purpose at
  this stage of the build.
- **Alternatives considered:** A dedicated `lead_events` event-sourcing table, as
  originally designed in the chatroom debate — deferred, not rejected.
- **Risk / follow-up:** Explicitly called a "Phase 1+ concern once multi-tenancy work
  starts," not a permanent choice. Source:
  `docs/reports/02-reason-codes-and-form-ux.md`.

## De-fictionalized the installed `@efferd/dashboard-3` block instead of shipping its mock data

- **Date:** 2026-08-24
- **Context:** Installing a third-party shadcn dashboard block that shipped with a
  fictional company, fake user identity, and hardcoded fake metrics.
- **Reason:** Won't ship a real product with fabricated business metrics or a fake
  identity in the UI, even for a demo/pilot build.
- **Alternatives considered:** Keeping the block's mock charts (CSAT, first-reply-time,
  etc.) since they looked polished — rejected; deleted rather than left as
  fabricated-data dead code.
- **Risk / follow-up:** Banner photo still a CSS gradient placeholder pending the real
  image file. `recharts` version was bumped by the registry's dependency range — worth
  a sanity check if chart behavior looks off. Source:
  `docs/reports/03-efferd-dashboard-and-transitions.md`.

## Analytics kept as a separate page instead of folding into the Dashboard

- **Date:** 2026-08-24
- **Context:** Adding a Won/Lost reason-breakdown view.
- **Reason:** Dashboard answers "what's happening now" (funnel, volume, source,
  recent leads); Analytics answers "why" — different jobs, shouldn't be one page.
- **Alternatives considered:** Adding the reason breakdowns directly onto the
  Dashboard — rejected to keep the two views' purposes distinct.
- **Risk / follow-up:** No PDF/exportable version yet — a distinct follow-up if
  actually needed later. Source: `docs/reports/04-analytics-tab.md`.

## Email intake Phase 0 built entirely outside the repo, Gmail-only, human-in-the-loop

- **Date:** 2026-08-25
- **Context:** Scoping AI-triaged email/WhatsApp lead intake.
- **Reason:** Keeping it external (n8n + Gmail API + Anthropic API + Slack + Sheets)
  makes it cheap to abandon if the channel doesn't validate. No autonomous sends —
  AI drafts route through Slack for staff approval first.
- **Alternatives considered:** Building `Conversation`/`Message` models and webhook
  routes directly into the app now — deferred until Phase 0 validates. WhatsApp
  alongside Gmail — deferred to a follow-on phase.
- **Risk / follow-up:** No code, schema, or dependency changes made yet. Next action
  is external account/credential setup (Google Cloud + Gmail API, n8n instance,
  Anthropic key, Slack workspace) — not started as of this log entry. Source:
  `docs/reports/05-email-intake-phase0-scoping.md`.

## UAE market research reviewed, deferred pending a real pilot

- **Date:** 2026-08-29
- **Context:** User researched UAE auto-garage industry norms (WhatsApp-first
  intake, pre-quote DVI, Genuine/OEM/Aftermarket parts tiering, insurance LPO
  approval, 5% VAT + bilingual EN/AR receipts) and compared it against
  `src/lib/pipeline.ts`. Confirmed exploratory — no concrete UAE pilot customer.
- **Reason:** Ship the already-planned deploy on schedule rather than expand scope
  for a market with no confirmed customer yet. Two findings (a missing
  vehicle-in-shop/WIP pipeline stage, and vehicle make/model/year capture at
  `QUALIFIED`) are real pipeline-correctness gaps independent of any specific
  market, so those move to near-term backlog. Everything UAE-specific
  (WhatsApp intake, DVI, parts tiering, insurance LPO, VAT/bilingual PDFs) is
  deferred until there's an actual pilot — building compliance/localization
  speculatively repeats the "premature ML" mistake from the original chatroom
  debate, just in a different shape.
- **Alternatives considered:** Building the UAE-specific items now, since the
  research was already done — rejected; research having been done isn't the same
  as a customer needing it.
- **Risk / follow-up:** The app already has *some* UAE-specific behavior live
  (`Asia/Dubai` hardcoded in `src/lib/timezone.ts`, per report 20's scheduling
  fix — most likely anchored to the user's own timezone, not a deliberate
  go-to-market bet, but worth knowing this isn't a clean hypothetical). If a real
  UAE pilot does appear later, VAT compliance in particular jumps from "deferred"
  to "required before any real transaction" — re-read
  `docs/reports/22-uae-market-research-deferred.md` before assuming the same
  priority order still holds. Source:
  `docs/reports/22-uae-market-research-deferred.md`.

## Added a WIP pipeline stage; vehicle details required at QUALIFIED

- **Date:** 2026-08-29
- **Context:** The two near-term-backlog items from the UAE research review
  (report 22) — a missing "vehicle in-shop" stage and weak qualification
  criteria — built out.
- **Reason:** Both are real pipeline-correctness gaps independent of any specific
  market. `SCHEDULED → WON` had no way to represent a multi-day job in progress.
  "Qualified" meaning only "has a name and a way to reach them" is a weaker bar
  than the word implies. User confirmed both gates should be hard requirements
  (same pattern as the existing Won/Lost reason-code gate), not optional fields.
- **Alternatives considered:** Optional vehicle fields with no gate — rejected,
  doesn't fix the actual "qualified" bar. Vehicle details captured on the initial
  lead-creation form instead of a QUALIFIED-transition dialog — rejected in favor
  of mirroring the existing reason-code dialog pattern exactly. A quote-revision
  workflow for scope changes discovered mid-job (raised in report 22's research) —
  explicitly out of scope, just the stage itself for now.
- **Risk / follow-up:** Any real lead already sitting at `SCHEDULED` in the live
  database can now only move to `IN_PROGRESS`, not directly to `WON` — worth a
  one-time check. Source: `docs/reports/23-wip-stage-and-vehicle-details.md`.

## Removed fabricated TRN/warranty/WhatsApp content from the quote PDF

- **Date:** 2026-08-29
- **Context:** A quote PDF redesign landed outside this conversation (between
  reports 25 and 26) with a hardcoded fake UAE TRN, an invented specific
  warranty claim, and a reference to confirming quotes via WhatsApp — a channel
  that doesn't exist in this app.
- **Reason:** A TRN is a real, verifiable regulatory identifier — printing a
  fabricated one on a document a real customer could receive and try to verify
  is a materially different risk than a labeled placeholder (like the demo
  business address, which the user knowingly chose as a stand-in). Same
  reasoning for the warranty claim (a business commitment nobody actually made)
  and the WhatsApp reference (a customer following that instruction would be
  ignored). Matches this project's established precedent against fabricating
  business-facing content (report 03).
- **Alternatives considered:** Keeping the fields since they made the document
  look more complete — rejected; looking more complete by stating unconfirmed
  facts is the actual problem, not a stylistic tradeoff.
- **Risk / follow-up:** The improved card-based layout, VAT breakdown, and quote
  validity date were kept — none of those were fabricated claims, just real
  computed values or a real placeholder in a real field. Source:
  `docs/reports/26-quote-pdf-fabricated-fields-removed.md`.
