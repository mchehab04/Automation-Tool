# 26 — Quote PDF: Removed Fabricated Fields

## What I did

Between report 25 and this one, the quote PDF got a further visual redesign
(customer/vehicle info cards, quote validity date, Terms & Conditions section)
from outside this conversation — I hadn't touched it. Asked to check the updated
files, I found it had introduced real fabricated content, not just cosmetic
changes, and removed the problematic parts while keeping the improved layout.

## Main decisions / findings

- **A hardcoded, fake UAE Tax Registration Number** (`trn: "100482910300003"` in
  `render-quote.ts`) was being printed on every quote. A TRN is a real,
  verifiable regulatory identifier — this is a materially different risk than the
  placeholder address from report 25 (which is at least honestly a placeholder,
  in a real field, that the user knowingly chose). A fabricated one that *looks*
  real is exactly the kind of thing this project has consistently avoided (report
  03's de-fictionalization pass). Removed the prop entirely, from both files.
- **An invented warranty claim** in the Terms & Conditions text — "Standard
  warranty: 6 months or 10,000 km on genuine replacement parts and workmanship."
  Nobody confirmed this is real policy; printing it as fact on a customer-facing
  document would be making a business commitment that was never actually made.
  Removed.
- **A reference to a WhatsApp approval channel that doesn't exist** — "reply with
  your confirmation via WhatsApp" — this app has no WhatsApp integration
  (explicitly deferred twice, most recently report 22). A customer following that
  instruction would just be ignored. Removed.
- **Filler/placeholder text with no real data behind it** — "Job Type: Repair &
  Maintenance Quotation" and "Status: Draft Estimate" (identical on every quote,
  adds no information) in the vehicle card, and an invented "Scope of Work"
  fallback paragraph shown whenever a quote had no real notes. Removed both;
  when there are no notes, the notes box no longer renders at all (summary block
  right-aligns alone instead of leaving an invented placeholder in its place).
- **Kept everything else** — the card-based layout, the quote validity date, the
  VAT breakdown, the factual footer line (business name + quote number). None of
  that was flagged as a problem; the request was explicitly to keep the design.

## Why this matters

The specific risk with a fake TRN or an invented warranty isn't hypothetical —
this is the actual document a real customer receives and could act on (try to
verify a tax number, expect a warranty claim to be honored, reply via a channel
that goes nowhere). Cosmetic fabrication (a placeholder address) is a different
category of problem than a specific, checkable, or legally-flavored false claim.

## Files touched

- `src/lib/pdf/quote-document.tsx` — removed `trn` prop/style/render, vehicle
  card filler lines, invented notes fallback, Terms & Conditions text
- `src/lib/pdf/render-quote.ts` — removed the hardcoded `trn` value

## Next step

None outstanding — verified both the with-notes and without-notes PDF output
render correctly with nothing fabricated left in either.
