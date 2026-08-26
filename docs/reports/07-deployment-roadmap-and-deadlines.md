# 07 — Deployment Roadmap and Calendar Deadlines

## What I did

Built a concrete roadmap from where the project actually stands today to a live,
single-tenant demo deployment, and put 8 real deadlines on my Google Calendar so I
stay on pace instead of just having a plan on paper.

Before setting dates I had Claude check what's actually left, rather than guessing:
no auth/multi-tenancy anywhere in the code, no deployment config of any kind (no
`vercel.json`, no CI, no Postgres — still SQLite via `@prisma/adapter-libsql`), no
persisted test suite (the Playwright run in report 02 was a one-off, never saved),
and the email-intake pilot (report 05) is still just a plan — no n8n workflow, no
Google Cloud project set up yet. Good news: the banner-image gap from report 03 is
actually already closed in the code, it just needs compressing before deploy.

## Main decisions / findings

- **"Deployment" = live single-tenant demo, not the multi-tenant pilot-ready
  version.** Auth/multi-tenancy is real infrastructure work and deliberately stays a
  separate later phase — this roadmap's finish line is a working demo URL, not a
  production-ready multi-tenant app.
- **Two tracks running in parallel, not sequential**: Track A is the core
  app → deployment work (Postgres migration, a real persisted smoke-test suite, image/
  security cleanup, then the actual Vercel deploy). Track B is the email-intake Phase
  0 pilot from report 05 — entirely external (n8n/Gmail/Slack/Sheets), so it doesn't
  block Track A and can run alongside it.
- Paced against 20+ hrs/week and the fact that the original MVP (dashboard, leads,
  quotes, analytics, reason codes) came together in about two days of focused work —
  so the whole roadmap spans about a week (Aug 25 → Sep 2), not a month.

## Why this matters

I already have a habit of scoping things clearly and then not actually finishing them
on a schedule (the no-code validation phase from the original chatroom debate was
recommended and then just never executed before the MVP got built directly — see
report 05). Deadlines on the calendar, tied to a roadmap that's grounded in what's
actually built vs. not, are meant to close that gap.

## Risks / things to keep in mind

- The dates are a target pace, not a guarantee — external dependencies in Track B
  (standing up n8n, Slack workspace setup) could slip even if Track A goes fine.
- Track A's deploy milestone (Aug 29) assumes the Postgres migration and smoke tests
  land clean earlier in the week. If either slips, the deploy date should move with
  it rather than getting rushed.
- Explore also flagged that `.env` (gitignored) has live-looking API keys and a
  `service_account.json` sits at the repo root — not a blocker for this roadmap, but
  worth a deliberate check (not just "it's gitignored so it's fine") before the
  pre-deploy cleanup milestone on Aug 28.

## Files touched

- `docs/reports/07-deployment-roadmap-and-deadlines.md` (this report)
- `docs/00-project-index.md` (new row for this report)
- Google Calendar: 8 new events, Aug 27 – Sep 2, 2026 (not a repo file, but the actual
  output of this task)

## Next step

Start Track A with the Postgres migration (`prisma-postgres-setup` skill) and Track B
with the Google Cloud project setup — both are due Aug 27, so both should start today
or tomorrow.
