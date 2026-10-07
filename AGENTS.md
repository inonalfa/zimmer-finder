# AGENTS.md - playbook for AI agents

This file tells any coding or research agent (Claude Code, Cursor, Codex, ChatGPT with tools, Grok Bot,
Gemini CLI, Aider, ...) how to run a vacation rental search with this repo. Humans: you can give your agent
a one-line instruction such as *"Read AGENTS.md and find us a zimmer for next weekend, budget 2000, and give
me the app link"*.

## Definition of done (read this first)

**The result of every search is an app the user can open - never only a report.** A markdown or chat
summary is welcome, but it does not replace the app. You are done only when all of these are true:

1. `trip.config.json` reflects the user's request (step 1 below).
2. `data/zimmers.json` holds the results and passes validation (`python3 scripts/zf.py validate` prints
   `0 problems`; without Python, follow `schema/zimmer.schema.json` exactly).
3. The app shows those results, delivered with **the first path below that you can do**:

| You can... | Deliver | Give the user |
| --- | --- | --- |
| **A.** push to the user's GitHub repo | commit `data/` (JSON + images) and push to `main`; the Pages workflow deploys | the link `https://<owner>.github.io/<repo>/` - only after it returns 200 (step 7A) |
| **B.** run commands, but not push | `npm install && npm run bundle` | the file `dist-single/zimmer-finder.html` as an attachment (opens by double-click, works offline) |
| **C.** only chat (no code, no files) | output the complete `zimmers.json` (a file attachment, or one JSON code block) | the viewer link `https://inonalfa.github.io/zimmer-finder/` + "tap **Load data** and choose / paste the file". If the user agrees to a public Gist, give `https://inonalfa.github.io/zimmer-finder/?data=<raw gist URL>` instead - one click. |

4. Your last message contains **a clickable link or the attached file**, plus a 3-5 line summary
   (top picks, what is unverified, which sources failed).

Details for each path are in [step 7](#7-deliver-the-app-mandatory).

## Ground rules

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
python3 scripts/zf.py clear-example --yes   # remove the fake demo records, past trip and taste profile
```

## 0.5 Read the taste profile (start of every search)

`data/preferences.json` (schema: `schema/preferences.schema.json`) is what this user liked and disliked on
past trips. It is learned from votes, so it gets better every trip. At the start of a search:

1. Run `python3 scripts/zf.py taste` (or read the file). It prints the strongest likes and dislikes, for
   everyone (`*`) and per voter, plus the drive time and price per night they usually accept.
2. Use it as defaults the request did not override: put strong likes (weight >= 1) into `nice_to_have`,
   search those regions first, skip places with strong dislikes unless nothing else fits.
3. **Tell the user what you assumed from past trips**, in one short line, so they can correct you. Example:
   "From your past trips I assumed: detached unit, outdoor jacuzzi with a view, no place next to the hosts'
   house, up to about 2.5 h drive. Say if this trip is different."
4. If the user corrects you, save it: `python3 scripts/zf.py learn --feature near_host --weight -1.5 --note
   "Hates being next to the hosts"` (`--voter NAME` for one person). Explicit notes win over learned weights.

No file yet? Skip this step; the profile appears after the first trip with votes.

## 1. Read and update the config (before searching)

Read `trip.config.json` first. Translate the user's request into it and **save it before you search**:

- "next weekend" -> real dates: `trip.check_in` (Friday) and `trip.check_out` (Sunday) in `YYYY-MM-DD`,
  computed from today's date. Always write absolute dates.
- "budget 2000" -> `budget.max_total: 2000` (total for the stay, in `app.currency`).
- guests -> `trip.adults` / `trip.children`; "from Haifa" -> `origin.name` (and `lat` / `lng` if you know them).
- areas, must-haves, nice-to-haves, language (`app.locale`: `he` for Hebrew, `en` for English).

Ask the user only about things you cannot infer and that change the search (for example the number of
guests). If the user wrote in Hebrew, set `app.locale` to `he` and write summaries and reviews in Hebrew.
If `data/zimmers.json` still holds the fake example records (`"example": true`), remove them first:
`python3 scripts/zf.py clear-example --yes` (or replace the file with your results).

## 2. Search wide

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

## 3. Write the records

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

## 4. Enrich and validate

```bash
python3 scripts/zf.py enrich      # geocode towns (Nominatim), drive times from origin (OSRM),
                                  # download photos + thumbnails, rank, then validate
python3 scripts/zf.py validate    # must print "0 problems"
python3 scripts/zf.py list        # quick table
```

Individual steps: `geocode`, `drive`, `images [--slug S]`, `rank`. Nominatim and OSRM are free public
services: the scripts send a User-Agent, wait 1 second between geocoding calls and cache results. Set
`ZF_USER_AGENT` to something that identifies you, and do not run them in tight loops.

## 5. Rank and present

Rank by fit to `must_have` first, then `nice_to_have`, then review quality, price and drive time. Flag
anything over `budget.max_total` (`within_budget: false`). `zf.py rank` gives a sensible default; feel free
to set `score` yourself and explain why in `notes`. When `data/preferences.json` exists, `rank` also writes
`fit_score` (0-100) and `fit_reasons` on every record (`--voter NAME` for one person's taste). The app shows
them as "Fits you" on cards and "Why it fits you" on the detail page, and can sort by fit.

Then **deliver the app (step 7)**. Your summary for the user goes next to the link: the top 3-5 with
price, status and the main pro and con, what you could not verify, and which sources failed.

## 6. Keep it fresh (recurring checks)

Prices and availability change daily. Two routines work well:

- **Daily (morning)**: re-check every place someone liked, or every active place if there are few. For each:
  ```bash
  python3 scripts/zf.py price <slug> <new_total> --source booking      # appends price_history
  python3 scripts/zf.py sold-out <slug> --reason "no availability on Airbnb and Booking"
  python3 scripts/zf.py available <slug> --reason "available again on Booking"
  ```
- **Twice a week**: run steps 2-4 again to find new places.

Tell the user only about real changes: new matches, sold out, a meaningful price change, new places. Stop
the routines after the trip dates or when the user has booked.

How to schedule depends on your agent: a scheduled task / cron in your agent platform, a local `cron`
entry that starts your agent CLI with this file, or the included GitHub Actions workflow
(`.github/workflows/refresh.yml`), which runs the **network scripts** (geocode, drive, images, validate) on a
schedule and commits the result. Searching listing sites still needs an agent.

## 7. Deliver the app (mandatory)

Pick the first path you can do. Do not stop at a report.

### A. You can push to the user's GitHub repo

```bash
python3 scripts/zf.py validate
git add trip.config.json data/
git commit -m "data: search results for <dates>"
git push origin main
```

The `Deploy to GitHub Pages` workflow publishes the site. **Never hand over a link you have not seen
return HTTP 200.** Forks and new repos often have Pages (and on forks, Actions) turned off, and the link is
then a 404. Before you give the link:

```bash
R=<owner>/<repo>
# 1. Pages enabled with source "GitHub Actions"? Enable it if not (needs admin rights on the repo).
gh api "repos/$R/pages" -q .build_type 2>/dev/null \
  || gh api -X POST "repos/$R/pages" -f build_type=workflow
gh api -X PUT "repos/$R/pages" -f build_type=workflow 2>/dev/null || true   # if it was "legacy"
# 2. Run the deploy and wait for it
gh workflow enable deploy.yml -R "$R" 2>/dev/null || true
gh workflow run deploy.yml -R "$R" --ref main
sleep 5
gh run watch "$(gh run list -R "$R" --workflow deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
# 3. The site must answer 200 (it can take a minute after the run)
curl -s -o /dev/null -w "%{http_code}\n" "https://<owner>.github.io/<repo>/"
```

Only when step 3 prints `200`, give the user `https://<owner>.github.io/<repo>/` (add `?lang=he` for Hebrew
if the config is English).

If you cannot do steps 1-2 (no `gh`, no admin rights, Actions disabled on a fork), **deliver with path B or C
right now** so the user has an app today, and give them these exact one-time steps for their own site:

1. Settings > Pages > Build and deployment > Source: **GitHub Actions**.
2. Forks only: Actions tab > **I understand my workflows, go ahead and enable them**.
3. Actions > **Deploy to GitHub Pages** > **Run workflow**, wait for the green check, then open
   `https://<owner>.github.io/<repo>/`.

### B. You can run commands, but cannot push

```bash
npm install
npm run bundle        # -> dist-single/zimmer-finder.html (app + data + photos in ONE file)
```

Attach `dist-single/zimmer-finder.html` to your answer. The user opens it by double-click on a computer or
phone; it needs no server (map tiles load when online). Big photo sets fall back to thumbnails to keep the
file small (`--max-mb`, `--thumbs-only`). If you cannot attach files but can run a local server, `npm run dev`
and give `http://localhost:5173` only when the user is on the same machine.

### C. You can only chat

Write the complete records as JSON that follows `schema/zimmer.schema.json` (remote `image_urls` are fine)
and give it as a downloadable `zimmers.json` file, or as a single fenced JSON code block. Then tell the user:

> Open https://inonalfa.github.io/zimmer-finder/ , tap **Load data** (טעינת נתונים), and choose the file or
> paste the JSON.

If the user agrees to a public link and you can publish a Gist or any URL that allows cross-origin reads, give a one-click link instead:
`https://inonalfa.github.io/zimmer-finder/?data=<URL-encoded raw URL>`. GitHub `blob` and Gist page links
are converted to raw links automatically. The user's own fork works the same way at
`https://<owner>.github.io/<repo>/`.

Shared votes between two phones need the Supabase option ([docs/votes-supabase.md](docs/votes-supabase.md));
without it votes stay in each browser.

## 8. After the votes: learn, then archive

When the user has voted (or says the trip is booked):

1. Get the votes. Shared Supabase store: `python3 scripts/zf.py learn --from-store`. Local votes (the
   default store, one browser): ask the user to open **Your taste** (`?v=taste`) and tap **Export votes**,
   then `python3 scripts/zf.py learn --votes votes.json`. Votes in `data/votes.json` are read by default.
2. `learn` keeps every observation and recomputes the weights, so running it twice is harmless.
3. Archive the trip so the next search starts clean but remembers it:
   `python3 scripts/zf.py archive --votes votes.json` (moves records, photos and votes to
   `data/trips/<check_in>-<name>/`). Commit `data/preferences.json` and `data/trips/`.
4. Tell the user in one line what the profile learned (`zf.py taste` prints it).

## Checklist before you finish

- [ ] You read `data/preferences.json` (if any) and told the user what you assumed from past trips
- [ ] `trip.config.json` matches the request (absolute dates, budget, guests, origin, language)
- [ ] `python3 scripts/zf.py validate` prints 0 problems
- [ ] The app is delivered (path A, B or C) and your final message has the link or the attached file
- [ ] Path A: you saw the Pages URL return 200 (never hand over a 404 link)
- [ ] `npm test` and `npm run build` pass if you touched code
- [ ] No secrets, cookies or personal data in `data/` or the config
- [ ] Every `verified` price and availability was checked for the exact dates
- [ ] You told the user what is uncertain
