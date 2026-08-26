# 06 — UAE Car Garage Lead Scrape

## What was done

Scraped 100 real car garage/auto maintenance business leads across the UAE as a prospect list for pilot outreach, per the approved plan's Part B, using the `scrape-leads` skill.

- Ran three targeted scrapes via the (now-fixed, see below) `scrape_apify.py`: 50 in Dubai, 25 in Sharjah, 25 in Abu Dhabi — matching the requested split exactly.
- Combined and deduped by Google Place ID (zero overlap found across cities).
- Delivered as a Google Sheet, created directly in the user's own Drive via a newly available Google Drive MCP connection — not the service-account/`gspread` route originally planned, since the MCP route avoids the "share the sheet with the service account" friction entirely.

## Key decisions

**Swapped the underlying Apify actor.** The skill's documented actor (`code_crafter/leads-finder`) turned out to require a paid Apify plan for programmatic/API runs ("Users on the free Apify plan can run the actor through the UI and not via other methods"). Replaced it with `compass/crawler-google-places` (Google Maps Scraper), a widely-used actor with no such restriction, on the user's free-tier Apify credits. This is a business-listing scraper rather than a people/contact finder, so `--job_titles` no longer applies and results don't include emails (the pipeline's `enrich_emails.py` step is still there for that, not yet run).

**Fixed a real bug while adapting the script.** `scrape_apify.py` and `scrape_apify_parallel.py` both called `run['defaultDatasetId']` — dict-style access — but the installed `apify-client` v3.1.3 returns a typed `Run` object, not a dict. Fixed to `run.default_dataset_id` in both files; this would have crashed on every run regardless of which actor was used.

**Ran the QA gate before scaling up**, per the skill's own documented process: a 25-lead UAE-wide test batch first, checked for ≥80% genuine auto-repair/garage matches (came back 24/25, comfortably passing) before running the full 100-lead, city-split scrape.

**Deferred `update_sheet.py`/`enrich_emails.py`** (the service-account/AnyMailFinder steps originally planned) in favor of the Drive MCP connection for sheet creation — simpler, no sharing step, lands directly in the user's own Drive. Email enrichment via AnyMailFinder hasn't been run yet; most rows already have phone numbers from Maps, several are missing both phone and website.

## Setup done to make this runnable

- `.claude/skills/scrape-leads/scripts/requirements.txt` added (no dependency manifest existed).
- A local Python venv (`.venv/`) created and dependencies installed.
- Four credentials (Apify token, Google service-account JSON, Anthropic key, AnyMailFinder key) added to `.env`; the service-account JSON saved to `service_account.json`. Both gitignored (confirmed via `git check-ignore`) before anything else touched them.
- `.gitignore` extended to cover `.tmp/` (scraped lead data), credential file default names, and `.venv/`.

## Outcome

100 real UAE garage/auto-maintenance leads delivered as a Google Sheet in the user's own Drive: https://docs.google.com/spreadsheets/d/1a9b-l33gTH6WKiiKzo8hB_frr64un44VccF3IEIl9yQ/edit — 50 Dubai / 25 Sharjah / 25 Abu Dhabi, deduped, ~95%+ genuine category match. A handful of Maps-category noise (a gas station, a vehicle inspection center, a couple of parts/tire/battery-only stores) came through and would need manual filtering for a stricter list.

## Files touched

New: `.claude/skills/scrape-leads/scripts/requirements.txt`, `.tmp/dubai_leads.json`, `.tmp/sharjah_leads.json`, `.tmp/abudhabi_leads.json`, `.tmp/combined_leads.csv`, `.tmp/combine_leads.py` (all gitignored, not committed). Edited: `.claude/skills/scrape-leads/scripts/scrape_apify.py` (actor swap + bug fix + dead-code removal), `scrape_apify_parallel.py` (same bug fix), `.env`, `.gitignore`.
