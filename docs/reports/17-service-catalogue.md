# 17 — Service Catalogue for AI Email-Intake Grounding

## What was done

Added a per-business service catalogue (a price list of parts/labor, e.g. "Oil change —
$65") and wired it into the real Gmail-intake AI extraction step, so
`suggested_line_items` reuse real catalogue prices/wording instead of the model freely
inventing them. Came out of the user reviewing `schema.prisma` and asking where a
garage's own pricing would live, given nothing backed `Quote.lineItems`/
`Lead.suggestedLineItems` before this. Scoped down in discussion to: AI-intake only (not
the manual quote form), real Gmail intake only (not the simulator, which doesn't have
lead/business context available before its `extractEnquiry` call), and seed data only (no
admin UI to manage the catalogue yet).

## Key decisions

- **New `ServiceCatalogItem` model**, scoped to `Business` via `businessId`, matching the
  project's existing conventions exactly: `cuid()` id, `@@index([businessId])`, no
  `onDelete: Cascade` on the `Business` relation (nothing else cascades off `Business`
  deletion either).
- **`unitPrice` stored in cents as an `Int`**, matching `Quote.totalAmount`'s documented
  rounding-safety rationale — confirmed with the user rather than assumed, since it
  differs from `Lead.suggestedLineItems`/`ExistingSuggestion`'s existing whole-dollar-string
  convention. The conversion happens only at the `extractEnquiry()` prompt boundary
  (`CatalogItem.unitPrice` is a whole-dollar string there, same shape as
  `ExistingSuggestion`), not carried through the rest of the app.
- **Context-injection mirrors the existing `existingSuggestions` pattern exactly** rather
  than inventing a new style: a new optional `catalogItems` parameter on `extractEnquiry`,
  a conditional string block appended to the user message, plus one added sentence each on
  the `suggested_line_items` tool-schema description and `SYSTEM_PROMPTS.real` telling the
  model to prefer a catalogue entry's exact description/price when it matches, but to still
  free-text anything genuinely not catalogued.
- **No fuzzy-matching layer** — the AI is simply given the catalogue as prompt context and
  asked to prefer it. The user explicitly reasoned that because a human still reviews every
  quote before it's sent, imperfect AI matching is an acceptable trade-off.
- **Migration applied via the established raw-pg workaround**: `prisma migrate dev` failed
  with the same `P1001` (IPv6/IPv4 DNS split) seen in report 08. Hand-wrote the
  `CREATE TABLE`/`CREATE INDEX`/`ADD CONSTRAINT` SQL matching the exact style of the
  existing `init_postgres` migration, applied it via a raw `pg.Pool` script, and
  hand-inserted the `_prisma_migrations` bookkeeping row — but this time verified the
  checksum algorithm (plain SHA-256 hex of the migration.sql file bytes) against all 5
  existing migration rows before trusting it, rather than assuming it from memory.
- **Seed script uses delete-then-recreate** for the catalogue rows (`prisma/seed.ts`),
  keeping `npm run db:seed` safely re-runnable for the catalogue specifically, without a
  `(businessId, description)` uniqueness constraint.

## Outcome

- Migration applied cleanly; `npx prisma generate` and `npm run db:seed` both ran without
  error, seeding `demo-business` with 6 catalogue rows (verified correct cent values,
  e.g. "Oil change" → `6500`).
- **Caught and fixed my own mistake during verification**: re-running `db:seed` to test the
  catalogue also duplicated the 9 fixed demo leads, since the seed script has never upserted
  leads (a known limitation flagged back in report 08, but not one I'd internalized would
  bite here). Caught it immediately via a duplicate-count query, deleted the 9 newly-created
  duplicates (keeping each original, identified by the earlier `createdAt`), and confirmed
  the real accumulating test lead ("Sarah Kim") and other live-testing leads were untouched.
- Isolated `extractEnquiry()` calls confirmed the grounding works as intended: an oil-change
  enquiry without the catalogue got a freely-guessed `$60`; the same enquiry with the
  catalogue got the exact catalogued `$65`. A control enquiry about something not catalogued
  (worn wiper blades) still got a freely-invented, reasonable line item rather than being
  forced into a wrong catalogue match — and separately, a vague "AC isn't blowing cold"
  symptom was correctly matched to the catalogue's "Diagnostic inspection" entry, showing
  the grounding works on symptom-to-service matching, not just exact keyword overlap.
- End-to-end via the real `runGmailIntake()` path: sent a real follow-up email ("could you
  also do an oil change?") on the real test lead's existing Gmail thread. Correctly
  continued the lead (`leadsContinued: 1`) and added `{ "Oil change", qty 1, $65 }` —
  catalogue-grounded, not guessed — while keeping the two pre-existing suggested items
  intact.
- **One real, minor side effect observed, not hidden**: that same run also added a
  near-duplicate "Diagnostic inspection ($95)" item alongside the lead's pre-existing,
  differently-worded "Air conditioning system diagnostic ($100)" item — the model treated
  the catalogue entry and the earlier custom-worded suggestion as two separate things
  rather than recognizing the overlap. Left as-is rather than papering over it: this is
  exactly the kind of imperfect match the human-review step exists to catch, and the
  fallback would be prompt-tuning specifically for this collision case, not something to
  guess a fix for without more examples.
- `tsc --noEmit` and `npm run lint` both clean.

## Files touched

- `prisma/schema.prisma` — new `ServiceCatalogItem` model, `Business.catalogItems` relation
- `prisma/migrations/20260827122232_add_service_catalog_item/migration.sql` — new
- `prisma/seed.ts` — seeds 6 demo catalogue items for `demo-business`
- `src/lib/intake/extract-enquiry.ts` — new `CatalogItem` type, `catalogItems` param on
  `extractEnquiry`, catalogue context block, tool-schema and system-prompt instruction edits
- `src/lib/gmail/intake-runner.ts` — fetches the business's catalogue alongside the existing
  lead lookup, converts cents → whole-dollar strings, passes it into `extractEnquiry`
