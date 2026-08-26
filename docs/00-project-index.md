# Project Index — AI Automation Tool for SMEs

Running index of every project doc. Updated whenever a new report is written or an
old one is materially superseded. Never edited to rewrite history — see
`docs/reports/05-vertical-pivot-car-garage.md` for why (it exists specifically so the
original vertical-choice record didn't have to be touched).

**Current phase:** MVP built and smoke-tested (single-tenant, dashboard/leads/quotes/
analytics working) for the car-garage vertical, now running on real Postgres (report
08). Working through the deployment roadmap (report 07) toward a live demo; smoke
tests, cleanup, and the actual Vercel deploy are still ahead. Multi-tenant isolation
and the email intake channel are both scoped but not started.

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

Note: `02` and `05` are each used twice in the existing history — that numbering drift
predates this index and isn't being corrected retroactively (would misrepresent when
things actually happened). New reports should number forward from `06`.

## Decisions

See `docs/03-decisions/decision-log.md` for the full record. Backfilled from the
reports above as of 2026-08-25 when this index was created.

## Other docs

| Doc | Description | Location |
|---|---|---|
| Documentation config | Drive sync root + sync state for this skill | `docs/.documentation-config.json` |
| Chatroom transcript | Full 3-round agent debate that produced the report-01 decisions | `active/chatroom/chat.json` |
| Chatroom synthesis | Human-readable summary of the chatroom debate | `active/chatroom/chatroom_report.md` |
