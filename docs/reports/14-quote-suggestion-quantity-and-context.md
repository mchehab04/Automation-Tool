# 14 — Quote Suggestion Quantity and Context-Aware Merging

## What was done

The user's own real-world testing (a "wheel change" enquiry, then a follow-up
clarifying "replace both rear tires") surfaced two bugs in the AI-suggested quote
drafts: the follow-up's "2 rear tires" showed up with quantity 1, and the vague
"wheel change" item from the first message stuck around alongside it instead of being
recognized as the same job — three items' worth of confusion for what was actually one
job.

## Key decisions

- **Quantity never existed as a field.** `suggested_line_items`' tool schema only ever
  had `description` + `estimated_price` — `QuoteForm` hardcoded every AI-suggested row
  to quantity `"1"` unconditionally. Added `quantity` to the schema, threaded it through
  `SuggestedLineItem`/`buildSuggestedLineItems`/`suggestedRow` (with a `|| "1"` fallback
  for suggestions saved before this fix). Also clarified `estimated_price` is
  *per-unit*, not the line total — previously ambiguous, and the two are easy to
  conflate when quantity wasn't in the picture at all.
- **The real fix is context, not a smarter merge algorithm.** Report 09's
  append-only merge was deliberately designed so a follow-up that doesn't repeat an
  earlier symptom doesn't lose it — correct for "check engine light, then *separately*
  brakes." But a follow-up that's actually *clarifying* the same vague item ("wheel
  change" → "replace 2 rear tires") isn't a new item, and no code-side heuristic can
  reliably tell those two cases apart from the text alone. Instead: for real Gmail
  intake, look up the existing lead **before** calling the AI (its email is already
  known from the header, so this ordering was free), pass its current
  `suggestedLineItems` into the prompt as "already drafted for this quote," and have
  the model return the complete corrected list rather than an incremental delta — then
  `suggestedLineItems` is *replaced* with that, not merged. The model has the actual
  judgment needed here (is this the same job or a new one?); code was only ever
  guessing.
- **Left the simulator on its old append-only behavior**, not upgraded to the same
  fix — the simulator only learns which lead it's continuing *after* the AI call
  (no real headers to look up by first), so giving it the same "already drafted"
  context would mean a second AI call per continuing message. Not something to add
  silently; flagged to the user as a known asymmetry rather than fixed unasked.

## Follow-up: description still embedding the count

The quantity fix above was only half the story — the AI was still writing the count
into the description text itself ("Replace 2 rear tires") *alongside* a separate
quantity field also set to 2, which reads as double-counted and, worse, the per-unit
price interpretation wobbled between calls (one run correctly divided a stated "$300
for both" down to $150/unit; another left it at $300, doubling to $600 once multiplied
by quantity). Fixed by rewriting the `description`/`estimated_price` field
instructions in the tool schema to be explicit and domain-general rather than
tire-specific: descriptions must be singular with the count never stated in words
("Rear tire replacement" not "Replace 2 rear tires"), and price is always per-unit,
with an explicit worked example for dividing a stated total by quantity. Deliberately
did **not** add a code-side regex to strip numbers from descriptions — that would
mangle legitimate cases where a number is part of the actual service name (e.g. "V8
tune-up", "4-wheel alignment"); the fix has to live in the model's instructions, with
human review (the existing "review before generating" step) as the backstop for any
remaining slip-ups.

Verified generality directly against the model (not just the reported tire case)
across four different scenarios: rear tires with a total price given ("Rear tire
replacement", qty 2, $150 — correctly divided from $300), four brake pads ("Brake
pad", qty 4, $50 each), two fleet oil changes ("Oil change", qty 2, $60 — already
per-unit, correctly left alone), and a single battery replacement (qty 1, no false
pluralization). All four produced clean singular descriptions with the count isolated
to the quantity field.

## Outcome

Reproduced the exact reported scenario against the real Gmail inbox and Postgres
database (seeded the vague "wheel change" message, then the clarifying "replace both
rear tires, 2024 Honda Civic, tomorrow?" follow-up): the resulting draft was a single
corrected item — `"Replace rear tires (2024 Honda Civic)"`, quantity `"2"`, $150/unit
— not three stacked items. Also verified the fix didn't overcorrect into "always
replace everything": a third message describing a genuinely separate issue (AC not
blowing cold) correctly *added* a second line item alongside the tire one rather than
discarding it. `tsc --noEmit` and `npm run lint` both clean.

## Files touched

- `src/lib/intake/extract-enquiry.ts` — `quantity` field on the tool schema,
  per-unit price clarification, `extractEnquiry()` accepts existing suggestions as
  context
- `src/lib/intake/lead-matching.ts` — `SuggestedLineItem`/`buildSuggestedLineItems`
  carry quantity
- `src/lib/gmail/intake-runner.ts` — lead lookup moved before the AI call; replaces
  `suggestedLineItems` instead of merging
- `src/components/leads/quote-form.tsx` — suggested rows use the real quantity
