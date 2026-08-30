# 29 — Dashboard Banner Image Compression

## What I did

Compressed `public/dashboard-banner.jpg` — the last item on the pre-WhatsApp
list. 3.81MB → 0.52MB (86.5% smaller), resized from 5760×3840 down to 2400×1600.

## Main decisions / findings

- **Scoped down from a bigger idea, deliberately.** Before touching the image,
  the user asked whether this should become a real "change banner" upload
  feature, or offer a set of alternate images to pick from. Flagged the real
  constraint before doing either: Vercel's production filesystem is read-only/
  ephemeral, so "upload from your device" isn't a small addition — it needs real
  object storage (Vercel Blob), a new `Business` field, an upload UI, and
  server-side re-compression on upload, i.e. its own task, not a quick polish
  item. A preset gallery would also need real images sourced from the user,
  since fabricating stock photos isn't something to do unprompted (same
  reasoning as the quote PDF cleanup, report 26). User chose to keep this
  scoped to just compressing the existing image — customizable banners stay a
  separate, later feature if wanted.
- **2400px width, not smaller** — the banner renders via `next/image` with
  `fill` and `sizes="100vw"`, so Next's own image optimizer already generates
  device-appropriate variants at request time; the *source* just needed to stop
  being needlessly larger than any realistic display size (2400px comfortably
  covers a large monitor at 2x pixel density for this banner's actual on-page
  height). Confirmed the source was genuinely oversized — original was
  5760×3840, but the banner only ever renders at `h-40 sm:h-48` (160–192px
  tall).
- **Quality checked visually, not just by file size** — read the compressed
  output back before replacing the original; no visible compression artifacts
  at `quality: 78` with mozjpeg encoding.
- **`sharp` was already available** (a transitive dependency, likely pulled in
  by Next's own image pipeline) — no new dependency added for this.

## Why this matters

This closes out every item from the original "before WhatsApp" list (reports
27, 28, 29) — settings admin UI, automated tests, and now this. Small on its
own, but it was the last open item blocking that list.

## Files touched

- `public/dashboard-banner.jpg` — replaced with the compressed version

## Next step

None outstanding from the pre-WhatsApp list. The two smaller items from report
22's audit (the unresolved Select/SelectTrigger hydration warning, and the
stale `docs/quote-redesign/` proposal folder) are still open but were flagged
as lower-priority than the four items just closed — worth a look before or
during WhatsApp work, not strictly blocking it.
