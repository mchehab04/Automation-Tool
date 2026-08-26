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
