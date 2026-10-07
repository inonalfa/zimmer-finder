"""Geocoding (OpenStreetMap Nominatim) and drive times (OSRM). Both are free public services:
respect their usage policies - 1 request/second for Nominatim, a real User-Agent, cache results,
and self-host or use a commercial provider for heavy use. Set ZF_NOMINATIM_URL / ZF_OSRM_URL to override."""
from __future__ import annotations

import os
from urllib.parse import urlencode

from . import net

NOMINATIM = os.environ.get("ZF_NOMINATIM_URL", "https://nominatim.openstreetmap.org")
OSRM = os.environ.get("ZF_OSRM_URL", "https://router.project-osrm.org")


def geocode(query: str, country_code: str | None = None) -> tuple[float, float] | None:
    params = {"q": query, "format": "jsonv2", "limit": 1}
    if country_code:
        params["countrycodes"] = country_code.lower()
    res = net.fetch_json(f"{NOMINATIM}/search?{urlencode(params)}", min_interval=1.1)
    if not res:
        return None
    return float(res[0]["lat"]), float(res[0]["lon"])


def drive(origin: tuple[float, float], dest: tuple[float, float]) -> tuple[float, float] | None:
    """(minutes, km) by car without traffic, or None."""
    (olat, olng), (dlat, dlng) = origin, dest
    url = f"{OSRM}/route/v1/driving/{olng},{olat};{dlng},{dlat}?overview=false"
    res = net.fetch_json(url, min_interval=0.5)
    routes = res.get("routes") or []
    if res.get("code") != "Ok" or not routes:
        return None
    return round(routes[0]["duration"] / 60), round(routes[0]["distance"] / 1000, 1)


def geocode_records(records: list[dict], country: str = "", country_code: str | None = None, force: bool = False,
                    geocoder=geocode) -> int:
    """Fill lat/lng from town (+ region, country) where missing. Results are cached per query."""
    cache: dict[str, tuple[float, float] | None] = {}
    n = 0
    for r in records:
        if not force and isinstance(r.get("lat"), (int, float)) and isinstance(r.get("lng"), (int, float)):
            continue
        if not r.get("town"):
            continue
        q = ", ".join(x for x in (r.get("town"), country) if x)
        if q not in cache:
            cache[q] = geocoder(q, country_code)
        if cache[q]:
            r["lat"], r["lng"] = cache[q]
            r["geo_note"] = f"Town-level, Nominatim: {q}"
            n += 1
    return n


def drive_records(records: list[dict], origin: tuple[float, float], force: bool = False, router=drive) -> int:
    cache: dict[tuple, tuple | None] = {}
    n = 0
    for r in records:
        if not isinstance(r.get("lat"), (int, float)) or not isinstance(r.get("lng"), (int, float)):
            continue
        if not force and isinstance(r.get("drive_minutes"), (int, float)):
            continue
        key = (round(r["lat"], 4), round(r["lng"], 4))
        if key not in cache:
            cache[key] = router(origin, key)
        if cache[key]:
            r["drive_minutes"], r["drive_km"] = cache[key]
            n += 1
    return n
