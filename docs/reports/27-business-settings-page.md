# 27 — Business Settings Page (Address + Service Catalogue Admin)

## What I did

Built the first item from the "before WhatsApp" list: a `/settings` page so the
business name/address and the service catalogue can actually be managed without
touching the seed script or the database directly. These were the two gaps
flagged in reports 23 and 25 — `ServiceCatalogItem` and `Business.address` both
existed in the schema but had no UI at all.

## Main decisions / findings

- **One page, two cards** — Business Details (name + address, single save) and
  Service Catalogue (table + add/edit dialog + delete), rather than splitting
  into separate routes. Both are small, related, "how this business is
  configured" settings — didn't seem worth two nav entries for this much content.
- **Reused the reason-code dialog's state pattern, not the (buggier) one I wrote
  first.** My first pass reset the dialog's fields via a derived-state-during-
  render check keyed on item identity — worked for switching between different
  items, but reopening the *same* item after cancelling without saving would
  show the stale unsaved values instead of the real ones. Rewrote to match
  `stage-select.tsx`'s existing pattern exactly: field state lives in the parent,
  reset explicitly inside `openAdd`/`openEdit`, not derived during render. Caught
  this by actually thinking through the reopen case, not by lint or type errors —
  both versions type-checked and linted clean.
- **New catalogue items inherit the business's own `category`** automatically
  (queried at creation time) — matches report 20's decision that a catalogue item
  is always 1:1 scoped to its business's vertical, not independently chosen per
  item.
- **Wired up `sonner` for real** — the `Toaster` component and `sonner` package
  were already installed but never actually mounted anywhere (`<Toaster />` was
  missing from `layout.tsx`, so any `toast()` call anywhere would have silently
  done nothing). Added it to the root layout since this page's save/add/edit/
  delete actions all need real success/error feedback — first real usage of a
  primitive that had been sitting unused.
- **Delete has no confirmation step** — matches the existing pattern elsewhere in
  this app (`QuoteForm`'s remove-line-item button also deletes immediately, no
  confirm dialog). Consistent, not a shortcut specific to this feature.

## Why this matters

Before this, "run this business" meant editing `prisma/seed.ts` and reseeding
(which has its own known duplication bug, report 20) any time a price changed or
the address needed updating. That's not something a real business owner — or
anyone without touching code — could do. This closes that gap for the two fields
that actually needed it.

## Risks / things to keep in mind

- No auth, so `/settings` is reachable by anyone who can reach the app at all —
  consistent with the rest of this single-tenant demo (no page has auth yet), not
  a new gap this feature introduces, but worth remembering it's not scoped to
  "admin only" in any real sense.
- `Business.category` still isn't editable here (deliberately — nothing branches
  on it yet per report 20, so there's nothing meaningful to expose a control for).

## Files touched

- `src/lib/actions/business-settings.ts` — new: `updateBusinessDetails`,
  `createCatalogItem`, `updateCatalogItem`, `deleteCatalogItem`
- `src/components/settings/business-details-form.tsx` — new
- `src/components/settings/catalog-manager.tsx` — new
- `src/app/(app)/settings/page.tsx` — new
- `src/components/app-shared.tsx` — new "Settings" nav entry
- `src/app/layout.tsx` — mounted `<Toaster />` (previously installed, unused)
- `src/lib/validation.ts` — `MAX_LENGTHS.businessName`/`businessAddress`

## Next step

#2 from the ordered list: the automated test suite (Playwright), now covering
this page too along with the rest of the pipeline.
