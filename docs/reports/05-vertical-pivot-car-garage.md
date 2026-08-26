# 05 — Vertical Pivot: Car Garage / Auto Maintenance

## What was done

Narrowed the target vertical from the chatroom debate's "auto dealership" (`active/chatroom/chatroom_report.md`) to **car garage / auto maintenance shops** specifically — the closest adjacent vertical, chosen deliberately to minimize rework rather than reopen the full vertical debate.

An inventory of every dealership-specific piece of the app (run before making changes) found the actual footprint was small: the Prisma schema has zero dealership-specific fields (no VIN, no trade-in column — it was already vertical-agnostic per the chatroom's own "config layer, no vertical content in the core" architecture decision), and all UI copy was already generic. The only real vertical-specific content was in `src/lib/pipeline.ts`'s `REASON_CODES` table: 3 of 11 Won/Lost reason codes assumed a dealership (`financing_approved`, `trade_in_accepted` under Won; `financing_fell_through` under Lost). Replaced with garage-appropriate equivalents:

- Won: `insurance_covered` ("Insurance covered the repair"), `quick_availability` ("Could fit them in quickly") — replacing `financing_approved` and `trade_in_accepted`.
- Lost: `parts_unavailable` ("Needed parts weren't available in time") — replacing `financing_fell_through`.

The other 8 reason codes (price, competitor, timing, repeat customer, etc.) were already vertical-neutral and left unchanged.

## Key decision

Left the historical chatroom docs (`active/chatroom/chatroom_report.md`, `chat.json`, `docs/reports/01-idea-scoping-chatroom.md`) untouched — those are a decision record of what was actually debated and concluded at the time ("auto dealership," reasoned from founder-network access). Rewriting them to say "car garage" would misrepresent what the 5-agent debate actually produced. This report exists specifically to document the pivot without erasing that record.

Also deliberately did **not** touch `prisma/seed.ts` — the demo data (business name, 8 of 9 lead companies) was already vertical-neutral; not worth the churn for one automotive-adjacent seed lead name.

## Outcome

`tsc --noEmit` and `eslint` clean. No schema/migration change, so no dev-server restart needed — pure data-literal edit, hot-reloads. Existing historical Activity records with the old reason codes (`financing_approved`, etc.) will display their raw code string via `getReasonLabel`'s fallback rather than a friendly label — expected and correct, not a bug: real historical data under a relabeled vocabulary, not something to silently rewrite.

## Files touched

`src/lib/pipeline.ts` (REASON_CODES only).
