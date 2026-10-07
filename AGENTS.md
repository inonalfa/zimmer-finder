# AGENTS.md - playbook for AI agents

This file tells any coding or research agent (Claude Code, Cursor, Codex, ChatGPT with tools, Grok Bot,
Gemini CLI, Aider, ...) how to run a vacation rental search with this repo. Humans: you can give your agent
a one-line instruction such as *"Read AGENTS.md and find us a place for the trip in trip.config.json"*.

## Ground rules (read first)

1. **Never contact hosts, never book, never pay, never submit forms or create accounts.** You research and
   prepare; the user decides and reaches out. The app has a prefilled WhatsApp button the *user* can tap.
2. **Respect the sites you visit.** Read each site's terms of service and robots.txt. Prefer official APIs or
   pages the user can see without logging in. Go slowly (a few seconds between pages), never bypass
   captchas, bot checks, paywalls or logins. If a source blocks you, record it as failed and move on.
3. **Only store public listing information** needed for the decision. Do not collect reviewers' names or
   other personal data. Host phone numbers only when they are published for bookings.
4. **Never commit secrets** (API keys, cookies, tokens). `trip.config.json` and `data/` are committed and,
   on GitHub Pages, public.
5. **Be honest about certainty.** A price is `verified` only after a dated check for the exact dates with the
   final total (taxes and fees included). Otherwise it is `estimated`. Same for availability.

## 0. Setup (once)

```bash
npm install                 # web app (Node 18+)
python3 --version           # 3.10+; scripts are stdlib only
pip install pillow          # optional, for thumbnails
python3 scripts/zf.py clear-example --yes   # remove the fake demo records
```

Read `trip.config.json`. If something the search needs is missing (dates, guests, budget, origin, region,
must-haves), ask the user once, then write it into `trip.config.json`.

## 1. Search wide

Search every source in `sources`, for the exact `trip.check_in` / `trip.check_out` and guest count:

| Source | Use it for |
| --- | --- |
| Airbnb, Booking.com, Vrbo (dated search URLs) | availability and final price for the dates |
| Local listing portals for the country | properties that are not on the big sites |
| The property's own website | units, amenities, direct price list |
| Google Maps | rating, review count, recent reviews, coordinates |
| Free web search in the local language and in English | by region and by feature ("private jacuzzi cabin Upper Galilee") |

Tips:
- Plain HTTP fetches are often blocked; a real (headless) browser with the local locale and timezone works
  better. Accept cookie banners; do not log in.
- One record per **rentable unit**. A property with three different suites is three records with the same
  `town` and `phone` and a different `unit`.
- Match Google Maps places by name + town and check the distance to the listing; write uncertain matches in
  `geo_note` / `notes`.
- Collect photos of **that unit** only, largest size, no logos, maps or people. Keep the source URLs in
  `image_urls`; the images script downloads them.

## 2. Write the records

Each record follows [`schema/zimmer.schema.json`](schema/zimmer.schema.json). The important fields:

| Field | Meaning |
| --- | --- |
| `slug` | stable id, lowercase-dashes (e.g. `oak-hill-cabin-rosh-pina`). Never change it later - votes use it. |
| `name`, `unit`, `town`, `region` | what and where |
| `has_private_jacuzzi`, `jacuzzi_indoor`, `jacuzzi_outdoor`, `has_kitchen`, `has_bbq`, `has_view`, `has_pool` | amenities as booleans (omit when unknown) |
| `privacy_notes`, `breakfast` | free text |
| `price_total` | final total for the whole stay in `app.currency`, incl. taxes and fees |
| `price_estimate` | a rough total when no final price is known |
| `price_status` | `verified` or `estimated` |
| `price_note` | how you computed the total (nightly x nights + cleaning + VAT ...) |
| `availability_status` | `verified`, `unverified` or `unavailable` |
| `availability_source` | how and where you checked |
| `phone`, `whatsapp`, `email`, `website_url`, `listing_url`, `alt_listing_url` | contact and links |
| `google_rating`, `google_review_count`, `google_reviews_url`, `booking_rating`, `airbnb_rating`, ... | ratings per site |
| `review_summary`, `google_review_summary`, `review_red_flags` | what guests praise / complain about, in the UI language |
| `summary` | 2-4 sentences written **only** from collected data |
| `image_urls` | photo URLs (remote at first, local after step 3) |
| `score` | rank, 1 = best (you can let `zf.py rank` compute it) |

Write all new or updated records of a run into a temporary file (a JSON array) and merge it. Merging dedupes
by slug, listing URL, and phone + town + unit, keeps `found_date`, and appends `price_history`:

```bash
python3 scripts/zf.py merge /tmp/search-results.json
```

## 3. Enrich and validate

```bash
python3 scripts/zf.py enrich      # geocode towns (Nominatim), drive times from origin (OSRM),
                                  # download photos + thumbnails, rank, then validate
python3 scripts/zf.py validate    # must print "0 problems"
python3 scripts/zf.py list        # quick table
```

Individual steps: `geocode`, `drive`, `images [--slug S]`, `rank`. Nominatim and OSRM are free public
services: the scripts send a User-Agent, wait 1 second between geocoding calls and cache results. Set
`ZF_USER_AGENT` to something that identifies you, and do not run them in tight loops.

## 4. Rank and present

Rank by fit to `must_have` first, then `nice_to_have`, then review quality, price and drive time. Flag
anything over `budget.max_total` (`within_budget: false`). `zf.py rank` gives a sensible default; feel free
to set `score` yourself and explain why in `notes`.

Show the result:

```bash
npm run dev        # http://localhost:5173
```

Summarise for the user: the top 3-5 with price, status and the main pro and con, what you could not verify,
and which sources failed.

## 5. Keep it fresh (recurring checks)

Prices and availability change daily. Two routines work well:

- **Daily (morning)**: re-check every place someone liked, or every active place if there are few. For each:
  ```bash
  python3 scripts/zf.py price <slug> <new_total> --source booking      # appends price_history
  python3 scripts/zf.py sold-out <slug> --reason "no availability on Airbnb and Booking"
  python3 scripts/zf.py available <slug> --reason "available again on Booking"
  ```
- **Twice a week**: run steps 1-3 again to find new places.

Tell the user only about real changes: new matches, sold out, a meaningful price change, new places. Stop
the routines after the trip dates or when the user has booked.

How to schedule depends on your agent: a scheduled task / cron in your agent platform, a local `cron`
entry that starts your agent CLI with this file, or the included GitHub Actions workflow
(`.github/workflows/refresh.yml`), which runs the **network scripts** (geocode, drive, images, validate) on a
schedule and commits the result. Searching listing sites still needs an agent.

## 6. Publish

Commit `data/` and push. The `Deploy` workflow builds the site and publishes it to GitHub Pages (enable
Pages with source "GitHub Actions" once). Votes: see [docs/votes-supabase.md](docs/votes-supabase.md) for
shared votes between two phones.

## Checklist before you finish

- [ ] `python3 scripts/zf.py validate` prints 0 problems
- [ ] `npm test` and `npm run build` pass if you touched code
- [ ] No secrets, cookies or personal data in `data/` or the config
- [ ] Every `verified` price and availability was checked for the exact dates
- [ ] You told the user what is uncertain
