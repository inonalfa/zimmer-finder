# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org).

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
