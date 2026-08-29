# Project Index — AI Automation Tool for SMEs

Running index of every project doc. Updated whenever a new report is written or an
old one is materially superseded. Never edited to rewrite history — see
`docs/reports/05-vertical-pivot-car-garage.md` for why (it exists specifically so the
original vertical-choice record didn't have to be touched).

**Current phase:** Substantially more built than this index currently reflects — see
the gap note below. As of report 22 (2026-08-29): real Postgres (08), a functionally
complete Gmail intake pipeline (real IMAP + Claude Sonnet 5 extraction + real SMTP
sends, superseding the original external n8n Phase 0 plan — see decision log),
quote/thank-you message drafting, slot-based scheduling with a UAE-anchored calendar
tab, a service catalogue, and pre-deploy cleanup (report 19) all landed. **Live demo
deployed to Vercel — confirmed by the user 2026-08-29.** Remaining open items are
post-deploy hardening, not blockers: no automated test suite yet, and
`dashboard-banner.jpg` is still unoptimized (~3.9MB). Multi-tenant isolation is
still deferred (single `demo-business` hardcoded throughout).

## Reports

| # | Title | Date | Location | Phase at the time |
|---|---|---|---|---|
| 01 | Idea Scoping via Agent Chatroom | 2026-08-24 | `docs/reports/01-idea-scoping-chatroom.md` | Pre-build strategy debate (vertical, tenancy, ML, architecture) |
| 02 | MVP Scaffold and Core Pipeline Loop | 2026-08-24 | `docs/reports/02-mvp-scaffold-and-core-loop.md` | First working build: dashboard, leads kanban, quotes, PDF export |
| 02 | Reason Codes (from Chatroom Debate) + Form UX Pass | 2026-08-24 | `docs/reports/02-reason-codes-and-form-ux.md` | One-tap Won/Lost reason codes + form validation pass |
| 03 | Efferd Dashboard Block, Sidebar Shell, and Error-Shake Transitions | 2026-08-24 | `docs/reports/03-efferd-dashboard-and-transitions.md` | New sidebar shell installed, de-fictionalized, error-shake transitions added |
| 04 | Analytics Tab | 2026-08-24 | `docs/reports/04-analytics-tab.md` | Added Won/Lost reason-breakdown analytics page |
| 05 | Vertical Pivot: Car Garage / Auto Maintenance | 2026-08-25 | `docs/reports/05-vertical-pivot-car-garage.md` | Narrowed target vertical from dealership to car garage |
| 05 | Email Intake with AI Triage: Phase 0 Scoping | 2026-08-25 | `docs/reports/05-email-intake-phase0-scoping.md` | Scoped an external (n8n-based) Gmail intake pilot; no code yet |
| 06 | Documentation Skill | 2026-08-25 | `docs/reports/06-documentation-skill.md` | Built the `documentation` skill; backfilled project index + decision log |
| 07 | Deployment Roadmap and Calendar Deadlines | 2026-08-25 | `docs/reports/07-deployment-roadmap-and-deadlines.md` | Set 8 calendar deadlines, Aug 27 – Sep 2, for Postgres migration, smoke tests, deploy, and email-intake Phase 0 |
| 08 | Postgres Migration | 2026-08-25 | `docs/reports/08-postgres-migration.md` | Swapped SQLite for Postgres (Vercel/Neon); dropped SQLite migration history; fixed a dead-IPv6-route connectivity issue |
| 22 | UAE Market Research: Deferred Pending a Real Pilot | 2026-08-29 | `docs/reports/22-uae-market-research-deferred.md` | Reviewed UAE auto-garage market research; deferred all UAE-specific build work pending a real pilot; flagged WIP stage + vehicle details as near-term backlog regardless |
| 23 | WIP Pipeline Stage and Vehicle Details at QUALIFIED | 2026-08-29 | `docs/reports/23-wip-stage-and-vehicle-details.md` | Added IN_PROGRESS stage between SCHEDULED and WON; vehicle make/model/year now required to reach QUALIFIED |

**Gap: reports 09 through 21 are not indexed here yet.** Substantial work landed
in that range without going through this index/decision-log update step — quote
drafting and closing reports, scheduling and notifications, real Gmail send wiring,
quote-suggestion fixes, real Gmail intake, reply approval, service catalogue, lead
matching fixes, pre-deploy cleanup, business category + UAE scheduling, and a
calendar tab. All 21 report files exist and are readable in `docs/reports/` — this
index just hasn't been backfilled to include them yet. Treat this index's report
table as incomplete until that catch-up pass happens.

Note: `02`, `05`, `06`, and `08` are each used twice or more in the existing
history — that numbering drift predates this index and isn't being corrected
retroactively (would misrepresent when things actually happened). New reports
should number forward from `23`.

## Decisions

See `docs/03-decisions/decision-log.md` for the full record. Backfilled from the
reports above as of 2026-08-25 when this index was created.

## Other docs

| Doc | Description | Location |
|---|---|---|
| Documentation config | Drive sync root + sync state for this skill | `docs/.documentation-config.json` |
| Chatroom transcript | Full 3-round agent debate that produced the report-01 decisions | `active/chatroom/chat.json` |
| Chatroom synthesis | Human-readable summary of the chatroom debate | `active/chatroom/chatroom_report.md` |
