# 02 — MVP Scaffold and Core Pipeline Loop

## What was done

Built Phase 1 of the approved plan (`~/.claude/plans/use-the-relevant-skills-abundant-curry.md`) end-to-end: a working Next.js app implementing the fixed pipeline (`New → Qualified → Quote Sent → Won/Lost`) with a dashboard, a leads kanban, manual lead intake, stage transitions, and PDF quote generation, backed by a real (seeded) database. Verified the full loop live in a browser via a Playwright smoke test, not just type-checked.

## Key decisions

- **Prisma 7 breaking changes**: this Next.js/Prisma toolchain is newer than training data. `datasource.url` in `schema.prisma` is no longer supported — Prisma 7 requires a driver adapter passed to `PrismaClient` even for SQLite. Used `@prisma/adapter-libsql` (pure-JS/prebuilt-binary, avoids native `better-sqlite3` compilation on Windows) with `prisma.config.ts` handling the CLI-side connection separately. Confirmed via `node_modules/next/dist/docs` and `node_modules/prisma/build/cli.js` rather than guessing from memory, per the AGENTS.md warning this Next.js version ships with.
- **shadcn/ui now uses Base UI, not Radix**, for primitives like `Button`. The `asChild` pattern doesn't exist — the equivalent is `render={<Link .../>}`, and non-`<button>` targets need `nativeButton={false}` or Base UI logs an accessibility warning (caught live via the dev server log during the browser smoke test, not by type-checking).
- **Stage-transition history**: `Activity.type = 'STAGE_CHANGE'` carries `fromStage`/`toStage`, per the plan-review fix — dashboard only uses current-stage snapshots today, but the history is captured for future velocity metrics without a schema change later.
- **Chart colors render monochrome** — the shadcn "neutral" base theme's `--chart-1..5` tokens are genuinely grayscale (0 chroma). Left as-is; reads as an intentional minimalist palette rather than a bug.

## Outcome

Verified live via a Playwright-driven Chromium session against the dev server (port 3004; 3000 was taken by a concurrent peer Claude Code session working the same repo — see below): dashboard renders real funnel + leads-over-time charts from seeded data, kanban board groups leads by stage, lead detail page shows contact/activity/quotes, stage dropdown moves a lead and logs an activity entry, and quote generation produces a downloaded, correctly formatted PDF (verified by opening the actual PDF bytes, not just checking the HTTP response). Zero browser console errors after fixing the Base UI button warning. `tsc --noEmit` and `eslint` both clean.

**Concurrent session note**: a second Claude Code session (`automation-pipeline-project-b1`) was independently running an `agent-chatrooms` 5-agent strategy debate on the same repo during this work (see `docs/reports/01-idea-scoping-chatroom.md`). Its conclusions — launch vertical (auto dealership), schema-per-tenant isolation from day one, no trained ML at launch — are strategic/GTM-level and don't conflict with what was built here (a vertical-agnostic, single-tenant MVP per the user's own scoping answers), but multi-tenant isolation strategy will matter once Phase 2 (real deployment) starts and should be reconciled with that report then.

## Files touched

- `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `components.json` — scaffold config
- `prisma/schema.prisma`, `prisma.config.ts`, `prisma/seed.ts`, `prisma/migrations/` — data layer
- `src/lib/db.ts`, `src/lib/pipeline.ts`, `src/lib/actions/leads.ts`, `src/lib/actions/quotes.ts`, `src/lib/pdf/quote-document.tsx`
- `src/components/app-shell.tsx`, `src/components/dashboard/*`, `src/components/leads/*`, `src/components/ui/*` (shadcn)
- `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/leads/page.tsx`, `src/app/(app)/leads/new/page.tsx`, `src/app/(app)/leads/[id]/page.tsx`, `src/app/api/quotes/[id]/pdf/route.ts`, `src/app/page.tsx`, `src/app/layout.tsx`
- `.gitignore` — added SQLite db exclusion
