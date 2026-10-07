# Zimmer Finder

**Let your AI agent find the cabin. You and your partner just swipe and vote.**

Zimmer Finder is an open-source, agent-agnostic toolkit for finding a vacation rental (a *zimmer*, cabin or
villa) for exact dates, budget and must-haves. Any AI agent that can browse and run commands (Claude Code,
Cursor, Codex, ChatGPT, Grok Bot, Gemini CLI ...) follows [`AGENTS.md`](AGENTS.md) to search the web,
verify prices and availability, and write the results to a JSON file. A fast static web app shows them with
photos, reviews, a map, drive times and couple voting.

No backend, no account and no API key needed. Deploy free on GitHub Pages or just run it locally.

| Desktop | Mobile |
| --- | --- |
| ![List view](docs/screenshots/desktop-list.png) | ![Mobile list](docs/screenshots/mobile-list.png) |
| ![Detail page](docs/screenshots/desktop-detail.png) | ![Mobile detail](docs/screenshots/mobile-detail.png) |
| ![Map with drive times](docs/screenshots/desktop-map.png) | ![Hebrew RTL](docs/screenshots/mobile-list-hebrew.png) |

<sub>Screenshots use the bundled **fake example data** and generated images.</sub>

## Features

- **Cards with photo carousels**, a detail page, a gallery and a full-screen photo feed (swipe for the next
  photo, double-tap a side to jump to the next or previous place, swipe up for details).
- **Prices you can trust**: final total for your dates, per night, verified / estimated chip, last checked
  date and price history arrows.
- **Reviews at a glance**: Google, Booking and Airbnb rating badges, a guest summary and red flags.
- **Couple voting**: like / dislike with a display name, "match" when two people liked it, dislikes hidden.
- **Map** (Leaflet + OpenStreetMap) with drive times from your home town (OSRM, no traffic).
- **Filters and sorting**: region, max price, max drive, indoor + outdoor jacuzzi, verified only.
- **New** badges since your last visit and a **sold out** section.
- **One tap WhatsApp** with a ready-made availability question (you send it, the agent never does).
- **English and Hebrew (RTL)**, any currency, one config file.

## Quick start

1. **Get the code** - click **Use this template** (or fork), then clone your copy:
   ```bash
   git clone https://github.com/<you>/zimmer-finder && cd zimmer-finder && npm install
   ```
2. **Ask your agent** - open the folder in your agent and say:
   > Read AGENTS.md. We are 2 adults, 11-14 March, budget 4,500, from Haifa, must have a private jacuzzi. Find us a place.

   The agent updates `trip.config.json`, clears the example data, searches, and writes `data/zimmers.json`.
3. **Look and vote** - `npm run dev` and open http://localhost:5173, or push to GitHub: the included
   workflow publishes the site to GitHub Pages (Settings > Pages > Source: *GitHub Actions*, once).

Want to see it first? Step 1 plus `npm run dev` shows the example data.

## How it works

```mermaid
flowchart LR
    U([You]) -- "trip details" --> A[Your AI agent<br/>reads AGENTS.md]
    A -- "search, verify<br/>prices + availability" --> W[(Airbnb, Booking,<br/>local sites, Google Maps)]
    A -- "zf.py merge / enrich" --> S[scripts/zf.py]
    S -- "Nominatim + OSRM" --> G[(geocoding,<br/>drive times)]
    S --> D[(data/zimmers.json<br/>+ data/images)]
    C[trip.config.json] --> S
    C --> APP
    D --> APP[Static web app<br/>React + Vite]
    APP -- "votes" --> V[(browser storage<br/>or Supabase)]
    APP --> P([You + partner<br/>browse and vote])
```

| Piece | Default | Optional |
| --- | --- | --- |
| Data | `data/zimmers.json` (JSON file in the repo) | Base44 entity ([integrations/base44](integrations/base44)) |
| Votes | browser `localStorage` | Supabase free tier ([docs/votes-supabase.md](docs/votes-supabase.md)), Base44 |
| Hosting | `npm run dev` or GitHub Pages | Netlify, Vercel, Cloudflare Pages, any static host (`npm run build` > `dist/`) |
| Recurring checks | your agent's scheduler | `.github/workflows/refresh.yml` cron for the scripts |

## Configuration

Everything lives in [`trip.config.json`](trip.config.json) (validated by
[`schema/trip.config.schema.json`](schema/trip.config.schema.json)):

```jsonc
{
  "app": { "title": { "en": "Zimmer Finder", "he": "מחפש הצימרים" }, "locale": "en", "currency": "ILS" },
  "trip": { "check_in": "2027-03-11", "check_out": "2027-03-14", "adults": 2, "children": 0 },
  "budget": { "max_total": 4500 },
  "origin": { "name": "Tel Aviv", "lat": 32.0853, "lng": 34.7818 },  // drive times are from here
  "region": { "country": "Israel", "country_code": "IL", "phone_country_code": "972", "mobile_prefixes": ["5"],
              "areas": ["Upper Galilee", "Golan Heights"], "map_center": [32.9, 35.4], "map_zoom": 8 },
  "must_have": ["private jacuzzi", "kitchen or kitchenette"],
  "nice_to_have": ["BBQ", "view"],
  "storage": { "data": { "adapter": "json" }, "votes": { "adapter": "local" } }
}
```

Set `"locale": "he"` for a Hebrew right-to-left UI, or add `?lang=he` / `?lang=en` to the URL.

## Scripts

`scripts/zf.py` is a small, dependency-free CLI (Python 3.10+; `pip install pillow` for thumbnails):

| Command | Does |
| --- | --- |
| `merge new.json` | add or update records, dedupe by slug / listing URL / phone + town + unit |
| `validate` | check `data/zimmers.json` and the config against the JSON Schemas |
| `geocode`, `drive` | town coordinates (Nominatim, 1 req/s) and drive time from origin (OSRM) |
| `images [--slug S]` | download photos to `data/images/<slug>/` and make 480px thumbnails |
| `price SLUG TOTAL [--source booking]` | record a checked price and append price history |
| `sold-out SLUG...` / `available SLUG...` | availability changes |
| `rank`, `list`, `enrich` | default ranking, a quick table, or geocode + drive + images + rank + validate |
| `clear-example --yes` | remove the fake demo data |

## Development

```bash
npm run dev        # dev server with hot reload
npm run check      # ESLint + Vitest + Python unittest + data validation + production build
npm run format     # Prettier
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the repo map and guidelines.

## Responsible use and disclaimer

This project is a personal trip-planning tool. It does not include scrapers for any specific website.
**Airbnb, Booking.com, Google and other sites have terms of service that may restrict automated access or
reuse of their content.** You and your agent are responsible for complying with the terms of every site you
use, with local law, and with privacy rules. Prefer official APIs and manual checks, go slowly, never bypass
captchas or logins, and keep photos and texts for private use only. Prices and availability shown by the app
can be outdated or wrong: always confirm with the host before booking. The software is provided "as is"
under the [MIT License](LICENSE), without warranty of any kind.

Map data (c) [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Routing by
[OSRM](https://project-osrm.org). Please follow the
[Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) and the
[tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

---

<div dir="rtl">

## בעברית

**מחפש הצימרים** הוא פרויקט קוד פתוח שנותן לסוכן ה-AI שלכם למצוא צימר, ולכם נשאר רק לעבור על התוצאות ולהצביע.

כל סוכן שיודע לגלוש ולהריץ פקודות (Claude Code, Cursor, ChatGPT, Grok Bot ועוד) קורא את הקובץ `AGENTS.md`, מחפש באתרים, מאמת מחיר וזמינות לתאריכים שלכם, ושומר את התוצאות בקובץ JSON. אפליקציית אינטרנט סטטית מציגה את הצימרים עם תמונות, ביקורות, מפה, זמני נסיעה והצבעה זוגית. לא צריך שרת, חשבון או מפתח API.

### מתחילים ב-3 צעדים

1. **מעתיקים את הקוד** - לוחצים על Use this template (או Fork), משכפלים ומריצים `npm install`.
2. **מבקשים מהסוכן** - פותחים את התיקייה בסוכן וכותבים למשל: "תקרא את AGENTS.md. אנחנו זוג, 11-14 במרץ, תקציב 4,500 ש"ח, יוצאים מחיפה, חובה ג'קוזי פרטי. תמצא לנו צימר."
3. **צופים ומצביעים** - מריצים `npm run dev`, או דוחפים ל-GitHub והאתר עולה ל-GitHub Pages אוטומטית.

### מה יש באפליקציה

- כרטיסים עם קרוסלת תמונות, דף פרטים, גלריה ותצוגת מסך מלא עם החלקה והקשה כפולה
- מחיר סופי לתאריכים, מחיר ללילה, מאומת או משוער, והיסטוריית מחירים
- דירוגים מגוגל, Booking ו-Airbnb, סיכום ביקורות ונקודות לתשומת לב
- הצבעה זוגית עם "התאמה" כששניכם אהבתם
- מפה עם זמני נסיעה מהעיר שלכם, סינון ומיון
- כפתור וואטסאפ עם הודעה מוכנה לבדיקת זמינות (אתם שולחים, לא הסוכן)
- עברית מימין לשמאל או אנגלית, כל מטבע, קובץ הגדרות אחד: `trip.config.json`

### שימוש אחראי

לאתרים כמו Airbnb, Booking וגוגל יש תנאי שימוש שעשויים להגביל איסוף אוטומטי של מידע. האחריות לעמוד בתנאים, בחוק ובכללי הפרטיות היא של המשתמש. המחירים והזמינות באפליקציה יכולים להשתנות, ולכן תמיד מאמתים מול המארח לפני שמזמינים.

</div>
