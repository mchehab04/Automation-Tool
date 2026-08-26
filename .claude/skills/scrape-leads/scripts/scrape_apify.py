#!/usr/bin/env python3
"""
Scrape leads using Apify's compass/crawler-google-places actor (Google Maps
Scraper). Switched from code_crafter/leads-finder, which restricts
programmatic/API runs to paid Apify plans ("Users on the free Apify plan can
run the actor through the UI and not via other methods") -- this actor has
no such restriction and runs fine on Apify's normal pay-per-usage free credits.

Note this is a business-listing scraper (Google Maps), not a people/contact
finder: --job_titles doesn't apply (Maps has no job-title concept) and
results won't include emails -- that's what enrich_emails.py is for.
"""

import os
import sys
import json
import argparse
from datetime import datetime
from dotenv import load_dotenv
from apify_client import ApifyClient

# Load environment variables
load_dotenv()

def scrape_leads(query, location, max_items, job_titles=None, company_keywords=None, require_email=True):
    """
    Run the Apify actor to scrape leads.
    """
    api_token = os.getenv("APIFY_API_TOKEN")
    if not api_token:
        print("Error: APIFY_API_TOKEN not found in .env", file=sys.stderr)
        return None

    client = ApifyClient(api_token)

    if job_titles:
        print("Note: --job_titles is ignored -- Google Maps Scraper finds businesses, not job contacts.")
    if not require_email:
        pass  # require_email/--no-email-filter is a no-op here: Maps listings never include emails.

    search_terms = [query]
    if company_keywords:
        search_terms = [f"{query} {kw}".strip() for kw in company_keywords]

    run_input = {
        "searchStringsArray": search_terms,
        "locationQuery": location,
        "maxCrawledPlacesPerSearch": int(max_items),
        "language": "en",
    }

    print(f"Starting scrape for '{query}' in '{location}' (Limit: {max_items})...")
    print(f"Debug: run_input = {json.dumps(run_input, indent=2)}")

    try:
        # Run the actor and wait for it to finish
        run = client.actor("compass/crawler-google-places").call(run_input=run_input)
    except Exception as e:
        print(f"Error running actor: {e}") # Print to stdout
        return None

    if not run:
        print("Error: Actor run failed to start", file=sys.stderr)
        return None

    print(f"Scrape finished. Fetching results from dataset {run.default_dataset_id}...")

    # Fetch results from the actor's default dataset
    results = []
    for item in client.dataset(run.default_dataset_id).iterate_items():
        results.append(item)

    return results

def save_results(results, output=None, prefix="leads"):
    """
    Save results to a JSON file.
    If output is provided, use it as the full file path.
    Otherwise, generate a timestamped file in .tmp/.
    """
    if not results:
        print("No results to save.")
        return None

    if output:
        filename = output
        output_dir = os.path.dirname(filename)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = ".tmp"
        os.makedirs(output_dir, exist_ok=True)
        filename = f"{output_dir}/{prefix}_{timestamp}.json"

    with open(filename, "w") as f:
        json.dump(results, f, indent=2)

    print(f"Results saved to {filename}")
    return filename

def main():
    parser = argparse.ArgumentParser(description="Scrape leads using Apify")
    parser.add_argument("--query", required=True, help="Search query (e.g., 'Plumbers')")
    parser.add_argument("--location", required=True, help="Location (e.g., 'New York')")
    parser.add_argument("--max_items", type=int, default=25, help="Maximum number of items to scrape")
    parser.add_argument("--output", default=None, help="Full output file path (e.g., .tmp/leads.json)")
    parser.add_argument("--output_prefix", default="leads", help="Prefix for auto-generated output file (ignored if --output is set)")
    parser.add_argument("--job_titles", nargs='+', help="Specific job titles to target (e.g., CEO Founder)")
    parser.add_argument("--company_keywords", nargs='+', help="Company keywords to filter (e.g., 'software' 'SaaS')")
    parser.add_argument("--no-email-filter", action="store_true", help="Don't filter by validated emails (faster, larger results)")

    args = parser.parse_args()

    require_email = not args.no_email_filter
    results = scrape_leads(args.query, args.location, args.max_items, args.job_titles, args.company_keywords, require_email)
    
    if results:
        print(f"Found {len(results)} leads.")
        save_results(results, output=args.output, prefix=args.output_prefix)
    else:
        print("No leads found or error occurred.")
        sys.exit(1)

if __name__ == "__main__":
    main()
