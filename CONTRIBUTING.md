# Contributing

Thanks for helping! Bug reports, translations, new data adapters and docs improvements are all welcome.

## Development setup

```bash
npm install
npm run dev            # http://localhost:5173 with the example data
npm run check          # lint + JS tests + Python tests + data validation + build
```

Python 3.10+ is enough for the scripts (stdlib only). `pip install pillow` enables thumbnails and the
example image generator. `pip install ruff` for Python linting (`ruff check scripts tests`).

## Repository map

| Path | What |
| --- | --- |
| `src/` | React + Vite + Tailwind web app |
| `src/storage/data.js` | data adapters (`json`, `base44`) |
| `src/storage/votes.js` | vote stores (`local`, `supabase`, `base44`) |
| `src/i18n/` | `t()` helper and translations (English source strings, `he.js`) |
| `src/lib/zimmer-utils.js` | formatting, prices, phones, WhatsApp message |
| `scripts/zf.py` | CLI for agents: merge, validate, geocode, drive, images, price, sold-out, rank |
| `scripts/zflib/` | the logic behind the CLI (tested in `tests/`) |
| `schema/` | JSON Schemas for `data/zimmers.json` and `trip.config.json` |
| `data/` | the records and downloaded photos (example data in the repo) |
| `integrations/base44/` | optional Base44 backend definitions |

## Guidelines

- Keep the default path dependency free: no backend, no account, no API key.
- UI strings go through `t("English text")`; add the Hebrew translation to `src/i18n/he.js`
  (a test checks that placeholders match). Use logical CSS (`start` / `end`) where you can so RTL works.
- New record fields: add them to `schema/zimmer.schema.json` and document them in `AGENTS.md`.
- Never commit real listings, host phone numbers, personal data or secrets. Example data must stay fake
  (`python scripts/make_example_data.py` regenerates it).
- Writing style in docs and UI: short sentences, plain words, the ASCII hyphen `-` (no long dashes).
- Use [Conventional Commits](https://www.conventionalcommits.org) for messages (`feat:`, `fix:`, `docs:` ...).

## Adding a language

1. Copy `src/i18n/he.js` to `src/i18n/<code>.js` and translate the values.
2. Register it in `src/i18n/index.js` (`DICTS`, and `RTL` if it is right-to-left).
3. Allow the code in `schema/trip.config.schema.json` (`app.locale`).
