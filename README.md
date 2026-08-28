# Automation Tool

A pipeline automation platform for SMEs — unifies lead intake, pipeline tracking, quoting, and reporting into one app.

## What's here

- **Dashboard** — pipeline funnel, lead volume, lead source breakdown, recent leads.
- **Leads** — kanban board, lead detail pages, stage transitions with one-tap reason codes on Won/Lost.
- **Quotes** — line-item quote builder with PDF generation.
- **Analytics** — win/loss reason breakdowns and pipeline stats.

## Stack

Next.js (App Router) · TypeScript · Prisma (PostgreSQL) · Tailwind CSS v4 · shadcn/ui (base-ui) · Recharts

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

All five are required for the app to run — `DATABASE_URL`, `ANTHROPIC_API_KEY`,
`GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CRON_SECRET`. (A couple of other keys may show up in a
local `.env` for the separate lead-scraping skill/scripts under `active/` — those aren't
read by the app itself and don't need to be set to run it.)

## Getting started

```bash
npm install
npm run db:migrate   # applies Prisma migrations
npm run db:seed       # optional demo data
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project docs

Stage-by-stage build notes live in [`docs/reports/`](docs/reports/). Early product/architecture scoping (a 5-agent debate on launch vertical, data model, and security posture) is in [`active/chatroom/`](active/chatroom/chatroom_report.md).
