# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org).

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
