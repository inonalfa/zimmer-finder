#!/usr/bin/env python3
"""Generate the FAKE example dataset shipped with the repo (data/zimmers.json + data/images).

Every place, host, phone number and review here is invented. Images are drawn procedurally
with Pillow, so they carry no copyright. Run:  python scripts/make_example_data.py
"""
from __future__ import annotations

import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

PLACES = [
    # slug, name, town, region, lat, lng, price, flags, drive (min, km), palette
    ("example-oak-hill-cabin", "Oak Hill Cabin", "Rosh Pina", "Upper Galilee", 32.968, 35.542, 3890, "ij kb vp", (128, 141), "dusk"),
    ("example-cedar-spa-suite", "Cedar Spa Suite", "Amirim", "Upper Galilee", 32.937, 35.449, 4320, "ij oj k v", (125, 133), "forest"),
    ("example-basalt-stone-house", "Basalt Stone House", "Odem", "Golan Heights", 33.184, 35.756, 3650, "oj kb p", (150, 175), "sunset"),
    ("example-vineyard-loft", "Vineyard Loft", "Kerem Ben Zimra", "Upper Galilee", 33.028, 35.461, 2980, "ij k", (135, 150), "day"),
    ("example-carmel-forest-nest", "Carmel Forest Nest", "Ein Hod", "Carmel", 32.700, 34.983, 4100, "ij oj kb v", (70, 98), "forest"),
    ("example-sea-breeze-cottage", "Sea Breeze Cottage", "Shlomi", "Western Galilee", 33.074, 35.143, 3420, "oj k v", (105, 140), "sea"),
    ("example-olive-grove-retreat", "Olive Grove Retreat", "Kfar Tavor", "Lower Galilee", 32.687, 35.420, 4790, "ij oj kb vp", (95, 120), "day"),
    ("example-mountain-view-studio", "Mountain View Studio", "Majdal Shams", "Golan Heights", 33.270, 35.770, 3200, "oj b v", (165, 190), "snow"),
]

PALETTES = {
    "dusk": [(44, 62, 120), (240, 160, 120), (70, 60, 90)],
    "forest": [(150, 200, 230), (235, 240, 225), (40, 90, 60)],
    "sunset": [(250, 120, 80), (255, 210, 140), (90, 60, 60)],
    "day": [(110, 170, 230), (225, 240, 250), (110, 140, 70)],
    "sea": [(90, 160, 220), (210, 235, 250), (40, 110, 160)],
    "snow": [(140, 180, 220), (240, 245, 250), (200, 210, 220)],
}

REVIEWS = [
    "Guests love the quiet, the view from the jacuzzi and the spotless cabin.",
    "Reviewers mention a warm host, a well-stocked kitchenette and great breakfast baskets.",
    "Most guests say the photos match reality and the place is very private.",
]
FLAGS = [
    "",
    "Two reviews mention road noise in the morning.",
    "One guest says the outdoor jacuzzi took a while to heat up.",
    "",
    "The access road is steep and unpaved for the last 300 m.",
]


def draw_scene(path: Path, palette: str, seed: int, w: int = 1200, h: int = 800) -> None:
    from PIL import Image, ImageDraw, ImageFilter

    rnd = random.Random(seed)
    top, bottom, ground = PALETTES[palette]
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):  # sky gradient
        k = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * k) for i in range(3)))
    sun = (rnd.randint(150, w - 150), rnd.randint(90, 260))
    d.ellipse([sun[0] - 60, sun[1] - 60, sun[0] + 60, sun[1] + 60], fill=(255, 236, 180))
    for layer in range(3):  # hills
        base = int(h * (0.55 + 0.12 * layer))
        shade = tuple(max(0, int(c * (0.65 + 0.15 * layer))) for c in ground)
        pts = [(0, h)]
        for x in range(0, w + 60, 60):
            pts.append((x, base - int(70 * abs(((x / 180 + layer + seed) % 2) - 1)) - rnd.randint(0, 25)))
        pts.append((w, h))
        d.polygon(pts, fill=shade)
    cx, cy = rnd.randint(250, w - 350), int(h * 0.72)  # cabin
    d.rectangle([cx, cy - 120, cx + 220, cy], fill=(150, 100, 70))
    d.polygon([(cx - 25, cy - 115), (cx + 110, cy - 210), (cx + 245, cy - 115)], fill=(90, 50, 40))
    d.rectangle([cx + 85, cy - 70, cx + 135, cy], fill=(60, 40, 30))
    d.rectangle([cx + 25, cy - 95, cx + 65, cy - 55], fill=(255, 220, 140))
    d.rectangle([cx + 160, cy - 95, cx + 200, cy - 55], fill=(255, 220, 140))
    jx = cx + 260  # jacuzzi
    d.ellipse([jx, cy - 30, jx + 150, cy + 25], fill=(235, 235, 235))
    d.ellipse([jx + 12, cy - 20, jx + 138, cy + 15], fill=(70, 180, 210))
    d.text((24, h - 40), "EXAMPLE IMAGE - generated", fill=(255, 255, 255))
    img = img.filter(ImageFilter.SMOOTH)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "JPEG", quality=82, optimize=True)


def main() -> None:
    from zflib.images import make_thumb  # local package, scripts/zflib

    records = []
    for n, (slug, name, town, region, lat, lng, price, flags, (dmin, dkm), pal) in enumerate(PLACES, 1):
        f = set(flags.split())
        imgs, thumbs = [], []
        for i in range(4):
            p = DATA / "images" / slug / f"{i + 1}.jpg"
            draw_scene(p, pal, seed=n * 10 + i)
            t = make_thumb(p)
            imgs.append(p.relative_to(ROOT).as_posix())
            thumbs.append(t.relative_to(ROOT).as_posix() if t else None)
        verified = n % 3 != 0
        hist = [{"date": "2026-09-20", "total": price + (250 if n % 2 else -150), "source": "example"}, {"date": "2026-09-27", "total": price, "source": "example"}]
        records.append({
            "slug": slug,
            "name": f"{name} (example)",
            "region": region,
            "town": town,
            "unit": "Main cabin",
            "description": f"FAKE EXAMPLE LISTING. A cosy cabin for two near {town}, with wooden interiors and a deck facing the hills. This record only shows what the app looks like.",
            "summary": f"Example record. {name} is a quiet couples cabin in {region} with {'an indoor and an outdoor' if {'ij','oj'} <= f else 'a private'} jacuzzi. Prices and reviews are invented.",
            "has_private_jacuzzi": True,
            "jacuzzi_indoor": "ij" in f,
            "jacuzzi_outdoor": "oj" in f,
            "has_kitchen": "k" in f or "kb" in f,
            "has_bbq": "kb" in f or "b" in f,
            "has_view": "v" in f or "vp" in f,
            "has_pool": "p" in f or "vp" in f,
            "breakfast": "Breakfast basket on request (example)" if n % 2 else "",
            "privacy_notes": "Detached unit with its own fenced yard (example).",
            "price_total": price,
            "price_original": price + 300 if n % 4 == 0 else price,
            "price_status": "verified" if verified else "estimated",
            "price_checked_at": "2026-09-27",
            "price_note": "Example: nightly rate x nights + cleaning fee, taxes included.",
            "price_history": hist,
            "within_budget": price <= 4500,
            "availability_status": "unavailable" if n == 8 else ("verified" if verified else "unverified"),
            "availability_source": "Example data - not a real check",
            "check_in": "2027-03-11",
            "check_out": "2027-03-14",
            "phone": f"+972-50-000-00{n:02d}" if n % 4 else "04-000-0000",
            "website_url": f"https://example.com/{slug}",
            "listing_url": f"https://example.com/listing/{slug}",
            "image_urls": imgs,
            "thumb_urls": thumbs,
            "google_rating": round(4.5 + (n % 5) / 10, 1),
            "google_review_count": 20 + n * 7,
            "booking_rating": round(8.8 + (n % 4) / 5, 1) if n % 2 else None,
            "booking_review_count": 30 + n * 4 if n % 2 else None,
            "review_summary": REVIEWS[n % len(REVIEWS)],
            "review_red_flags": FLAGS[n % len(FLAGS)],
            "score": n,
            "found_date": "2026-09-20",
            "last_checked": "2026-09-27",
            "added_at": "2026-09-20T08:00:00Z",
            "is_active": n != 8,
            "lat": lat,
            "lng": lng,
            "drive_minutes": dmin,
            "drive_km": dkm,
            "geo_note": "Town-level coordinates (example)",
            "example": True,
        })
    records = [{k: v for k, v in r.items() if v is not None} for r in records]
    (DATA / "zimmers.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(records)} example records")


if __name__ == "__main__":
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    main()
