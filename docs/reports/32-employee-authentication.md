# 32 — Employee Authentication

## What I did

Item #6 from the pipeline-improvements list: real, per-employee login for
this app, which had zero auth anywhere before this. Every `(app)` page and
every server-action mutation is now gated behind a session.

## Main decisions / findings

- **Declined to integrate the pasted "premium auth" component.** It was a
  public self-service signup/login/password-reset/email-verification UI
  with no real backend (`handleSubmit` was a `setTimeout` mock, "remember
  me" wrote a plaintext email to `localStorage`) and the wrong shape
  entirely — a public "Create Account" flow doesn't fit an internal staff
  tool where accounts should be admin-created, not self-registered. Built
  real auth from scratch instead, scoped to what this app actually needs.
- **Caught a real version-specific issue by checking the docs first, per
  `AGENTS.md`'s standing instruction.** `middleware.ts` is deprecated in
  Next 16, renamed to `proxy.ts` (same API, `proxy` export instead of
  `middleware`) — confirmed in `node_modules/next/dist/docs`, not assumed
  from training data. Also found Proxy defaults to the **Node.js runtime**
  in this version (not Edge), which directly shaped the design: the generic
  Next auth guide's "keep Proxy checks cookie-presence-only" advice exists
  specifically because Edge can't easily reach Postgres — that constraint
  doesn't apply here.
- **Hybrid Proxy check, not uniformly optimistic or uniformly strict.**
  GET/HEAD (page loads/prefetches) get the cheap cookie-presence check,
  matching Next's documented pattern. POST requests (every mutation in this
  app is a Server Action POST) get a real DB-backed session check — closes
  the exact gap the Next docs call out ("verify authentication inside each
  Server Function... UI restrictions alone are not sufficient"), without
  paying a DB round-trip on every navigation/prefetch.
- **Opaque DB-backed session tokens, not JWTs** — no `SESSION_SECRET` env
  var needed. A random token's SHA-256 hash is the only thing ever stored;
  validity is a DB lookup + expiry check. Fewer moving parts than
  signing/verifying tokens, and this app already hits the DB on every
  request path.
- **Node's built-in `crypto.scrypt`**, not `bcrypt`/`bcryptjs` — zero new
  dependency, matches this project's established minimal-footprint bias
  (report 29 reused `sharp` rather than adding a package).
- **`requireEmployee()` called in the layout AND at the top of every
  existing page**, not just the layout. The Next docs explicitly warn
  layouts don't always re-run on client-side transitions — since the check
  is wrapped in React's `cache()`, calling it from both costs exactly one
  DB query per request, not two.
- **Refined the plan's `login` sketch mid-implementation**: the plan
  originally had `login(formData)` throw on failure, called via a manual
  `try/catch`. Building it, this would have been a real bug — `redirect()`
  throws Next's internal redirect signal, and a hand-written `catch` block
  around the action call would swallow it, breaking the successful-login
  redirect. Switched to `useActionState`'s convention (return `{ error }`
  instead of throwing) — the same pattern the official Next.js auth guide
  itself uses for exactly this reason.
- **Deliberately left `DEMO_BUSINESS_ID` hardcoding untouched everywhere**
  — `Employee` has a real `businessId` relation, but none of the ~7
  existing files that hardcode the demo business ID were changed. That's a
  separate multi-tenancy generalization this project has repeatedly and
  deliberately deferred (reports 20, 27); not part of "add employee login."
- **No roles/permissions** — every logged-in employee can do everything,
  matching current behavior exactly (nothing branches on identity today).
- **Accepted scope boundary, stated plainly**: individual Server Actions
  don't each independently re-verify a session — Proxy's real DB check on
  every mutation POST already covers "is there a live session at all" for
  the entire attack surface, since every action in this app is invoked via
  a POST to a matched page path. Worth real per-action checks only if this
  ever needs role-based restrictions, which nothing currently does.

## Outcome

Verified against the real dev server and real Neon DB, not just by code
review:

- Unauthenticated requests to any `(app)` page correctly redirect to
  `/login` (confirmed via curl: `307 -> /login`); `/login` itself loads.
- Wrong password produces an inline error, no session created. Correct
  login redirects to `/dashboard`; `NavUser` shows the real employee's
  name/email (previously hardcoded "Demo Business"). Visiting `/login`
  while already authenticated redirects to `/dashboard`.
- Added a second employee through the new `/settings` → Employees card,
  logged in as them in a separate browser context, confirmed they could
  reach `/dashboard` and `/leads`. Then, as the owner, deleted that
  employee — confirmed via direct DB query the row was actually gone (not
  just hidden in the UI) and their `Session` row was cascade-deleted, and
  confirmed their **already-open browser session** was redirected to
  `/login` on its very next request — proving the mutation-path real check
  invalidates access immediately, not just "eventually."
- `/api/cron/gmail-intake` (Vercel's scheduled Gmail intake) still reachable
  with only its `CRON_SECRET` bearer header and no session cookie —
  confirmed the matcher carve-out works and this change didn't silently
  break the existing cron job.
- Full Playwright suite updated (`e2e/global-setup.ts` logs in once via a
  real browser — React Server Actions can't be replicated with a raw curl
  POST — and saves `storageState` for every spec to reuse) and reran clean:
  **10/10 passed**, including `pipeline.spec.ts`'s many real mutations
  (stage changes, quote generation/send) — proving the mutation-path
  session check doesn't break legitimate authenticated writes.

`npx tsc --noEmit` and `npm run lint` both clean.

## Files touched

- `prisma/schema.prisma` — `Employee`, `Session` models; `Business.employees`
- `prisma/migrations/20260831230500_employee_and_session/` — new
- `prisma/seed.ts` — bootstrap `Employee` row (`owner@demobusiness.test`)
- `src/lib/validation.ts` — `MIN_PASSWORD_LENGTH`, `isValidPassword`
- `src/lib/auth/password.ts`, `src/lib/auth/session.ts` — new
- `src/proxy.ts` — new (not `middleware.ts` — see above)
- `src/lib/actions/auth.ts` — new (`login`, `logout`)
- `src/lib/actions/employees.ts` — new (`createEmployee`, `deleteEmployee`)
- `src/app/login/page.tsx`, `src/components/auth/login-form.tsx` — new
- `src/app/(app)/layout.tsx`, `src/components/app-shell.tsx`,
  `src/components/app-header.tsx`, `src/components/nav-user.tsx` — thread
  the real employee through and wire "Log out" (previously inert)
- Every `(app)/**/page.tsx` (dashboard, leads, leads/[id], leads/new,
  leads/simulate, calendar, analytics, settings) — `requireEmployee()`
- `src/app/(app)/settings/page.tsx`,
  `src/components/settings/employee-manager.tsx` — new Employees card
- `e2e/global-setup.ts` — new; `playwright.config.ts`, `.gitignore` updated

## Risks / things to keep in mind

- The seeded bootstrap password (`changeme123`) is a documented dev-only
  default — worth changing (or deleting that account and using a properly
  chosen one) before this is used for real.
- No password-reset or edit-employee flow yet — deliberately deferred, not
  needed for a first version. An owner locked out would need direct DB
  access today.
- Sessions run 30 days with no cleanup job for expired rows — inert data,
  not a functional problem at this scale, but worth a cleanup pass someday.

## Next step

Push this alongside report 31's work, which was sitting uncommitted before
this session started. After that: #2 (multi-user live refresh) and #7
(automated/self-service scheduling) are deferred to "future upgrade if a
client wants it." #4/#5/#8 (analytics, invoices, payments) stay for the
end — confirmed #4 and #5 can be built without #8: an invoice only needs a
manual paid/unpaid status to make revenue analytics meaningful, no online
payment collection required as a prerequisite.
