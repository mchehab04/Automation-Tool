# 04 — Analytics Tab

## What was done

Added a new "Analytics" item to the sidebar (`/analytics`), between Leads and the footer. The page answers the two things the user asked for: a summarized analytics report, and specifically why leads are won or lost.

- **Stat row**: total leads, leads won, leads lost, win rate — all real counts, no fabricated figures (reused the existing `DashboardStats`/`Stat` component rather than duplicating it).
- **Two reason-breakdown panels** ("Why leads are won" / "Why leads are lost"), each a horizontal-bar ranked list by count and percentage, colored with the single status hue for that outcome (green for Won, red for Lost) rather than a multi-color categorical palette — the bars differ by length within one dimension (reason), not by identity, so one hue is the correct choice per the dataviz method used earlier for the funnel chart.
- Shows the **full fixed reason vocabulary** for each outcome (from `REASON_CODES` in `lib/pipeline.ts`), including reasons with zero occurrences so far, rather than only showing reasons that have happened — a true 0 count, not an omission that could read as "no data."

## Key decision

Kept this deliberately separate from the Dashboard rather than folding it in or duplicating Dashboard's charts here — Dashboard stays the operational "what's happening now" view (funnel, lead volume, lead source, recent leads); Analytics is the "why" report the reason-code capture work was originally built for. Scoped to the in-app breakdown only, per the earlier discussion — no PDF/exportable report yet; that's a distinct follow-up if actually needed.

## Outcome

New: `src/app/(app)/analytics/page.tsx`, `src/components/reason-breakdown-card.tsx`. Edited: `src/components/app-shared.tsx` (nav entry). `tsc`/`eslint` clean; `/analytics`, `/dashboard`, `/leads` all smoke-test at 200. No schema change, so no dev-server restart needed.
