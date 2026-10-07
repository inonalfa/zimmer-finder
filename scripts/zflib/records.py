"""Pure record logic: slugs, dedupe/merge, price history, sold-out marking, ranking."""
from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime, timezone
from urllib.parse import urlsplit, urlunsplit


def today() -> str:
    return date.today().isoformat()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(*parts: str) -> str:
    """ASCII slug from name/town/unit. Non-Latin text is dropped, so pass an English name or town too."""
    text = " ".join(p for p in parts if p)
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return re.sub(r"-{2,}", "-", text)[:80] or "place"


def canonical_url(url: str | None) -> str | None:
    """Listing URL without query/fragment/trailing slash, lowercased host: used to spot duplicates."""
    if not url:
        return None
    try:
        p = urlsplit(url.strip())
    except ValueError:
        return url
    host = p.netloc.lower().removeprefix("www.")
    host = re.sub(r"^(?:[a-z]{2}\.)?(airbnb)\.[a-z.]+$", r"\1", host)  # airbnb.co.uk / airbnb.com -> airbnb
    return urlunsplit((p.scheme.lower() or "https", host, p.path.rstrip("/"), "", ""))


def _digits(s: str | None) -> str:
    return re.sub(r"\D", "", s or "")[-9:]


def same_place(a: dict, b: dict) -> bool:
    """Heuristic duplicate check: same slug, same listing URL, or same phone + town + unit."""
    if a.get("slug") and a.get("slug") == b.get("slug"):
        return True
    ua = {canonical_url(a.get(k)) for k in ("listing_url", "alt_listing_url")} - {None}
    ub = {canonical_url(b.get(k)) for k in ("listing_url", "alt_listing_url")} - {None}
    if ua & ub:
        return True
    pa, pb = _digits(a.get("phone")), _digits(b.get("phone"))
    return bool(pa and pa == pb and a.get("town") == b.get("town") and (a.get("unit") or "") == (b.get("unit") or ""))


def _all_local(urls) -> bool:
    return bool(urls) and all(isinstance(u, str) and u.startswith("data/") for u in urls)


def merge_record(old: dict, new: dict) -> dict:
    """New non-empty values win; history is appended; first-seen fields are kept."""
    out = dict(old)
    for k, v in new.items():
        if v is None or v == "" or v == []:
            continue
        if k == "price_history":
            continue
        if k in ("found_date", "added_at", "slug") and old.get(k):
            continue
        if k in ("image_urls", "thumb_urls") and _all_local(old.get("image_urls")):
            continue  # photos were already downloaded; keep the local copies
        out[k] = v
    hist = list(old.get("price_history") or [])
    for h in new.get("price_history") or []:
        hist = add_price_point({"price_history": hist}, h.get("total"), h.get("date"), h.get("source"))
    if hist:
        out["price_history"] = hist
    return out


def merge(existing: list[dict], incoming: list[dict]) -> tuple[list[dict], dict]:
    """Merge incoming records into existing ones. Returns (records, stats)."""
    out = [dict(r) for r in existing]
    stats = {"added": 0, "updated": 0}
    taken = {r.get("slug") for r in out}
    for rec in incoming:
        rec = dict(rec)
        match = next((r for r in out if same_place(r, rec)), None)
        if match is not None:
            out[out.index(match)] = merge_record(match, rec)
            stats["updated"] += 1
            continue
        base = rec.get("slug") or slugify(rec.get("name", ""), rec.get("town", ""), rec.get("unit", ""))
        slug, n = base, 2
        while slug in taken:
            slug, n = f"{base}-{n}", n + 1
        rec["slug"] = slug
        rec.setdefault("found_date", today())
        rec.setdefault("added_at", now_iso())
        rec.setdefault("is_active", True)
        taken.add(slug)
        out.append(rec)
        stats["added"] += 1
    return out, stats


def add_price_point(rec: dict, total, on: str | None = None, source: str | None = None) -> list[dict]:
    """Append {date,total,source} unless the last point has the same total. Same-day points are replaced."""
    hist = [dict(h) for h in rec.get("price_history") or [] if isinstance(h, dict)]
    if not isinstance(total, (int, float)):
        return hist
    on = on or today()
    hist.sort(key=lambda h: str(h.get("date")))
    if hist and hist[-1].get("date") == on:
        hist.pop()
    if hist and hist[-1].get("total") == total:
        return hist
    point = {"date": on, "total": total}
    if source:
        point["source"] = source
    hist.append(point)
    return hist


def set_price(rec: dict, total: float, status: str = "verified", nights: int | None = None, on: str | None = None,
              source: str | None = None, budget: float | None = None) -> dict:
    """Record a newly checked price on a record (in place) and return it."""
    on = on or today()
    rec["price_history"] = add_price_point(rec, total, on, source)
    rec["price_total"] = total
    rec["price_status"] = status
    rec["price_checked_at"] = on
    if nights:
        rec["price_per_night"] = round(total / nights)
    if budget:
        rec["within_budget"] = total <= budget
    return rec


def mark_sold_out(rec: dict, reason: str = "", on: str | None = None) -> dict:
    rec["availability_status"] = "unavailable"
    rec["is_active"] = False
    rec["last_checked"] = on or today()
    if reason:
        rec["availability_source"] = reason
    return rec


def mark_available(rec: dict, verified: bool = True, reason: str = "", on: str | None = None) -> dict:
    rec["availability_status"] = "verified" if verified else "unverified"
    rec["is_active"] = True
    rec["last_checked"] = on or today()
    if reason:
        rec["availability_source"] = reason
    return rec


def rank(records: list[dict], budget: float | None = None, weights: dict | None = None) -> list[dict]:
    """Default ranking (score 1 = best): available first, then must-have fit, rating, price and drive time.
    Agents can overwrite `score` with their own judgement; this is a sensible fallback."""
    w = {"both_jacuzzi": 2.0, "rating": 1.5, "price": 1.0, "drive": 0.5, "fit": 1.5, **(weights or {})}

    def price(r):
        return r.get("price_total") if isinstance(r.get("price_total"), (int, float)) else r.get("price_estimate")

    prices = [p for p in (price(r) for r in records) if isinstance(p, (int, float))]
    lo, hi = (min(prices), max(prices)) if prices else (0, 1)

    def value(r):
        v = 0.0
        if r.get("jacuzzi_indoor") and r.get("jacuzzi_outdoor"):
            v += w["both_jacuzzi"]
        g = r.get("google_rating") or (r.get("airbnb_rating") or 0) or ((r.get("booking_rating") or 0) / 2)
        v += w["rating"] * max(0.0, (g - 4.0)) if g else 0
        p = price(r)
        if isinstance(p, (int, float)) and hi > lo:
            v += w["price"] * (1 - (p - lo) / (hi - lo))
        if budget and isinstance(p, (int, float)) and p > budget:
            v -= 3
        d = r.get("drive_minutes")
        if isinstance(d, (int, float)):
            v -= w["drive"] * d / 120
        if isinstance(r.get("fit_score"), (int, float)):  # personal fit from preferences.json
            v += w["fit"] * (r["fit_score"] - 50) / 25
        if r.get("availability_status") == "unavailable" or r.get("is_active") is False:
            v -= 100
        return v

    for i, r in enumerate(sorted(records, key=value, reverse=True), 1):
        r["score"] = i
    return records
