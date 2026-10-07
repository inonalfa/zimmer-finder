# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org).

## [1.2.0] - 2026-10-07

### Added
- Taste profile that learns across trips: `data/preferences.json` (schema `schema/preferences.schema.json`)
  with smoothed like / dislike weights per feature, for everyone and per voter, plus explicit notes.
- `zf.py learn` (votes from `data/votes.json`, an exported file or the Supabase store), `zf.py taste`,
  `zf.py archive` (moves a finished trip to `data/trips/<name>/`); `zf.py rank` writes `fit_score` and
  `fit_reasons` and uses them in the default ranking (`--voter` for one person).
- App: "Fits you" badge and top reasons on cards, "Why it fits you" on the detail page, sort by fit, and a
  **Your taste** page (`?v=taste`, English and Hebrew) with an **Export votes** button.
- The single-file bundle embeds the taste profile.
- Records: `is_detached`, `near_host_house`, `fit_score`, `fit_reasons`.
- Fake past trip and example profile; Python and JS tests; screenshots `taste*.png`, `card-fit*.png`,
  `detail-fit*.png`.

### Changed
- `AGENTS.md`: read the profile at the start of a search and tell the user what was assumed; learn and
  archive after voting.
- `zf.py clear-example` also removes the fake past trip and the profile learned from it.

## [1.1.1] - 2026-10-07

### Added
- README (English and Hebrew): "Turn on your site" one-time steps with an annotated illustration
  (`docs/screenshots/setup-pages.png`); **Use this template** recommended over Fork.
- Deploy workflow checks first that GitHub Pages is enabled with source "GitHub Actions" and fails with a
  clear message and the settings link when it is not (common on forks).

### Changed
- `AGENTS.md` path A: the agent checks / enables Pages, runs the deploy, waits for it and verifies the URL
  returns 200 before sharing it; otherwise it delivers with path B or C and gives the setup steps.

## [1.1.0] - 2026-10-07

### Added
- **Definition of done** in `AGENTS.md`: every search must end with an app the user can open, delivered by
  the first path the agent can do - push and GitHub Pages, a single offline HTML file, or JSON for the
  hosted viewer. A report alone is not enough.
- `npm run bundle`: one self-contained `dist-single/zimmer-finder.html` with the app, data and photos.
- Viewer mode: `?data=<url>` loads records from a raw GitHub, Gist or any CORS-enabled URL (GitHub `blob`
  and Gist page links are converted), with validation and a clear error message.
- **Load data** dialog (file picker, paste box, URL) in English and Hebrew; loaded data is kept in the
  browser with a banner and a "back to the default data" button.

### Changed
- `AGENTS.md` now starts by turning the user's request (for example "next weekend, budget 2000") into
  absolute dates and budget in `trip.config.json` before searching.
- README quick start rewritten around the three delivery paths.

## [1.0.0] - 2026-10-07

### Added
- Static React app: cards with photo carousels, detail page, gallery and full-screen viewer with swipe and
  double-tap navigation, filters and sorting, rating badges, review red flags, price chips and history,
  new and sold-out sections, Leaflet + OpenStreetMap map with drive times, prefilled WhatsApp question.
- Couple voting with matches; vote stores for the browser (default), Supabase and Base44.
- Data adapters for a local JSON file (default) and Base44.
- One config file, `trip.config.json`, with English and Hebrew (RTL) UI.
- `scripts/zf.py`: merge and dedupe, JSON Schema validation, Nominatim geocoding, OSRM drive times, photo
  download with thumbnails, price history, sold-out marking, ranking.
- `AGENTS.md` playbook for any AI agent, GitHub Actions for CI, Pages deploy and optional data refresh.
- Fake example data with generated images.
