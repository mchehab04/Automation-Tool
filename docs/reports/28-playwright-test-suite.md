# 28 — Playwright Test Suite (#2 from the pre-WhatsApp list)

## What I did

Built the automated test suite that's been "still zero coverage" since report
02 — 10 tests across 4 files, running against the real dev server and real
Postgres (no mocking, matching how every manual verification in this project has
always worked): the full pipeline golden path, real AI email intake, the new
settings page, and a page/nav smoke test.

## Main decisions / findings

- **Real AI calls, not mocked.** `pipeline.spec.ts` (via a note on manual lead
  creation and moving a lead to Won) and `email-intake.spec.ts` both trigger real
  Claude Sonnet 5 calls. Consistent with this project's entire testing culture so
  far — every report's "Outcome" section describes live verification against a
  real server, never a mock. Costs a little real API spend and a few seconds per
  run; traded that for tests that catch what mocks can't (the actual extraction
  quality, the actual catalogue grounding).
- **Serial execution, one worker** (`fullyParallel: false`, `workers: 1`) —
  there's no per-test database isolation (no transactions-per-test, no separate
  test DB), so parallel tests could race on shared state (the demo business's
  catalogue, scheduling slots). Serial execution is the honest tradeoff for
  testing against a real shared dev database without building out fixture
  infrastructure this project doesn't have yet.
- **Hit a real Node ESM/CJS wall and deliberately didn't "fix" it the obvious
  way.** Playwright's test-file loader runs as CJS by default, but Prisma 7's
  generated client uses `import.meta` internally (ESM-only) — importing
  `@/lib/db` directly from a test file threw `Cannot use 'import.meta' outside a
  module`. The obvious fix (`"type": "module"` in the root `package.json`) was
  explicitly rejected in report 08 as unnecessary and not touched preemptively —
  reversing that now, just to make test files happy, would be solving a
  test-runner problem by changing the whole app's module system. Instead wrote
  `e2e/db-helper.ts`, a small raw-`pg` client (same IPv4-DNS-fix pattern as every
  migration workaround this session) used only for test setup/cleanup — it never
  touches the ESM-only generated client at all.
- **Caught a second, subtler bug in that same helper**: `pg.Pool` in
  `db-helper.ts` is a module-level singleton, and Playwright's single worker
  process shares one Node module cache across every spec file. Each file
  originally closed the pool in its own `afterAll` — meaning whichever file's
  `afterAll` ran first closed the pool out from under every file that ran after
  it (`Cannot use a pool after calling end on the pool`, timing out a whole test).
  Fixed by moving the single `closeDbPool()` call into a `globalTeardown`, run
  exactly once after the entire suite finishes.
- **Fixed real assertion bugs, not just flaky timing** — worth being explicit
  about which failures were which, since it's tempting to blame "flakiness" for
  everything once AI latency is in the mix:
  - A URL regex (`/\/leads\/[a-z0-9]+$/`) that accidentally matched `/leads/new`
    and `/leads/simulate` too, since "new" and "simulate" both satisfy
    `[a-z0-9]+`. Tightened with a negative lookahead + minimum length.
  - Two `getByRole("link", ...)` locators that never matched, because Base UI's
    `Button` with `render={<a .../>}` forces `role="button"` regardless of the
    underlying element — the exact pattern report 02 already documented, just
    not remembered when writing new locators. Both were on real navigational
    elements (the quote PDF link, the simulator's "View lead" link).
  - Several `getByText(...)` substring matches that hit more than one element
    once real data made the page busier (a vehicle string appearing in both an
    info card and an activity-feed note, "In Progress" appearing in a badge, a
    select placeholder, and a note simultaneously) — fixed with exact-match or
    `.first()` as appropriate to what was actually being asserted.
  - The real latency-driven case: moving a lead to Won also triggers a
    synchronous `generateClosingReport` AI call (report 21) inside the same
    server action before it resolves — the default 5s assertion timeout wasn't
    enough. Bumped that specific assertion's timeout rather than the whole
    suite's, since the latency is localized to this one transition.
- **Verified twice, consecutively, before calling it done** — two full green
  runs, plus a direct database check confirming zero leftover test data and the
  business address correctly restored to the report 25 placeholder.

## Why this matters

This suite now covers real cross-cutting risk: every pipeline stage transition
and gate (vehicle-details, scheduling, reason codes), quote generation and PDF
rendering, the AI extraction pipeline (both intake paths), and the settings page
just built in report 27 — the exact set of things that could silently break while
building WhatsApp intake on top, which was the whole reason this was #2 on the
pre-WhatsApp list.

## Risks / things to keep in mind

- Real AI calls mean real (small) ongoing cost and non-zero latency per run
  (~1 minute full suite) — not free the way a fully mocked suite would be.
- No CI wiring yet — this runs locally against whatever dev server is up
  (`reuseExistingServer: true`), not on a schedule or on push. Out of scope for
  this pass; worth a follow-up if this project ever gets a CI pipeline.
- Serial-only, real-DB testing doesn't scale indefinitely — fine at 10 tests
  across 4 files, would need real fixture/isolation infrastructure before this
  suite gets much bigger.

## Files touched

- `playwright.config.ts` — new
- `e2e/db-helper.ts` — new, raw-`pg` test data helpers (deliberately not the
  Prisma client — see above)
- `e2e/global-teardown.ts` — new
- `e2e/pipeline.spec.ts` — new, full golden-path test
- `e2e/email-intake.spec.ts` — new
- `e2e/settings.spec.ts` — new
- `e2e/nav-and-pages.spec.ts` — new
- `package.json` — `@playwright/test` devDependency, `test:e2e` script
- `.gitignore` — Playwright output directories

## Next step

#3 from the ordered list: dashboard banner image compression — quick, isolated,
no dependencies on anything else.
