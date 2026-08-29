# 22 — UAE Market Research: Deferred Pending a Real Pilot

## What I did

Reviewed exploratory research the user did on UAE (Dubai/Abu Dhabi/Sharjah) auto
service businesses — WhatsApp-first customer communication, pick-up/drop-off
recovery, pre-quote digital vehicle inspection (DVI), Genuine/OEM/Aftermarket parts
tiering, insurance LPO approval stalls for collision work, and 5% VAT with bilingual
(EN/AR) receipts — compared against the current `src/lib/pipeline.ts` stages. Gave a
recommendation; user confirmed this is exploratory market scoping, not tied to a
real UAE pilot customer.

## Main decisions / findings

- **Two findings are worth building regardless of market**: a missing "vehicle
  in-shop / work in progress" stage between `SCHEDULED` and `WON` (right now the
  pipeline has no state for "car's here, being worked on, scope may still change" —
  a real correctness gap for any multi-day-turnaround shop, not just UAE ones), and
  capturing vehicle make/model/year at `QUALIFIED` (currently "qualified" only means
  "has a name and a way to reach them," which is a weak bar). Both cheap, both
  additive, neither UAE-specific.
- **Everything else — WhatsApp intake, DVI, parts tiering, insurance LPO, VAT +
  bilingual PDFs — deferred until there's an actual UAE pilot**, not built
  speculatively. Reasoning: this is exactly the "premature ML" mistake from the
  original chatroom debate (`docs/reports/01-idea-scoping-chatroom.md`) in a
  different shape — building compliance/localization for a market with no
  confirmed customer is optimizing for a guess. WhatsApp intake specifically has
  already been deferred twice now (report 05's original scoping, and again here).
- **A real tension worth being honest about, not smoothing over**: despite this
  being "exploratory," the app already has UAE-specific behavior live —
  `src/lib/timezone.ts` hardcodes `Asia/Dubai` for scheduling (report 20), and the
  Calendar tab (report 21) is UAE-anchored. That wasn't a market bet; report 20
  frames it as "fixed the known rough edge that scheduling had no real timezone
  handling," most likely anchored to the user's own actual timezone rather than a
  deliberate UAE go-to-market decision. Still, it means "UAE" isn't hypothetical in
  this codebase the way the "exploratory" framing might suggest — worth knowing
  before assuming a different market later would be a clean swap.
- **Deploy status, checked while I was in here**: no automated test suite exists
  yet (`playwright.config.ts` still doesn't exist anywhere), and there's a
  `feat: pre-vercel deployment` commit but no `.vercel/` link on this machine and no
  report documenting an actual live URL — so it's unclear from the repo alone
  whether the Tue 2026-09-01 deploy target has actually happened yet or is still in
  progress. Not resolved in this pass — flagged for the user to confirm.

## Why this matters

The whole point of writing this down now, while it's still "exploratory," is so a
future decision to actually commit to the UAE market (or not) has a real record of
what was already known and considered, instead of that research quietly evaporating
or getting rediscovered from scratch later.

## Risks / things to keep in mind

- The decision log and project index haven't been updated for reports 09 through
  21 — a lot of real work (quote drafting, real Gmail send, service catalogue,
  scheduling, calendar tab, business category, UAE timezone) landed without going
  through this backfill. Only this report's own entry gets added below; the
  09–21 gap is a separate catch-up task, not done here.
- If a real UAE pilot does materialize later, re-read this report first — the
  priority order above (WIP stage + vehicle details now; WhatsApp/DVI/parts-tiers/
  LPO/VAT later) was reasoned about assuming no concrete customer. A real pilot
  changes that ordering, possibly a lot (VAT in particular is a legal requirement,
  not a nice-to-have, the moment there's a real UAE transaction).

## Files touched

- `docs/reports/22-uae-market-research-deferred.md` (this report)
- `docs/03-decisions/decision-log.md` (new entry)
- `docs/00-project-index.md` (new row + stale-backfill note)

## Next step

Confirm whether the Tue 2026-09-01 deploy actually went live. Separately, when
there's time before or after that: add the WIP pipeline stage and vehicle
make/model/year capture, the two near-term items from this research that don't
depend on a UAE pilot existing.
