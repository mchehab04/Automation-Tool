# 34 — Invoices

## What I did

Item #5 from the pipeline-improvements list: invoices, generated once a
lead is Won, starting as an editable copy of the lead's quote (so extra
work found on the job can be reflected in the final bill), emailed to the
customer the same way quotes are, with manual paid/unpaid tracking — no
online payment collection (that stays a separate, later feature, #8).

## Main decisions / findings

- **Confirmed three scope questions with the user before designing**: when
  invoices become available (once Won — matches this app's existing
  definition of Won as "service completed," not just quote acceptance),
  whether the line items should be an editable copy of the quote or an
  exact mirror (editable copy, confirmed), and whether invoices get emailed
  like quotes or stay internal-only (emailed, confirmed).
- **`Invoice` mirrors `Quote` deliberately** (own number sequence,
  `lineItems`, PDF, send flow) rather than reusing `Quote` with a flag —
  the two have genuinely different lifecycles (a quote is proposed, an
  invoice is billed and tracked for payment) and reusing `Quote` would have
  meant retrofitting payment-tracking fields onto a model that quote-flow
  code already depends on not having them.
- **Extracted `LineItemsForm` from `QuoteForm`** rather than duplicating
  its row-management logic (add/remove/edit rows, shake-on-invalid,
  dollar/cent math) into a second component — real, non-trivial logic that
  would otherwise drift between quote and invoice forms if a bug fix only
  landed in one. Purely mechanical, no behavior change to the quote path:
  verified by running the full Playwright suite (`pipeline.spec.ts`
  exercises `createQuote` end-to-end) as a baseline *before* writing any
  invoice-specific code, confirming the refactor alone didn't regress
  anything.
- **`VAT_RATE` extracted to a shared `src/lib/vat.ts`**, imported by both
  PDF templates — same reasoning, avoids the quote and invoice VAT rates
  silently drifting apart if it's ever changed in one file and not the
  other.
- **Server-side gate, not just UI**: `createInvoice` throws if the lead
  isn't Won, even though the form only renders when Won — matches this
  app's established pattern of never trusting the UI alone (Proxy,
  `requireOwner`, `updateLeadStage`'s gates). Verified directly: called
  `createInvoice` against a non-Won lead via a temporary debug route and
  confirmed it threw rather than silently succeeding.
- **New invoice seeds from the most recent existing invoice if one already
  exists, otherwise the most recent quote** — so a correction (a second
  invoice) builds on the last real bill rather than the original quote
  going stale.

## Outcome

Verified end-to-end against the real dev server and DB, walking a
throwaway lead through the actual stage-transition UI (not shortcuts) to
Won, generating a real quote along the way:

- Server-side Won gate: confirmed `createInvoice` throws against a
  non-Won lead.
- Invoice form correctly pre-filled from the lead's quote
  ("Brake pad replacement" carried over).
- Edited the pre-filled price before submitting (simulating "found extra
  work" mid-job) — confirmed the edited amount ($175, not the quoted $150)
  is what actually got saved and totaled.
- PDF renders correctly: "INVOICE" title, no "Valid Until" field, a green
  "PAID"/amber "UNPAID" status badge, correct customer/vehicle info,
  correct VAT (5%) math ($350 subtotal → $17.50 VAT → $367.50 total),
  correct footer — read the actual generated PDF back to confirm this
  visually, not just that the route returned 200.
- Sent the invoice — confirmed `sentAt` was actually set in the database
  (caught and corrected my own test script's first false negative here: it
  queried the DB before a legitimately slow ~3s request — PDF render +
  email attempt — had finished committing; re-checking after the write
  actually completed confirmed it worked).
- Toggled paid — confirmed `paidAt` set, and the PDF's status badge
  switched to PAID on re-render.

`npx tsc --noEmit` and `npm run lint` both clean. Full Playwright suite —
**10/10 passed**, run both before touching invoice code (baseline, confirms
the `LineItemsForm` refactor didn't regress quotes) and again after
everything was built.

## Files touched

- `prisma/schema.prisma` — `Invoice` model, `Lead.invoices`,
  `Notification.invoiceId`, `NotificationType.INVOICE_SEND_PENDING`,
  `ActivityType.INVOICE_GENERATED`
- `prisma/migrations/20260901004636_invoice_table/`,
  `.../20260901004645_activity_type_invoice_generated/`,
  `.../20260901004652_notification_type_invoice_send_pending/` — new
- `src/lib/vat.ts` — new; `src/lib/pdf/quote-document.tsx` — now imports
  `VAT_RATE` instead of defining it locally
- `src/lib/pdf/invoice-document.tsx`, `src/lib/pdf/render-invoice.ts` — new
- `src/lib/quote-number.ts` — `formatInvoiceNumber`
- `src/lib/invoice-message.ts` — new, `defaultInvoiceMessage`
- `src/lib/actions/invoices.ts` — new (`createInvoice`,
  `sendInvoiceToCustomer`, `toggleInvoicePaid`)
- `src/components/leads/line-items-form.tsx` — new, extracted from
  `quote-form.tsx`
- `src/components/leads/quote-form.tsx` — now a thin wrapper over
  `LineItemsForm` (same external props, no call-site changes)
- `src/components/leads/invoice-form.tsx`,
  `src/components/leads/send-invoice-card.tsx`,
  `src/components/leads/invoice-paid-toggle.tsx` — new
- `src/app/api/invoices/[id]/pdf/route.ts` — new
- `src/app/(app)/leads/[id]/page.tsx` — new Invoice card (Won-only),
  `seedInvoiceLineItems` computation

## Risks / things to keep in mind

- No edit-in-place or delete for a generated invoice — matches how `Quote`
  already works (generate a new one for a correction). Multiple invoices
  per lead are structurally supported but not the expected common case.
- Quote/invoice numbering (`findFirst orderBy number desc, +1`) is racy
  under concurrent creates — pre-existing behavior on the `Quote` side,
  carried over as-is rather than fixed as part of this feature (out of
  scope; noted here so it isn't mistaken for something new).

## Next step

#4 (analytics) and #8 (payments) are still deferred to the end, as
previously agreed. #4 can now meaningfully report on real invoiced/paid
revenue rather than only pipeline-stage stats, if that's the next one
picked up.
