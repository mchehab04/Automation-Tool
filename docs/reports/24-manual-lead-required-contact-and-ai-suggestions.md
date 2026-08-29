# 24 — Manual Lead: Required Contact Info + AI Quote Suggestions from Notes

## What I did

Two changes to the manual "Add lead" flow, both requested together: email and
phone are now required fields (previously both optional), and the free-text note
staff write is now run through the same AI extraction email intake already uses —
so a manually-created lead gets AI-suggested quote line items and, if mentioned,
vehicle make/model/year, instead of nothing.

## Main decisions / findings

- **Reused `extractEnquiry` with a new "manual" mode** rather than writing a
  separate extraction path. The existing `simulated`/`real` modes both deal with
  triaging a customer's own message (deciding if it's a genuine enquiry, drafting
  a reply for missing info) — none of that applies here, since staff already typed
  the contact info directly into the form. The new prompt tells the model to
  ignore `name`/`email`/`phone`/`company`/`draft_reply`/`acknowledgment_message`
  entirely and just mine the note for quote-suggestion grounding and vehicle
  details. Reusing the same tool schema (rather than a second one) keeps the
  catalogue-grounding logic identical across all three intake paths.
- **Non-blocking, matching `generateClosingReport`'s established pattern**: the AI
  call is wrapped in try/catch. If it fails, the lead still gets created — a
  failed suggestion isn't allowed to block the actual "Add lead" action, same
  reasoning already applied elsewhere in this codebase.
- **Only runs when a note is present** — no note means nothing to extract from, so
  skip the API call entirely rather than making a pointless request.
- **Vehicle details captured from the note flow straight into the same fields the
  QUALIFIED dialog uses** (report 23) — if a manually-created lead's note already
  named the car, staff seeing the QUALIFIED dialog later get it pre-filled instead
  of retyping something already known.
- **Found and fixed a stale UI string while in here**: `/leads/new`'s card
  description still said "Name is required — everything else is optional," which
  became actively wrong the moment email/phone became required too.

## Why this matters

Manually-created leads were the one intake path with zero AI assistance — email
intake (simulated and real) both got quote suggestions from day one, but a staff
member typing a lead in by hand got nothing, even when they wrote exactly the same
kind of descriptive note a customer's email would contain. This closes that gap.
Requiring email and phone also means every manually-created lead now has the same
contact-completeness guarantee AI-created leads increasingly do, which matters for
the existing contact-matching logic (`findExistingLeadByContact`) working
consistently regardless of how a lead entered the pipeline.

## Risks / things to keep in mind

- This adds a real Anthropic API call (and its latency, ~1-3s typically) to the
  "Add lead" button whenever a note is filled in — previously instant. Consistent
  with how the rest of the app already treats a multi-second AI wait as acceptable
  UX (quote generation, closing reports), but worth knowing this one specific
  action got slower.
- No retry/visible-failure UX if the AI call fails — it silently just doesn't
  populate suggestions, logged server-side only (`console.error`). Matches the
  existing `generateClosingReport` behavior exactly, so at least it's consistent,
  but neither surfaces a failure to staff.

## Files touched

- `src/lib/intake/extract-enquiry.ts` — new `manual` system-prompt mode
- `src/lib/actions/leads.ts` — `createLead` requires email/phone, calls
  `extractEnquiry` in `manual` mode when a note is present, wires results into
  the lead's `suggestedLineItems`/`vehicleMake`/`vehicleModel`/`vehicleYear`
- `src/components/leads/lead-form.tsx` — email/phone required-field validation
  and asterisks
- `src/app/(app)/leads/new/page.tsx` — corrected the now-stale "everything else
  is optional" description

## Next step

None outstanding from this request — verified end-to-end (missing-email rejected,
missing-phone rejected, a full submission with a note mentioning a 2018 Honda
Accord and an oil change + squeaking brakes correctly produced catalogue-grounded
suggestions and the right vehicle fields).
