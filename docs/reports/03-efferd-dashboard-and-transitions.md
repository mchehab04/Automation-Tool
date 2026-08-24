# 03 — Efferd Dashboard Block, Sidebar Shell, and Error-Shake Transitions

## What was done

**Security check before installing anything.** The request asked to install a skill from an individual's GitHub repo (`jakubantalik/transitions-dev`) and register a third-party shadcn registry (`@efferd`) pointing at `efferd.com`. Given this followed the exact pattern of a known supply-chain risk (a "paste this component" prompt that quietly asks to register a custom code source), both were checked before use: fetched the GitHub repo (38 stars, MIT, plain CSS/markdown skill, no scripts) and the registry's actual JSON payload (`dashboard-3.json` — no postinstall hooks, no unexpected network calls, standard shadcn file/dependency structure) before installing either. Findings didn't support the initial suspicion; proceeded.

**Installed:**
- `shadcn/ui` and `jakubantalik/transitions-dev` skills via `npx skills add`.
- `@efferd/dashboard-3` block via the shadcn CLI, including a full sidebar-based admin shell (`app-shell.tsx`, `app-header.tsx`, `app-sidebar.tsx`) that replaced the project's simple top-nav shell — done only after confirming with the user, since it meant overwriting working, hand-built navigation.

**Fixed a registry bug**: `custom-sidebar-trigger.tsx` was written to a stray `components/` folder at the project root instead of `src/components/` (this project uses a `src/` layout); moved it and removed the stray folder.

**De-fictionalized the installed block.** The registry ships a demo "customer support" dashboard for a fictional company ("Efferd," fake user "Shaban Haider," fake avatar loaded from `github.com/shabanhr.png`, nav items like Inbox/Conversations/Workspace/Billing, charts for CSAT/first-reply-time/team-on-duty with hardcoded mock numbers). Rather than ship a real product with fake branding and fabricated business metrics:
- Sidebar rebranded to "Pipeline Hub" (matching the app's actual name), quick-create button now points at "Add lead" instead of "New Conversation".
- Nav rebuilt around the app's real routes (Dashboard, Leads) with dynamic active-state highlighting based on the actual URL, replacing hardcoded `isActive` flags and dead `#/...` links.
- User menu stripped of the fake identity and external avatar fetch; now a neutral placeholder consistent with the fact there's no auth yet.
- Deleted four chart components with no real data source and no honest way to populate them (CSAT, first-reply-time, team-on-duty, support-activity) rather than leave them as fabricated-data dead code.
- Adapted the remaining three into real, Prisma-backed equivalents: `LeadsVolumeChart` (was conversation volume), `LeadsBySourceChart` (was channel breakdown, now grouped by the app's actual `Lead.source`), `RecentLeadsTable` (was recent conversations). Kept the existing real-data `FunnelChart` for stage counts, wrapped to match the new visual style.
- Dashboard stat cards now show real numbers (total leads, active in pipeline, win rate, new this week) with a trend delta shown **only** where a real week-over-week comparison was computable — no fabricated percentages.

**Transitions**: applied the `transitions-dev` skill's error-state-shake snippet (CSS keyframes copied verbatim into `globals.css`) to all three lead-related forms, replaying on blur/failed-submit for whichever field is actually invalid. Skipped the skill's modal snippet — the project's existing shadcn Dialog already has its own open/close motion via `tw-animate-css`, and stacking a second transition system on top would have been redundant.

## Key decisions

- Declined to silently overwrite the working app shell; asked the user first since it was a real navigation/architecture decision, not just a file conflict.
- Hit an ESLint `react-hooks/refs` (React Compiler) false-positive when wrapping ref access in a custom hook (`useShake()` returning `{ ref, shake }`) — the linter can't prove ref access inside a closure built by a function invoked during render is actually deferred. Fixed by using direct `useRef()` per field plus a plain (non-hook) `replayShake()` utility, matching the pattern that already passed lint in the quote form's dynamic-row ref map.
- Could not retrieve the mountain photo's actual file bytes — no discoverable temp file path in this environment for the pasted image. Used a CSS gradient placeholder on the dashboard banner instead of guessing a substitute image or fabricating a URL; left a `TODO` comment marking exactly where to swap in the real file once its path is known.

## Outcome

`tsc --noEmit` and `eslint` both clean. Dev server smoke-tested at `/dashboard`, `/leads`, `/leads/new` (all 200) post-changes. Did not run a full `next build` since the dev server was live and shares the `.next` cache.

## Open follow-up

- Need the banner photo's actual file path (or have it re-saved into `public/`) to replace the gradient placeholder.
- `recharts` was bumped from `^3.10.1` to `^3.8.0` by the registry's declared dependency range during install — not a security issue, but worth a sanity check if any chart behavior looks off after a full restart.

## Files touched

New: `src/components/leads-volume-chart.tsx`, `leads-by-source-chart.tsx`, `recent-leads-table.tsx`, `pipeline-funnel-card.tsx`, `forms/shake.ts`, plus everything installed by the `@efferd/dashboard-3` block (`app-shell.tsx`, `app-header.tsx`, `app-sidebar.tsx`, `app-breadcrumbs.tsx`, `app-shared.tsx`, `nav-group.tsx`, `nav-user.tsx`, `latest-change.tsx`, `dashboard.tsx`, `stats.tsx`, `delta.tsx`, `indicator.tsx`, `formater.ts`, `custom-sidebar-trigger.tsx`, and the `ui/` primitives: `breadcrumb`, `collapsible`, `kbd`, `sheet`, `chart`, `sidebar`, `skeleton`, `tooltip`).
Removed: `csat-responses-chart.tsx`, `first-reply-time-chart.tsx`, `team-on-duty.tsx`, `support-activity.tsx`, `logo.tsx`, `dashboard/leads-over-time-chart.tsx`.
Edited: `src/app/(app)/dashboard/page.tsx`, `src/app/layout.tsx`, `src/hooks/use-mobile.ts` (fixed a pre-existing lint violation in the registry's own file), `src/components/leads/lead-form.tsx`, `note-form.tsx`, `quote-form.tsx`, `src/app/globals.css`, `components.json`.
