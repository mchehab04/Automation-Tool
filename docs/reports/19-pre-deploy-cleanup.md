# 19 — Pre-Deploy Cleanup: Migration Safety + Env Var Documentation

## What was done

Followed up on the "pre-deploy cleanup" checkpoint set in
`docs/reports/07-deployment-roadmap-and-deadlines.md` (targeted for today). Scoped to two
things the user picked: (1) verifying the hand-applied database migrations are safe to hand
off to a real deploy, and (2) documenting the environment variables the app needs, since
that was never written down and the README was stale.

## Key decisions

- **Full audit of `_prisma_migrations` bookkeeping before trusting it**, not a spot check —
  every one of the 7 migration folders under `prisma/migrations/` has a matching row with a
  byte-for-byte matching SHA-256 checksum, no orphans in either direction, nothing rolled
  back or stuck mid-apply, `migration_lock.toml` correctly declares `postgresql`, and the
  live database's actual `Lead`/`ServiceCatalogItem` table structure independently matches
  what `prisma/schema.prisma` declares. Conclusion: a future `prisma migrate deploy` run
  somewhere that can actually reach the database (Vercel's network, unlike this dev
  machine) should recognize all 7 as already applied and behave correctly.
- **Found a real, separate deploy-blocking gap while investigating**: `package.json` had no
  `postinstall` script, and the generated Prisma client (`src/generated/prisma`) is
  deliberately gitignored (too large/auto-generated to commit). Nothing told a fresh
  install to regenerate it. Verified this concretely, not just in theory: temporarily
  removed `src/generated/prisma`, confirmed `tsc --noEmit` immediately broke across the
  whole app (`Cannot find module '@/generated/prisma/...'` in ~10 files), then fixed it by
  running `prisma generate` and confirmed both `tsc` and a full `npm run build` succeeded
  afterward. Added `"postinstall": "prisma generate"` to `package.json` — Prisma's own
  documented standard fix, host-agnostic, not a Vercel-specific workaround.
- **Deliberately did not wire `prisma migrate deploy` into the build/deploy step.**
  Documented instead: keep applying future schema changes the same guided, verified way
  this project has all along, rather than giving every future deploy live database write
  access as part of the build. Lower risk for a first deploy; revisit once there's more
  deploy experience.
- **`.env.example` documents only what the app itself reads** — confirmed via grepping
  `process.env.*` usage across `src/`: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `GMAIL_USER`,
  `GMAIL_APP_PASSWORD`, `CRON_SECRET`. Left out `APIFY_API_TOKEN`,
  `GOOGLE_APPLICATION_CREDENTIALS`, `ANYMAILFINDER_API_KEY` — present in a real local
  `.env` but belonging to the separate lead-scraping skill/scripts, not read anywhere in
  `src/`. Noted this distinction in the README so it isn't confusing later.
- **`.gitignore`'s blanket `.env*` rule would have silently excluded `.env.example` too** —
  caught via `git check-ignore -v` before assuming the add would work. Added a
  `!.env.example` negation line so the example file is actually trackable, since it holds
  no real secrets (just variable names and comments).
- **README fixed to match reality**: stack line said "SQLite via libsql", stale since the
  Postgres migration (report 08); corrected, and a short "Environment variables" section
  added pointing at `.env.example`.

## Outcome

- Confirmed the secrets-in-git-history concern from report 07 (the reason for this whole
  pass) comes back clean: `git log --all --full-history` against `.env`,
  `service_account.json`, and related filenames returns zero hits — never committed, at
  any point.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` all clean and passing, including
  the deliberate clean-environment simulation described above.
- No database or schema changes in this pass — audit only, everything already applied
  correctly.

## Files touched

- `package.json` — added `postinstall: "prisma generate"`
- `.env.example` — new, documents the app's 5 required environment variables
- `.gitignore` — added `!.env.example` so the example file isn't swept up by `.env*`
- `README.md` — corrected stack line (Postgres, not SQLite), added an "Environment
  variables" section
