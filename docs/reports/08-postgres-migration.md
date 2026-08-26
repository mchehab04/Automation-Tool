# 08 — Postgres Migration

## What I did

Swapped the SQLite dev database for real Postgres (Vercel Postgres, Neon-backed) —
the first Track A deadline from the deployment roadmap (report 07), due today.
`prisma/schema.prisma` now has `provider = "postgresql"`, `src/lib/db.ts` and
`prisma/seed.ts` use `@prisma/adapter-pg` + `pg.Pool` instead of the old
`@prisma/adapter-libsql`, and the demo data is re-seeded (9 leads, 1 business) into
the real database.

## Main decisions / findings

- **Dropped the SQLite-era migration history.** The 7 existing migrations under
  `prisma/migrations/` were SQLite-flavored SQL and don't apply to Postgres. Since
  the only data behind them was seed/demo data — nothing real to preserve — I deleted
  them and generated one fresh `init_postgres` migration from the current schema
  instead of trying to port each one individually.
- **Couldn't use the Prisma CLI to actually apply the migration** — `prisma migrate
  dev` kept failing with `P1001: Can't reach database server`. Traced it down: this
  machine's network has a dead IPv6 route to Neon's host (confirmed via direct TCP
  tests — the IPv4 address connects fine, the IPv6 addresses all time out), and
  Node's `pg` driver respects `--dns-result-order=ipv4first`, but Prisma's CLI
  migration engine is a separate Rust binary that does its own DNS resolution and
  ignores that setting entirely.
- **Worked around it rather than being blocked on it**: generated the migration SQL
  locally with `prisma migrate diff --from-empty` (no DB connection needed for that),
  then applied it directly through a raw `pg` connection (which *does* respect the
  IPv4 override) and wrote the matching bookkeeping row into `_prisma_migrations`
  myself — using the exact table definition extracted straight from strings inside
  `node_modules/@prisma/engines/schema-engine-windows.exe`'s Postgres flavour, not
  guessed from memory. End state is identical to what `prisma migrate dev` would
  have produced; only the path to get there was different.
- **Fixed the IPv6 issue for good, not just for me**: added
  `dns.setDefaultResultOrder("ipv4first")` at the top of `db.ts` and `seed.ts`. This
  isn't a workaround specific to my one CLI session — without it, the actual running
  app (`next dev`, and later the Vercel deploy) would hit the same dead-IPv6-route
  problem on every connection attempt. This is a real, permanent fix, not a hack to
  delete later.
- Rebuilt `prisma/migrations/migration_lock.toml` for `provider = "postgresql"` —
  missed it on the first pass when deleting the old migrations folder; the CLI needs
  this file to know which provider the migration history targets.

## Why this matters

This is the dependency every other Track A item sits behind — the smoke tests,
cleanup pass, and actual Vercel deploy all assume a real database exists. It also
means the app now runs on the same kind of database it'll run on in production,
instead of "works on my SQLite file" being a different claim than "works when
deployed."

## Risks / things to keep in mind

- The IPv4-preference fix is specific to *this machine's* network. It's harmless
  elsewhere (Vercel's own network almost certainly doesn't have this problem), but
  worth remembering if a *different* dead-IPv6 host shows up later — the same
  `setDefaultResultOrder` fix applies.
- The `_prisma_migrations` row was hand-inserted rather than written by Prisma's own
  engine. It matches the real schema exactly (verified against the engine binary,
  not assumed), but if `prisma migrate dev`/`deploy` ever *can* reach the DB from
  this machine later, worth a sanity check that it recognizes the migration as
  already applied rather than trying to redo it.
- Demo data was seeded once; the seed script doesn't upsert leads, so re-running
  `npm run db:seed` again would duplicate the 9 leads.

## Files touched

- `prisma/schema.prisma` — provider `sqlite` → `postgresql`
- `src/lib/db.ts`, `prisma/seed.ts` — `@prisma/adapter-libsql` → `@prisma/adapter-pg`
  + `pg.Pool`, plus the IPv4 DNS-order fix
- `package.json` — dependency swap (`@prisma/adapter-pg`, `pg` in;
  `@prisma/adapter-libsql`, `@libsql/client` out)
- `prisma/migrations/` — old 7 SQLite migrations deleted, replaced with
  `20260825161814_init_postgres/migration.sql` + a regenerated `migration_lock.toml`
- `.env` — `DATABASE_URL` now points at the real Postgres connection string
  (gitignored, not committed)

## Next step

Persisted Playwright smoke-test suite and the pre-deploy cleanup pass — both due
2026-08-28 per the roadmap. The dev server is up on `http://localhost:3004` against
the new database if it's useful to poke at directly.
