"""Past trips: data/trips/<slug>/ keeps zimmers.json, votes.json, trip.config.json and images."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

from .records import now_iso, slugify
from .store import ROOT, load_json, save_json

TRIPS = "data/trips"


def trip_id(cfg: dict) -> str:
    t = cfg.get("trip", {})
    areas = (cfg.get("region") or {}).get("areas") or []
    return slugify(str(t.get("check_in") or "trip")[:7], areas[0] if areas else "")


def list_trips(root: Path = ROOT) -> list[Path]:
    d = root / TRIPS
    return sorted(p for p in d.iterdir() if p.is_dir() and (p / "zimmers.json").exists()) if d.exists() else []


def archive(root: Path, cfg: dict, votes: list[dict] | None, name: str | None = None) -> Path:
    """Move the current trip (data/zimmers.json, data/votes.json, its images) into data/trips/<name>/
    and start a clean data/zimmers.json. Preferences are not touched."""
    data = root / "data"
    recs = load_json(data / "zimmers.json", []) or []
    name = slugify(name) if name else trip_id(cfg)
    dest = root / TRIPS / name
    if dest.exists():
        raise FileExistsError(f"{dest} already exists - pick another --name")
    dest.mkdir(parents=True)
    old_prefix, new_prefix = "data/images/", f"{TRIPS}/{name}/images/"
    for z in recs:
        src = data / "images" / z.get("slug", "")
        if z.get("slug") and src.is_dir():
            shutil.move(str(src), str(dest / "images" / z["slug"]))
        for k in ("image_urls", "thumb_urls"):
            z[k] = [u.replace(old_prefix, new_prefix, 1) if isinstance(u, str) and u.startswith(old_prefix) else u for u in z.get(k) or []]
    save_json(dest / "zimmers.json", recs)
    votes = votes if votes is not None else (load_json(data / "votes.json", []) or [])
    save_json(dest / "votes.json", votes)
    save_json(dest / "trip.config.json", cfg)
    save_json(dest / "trip.json", {"id": name, "archived_at": now_iso(), "places": len(recs), "votes": len(votes),
                                   "check_in": cfg.get("trip", {}).get("check_in"), "check_out": cfg.get("trip", {}).get("check_out")})
    save_json(data / "zimmers.json", [])
    if (data / "votes.json").exists():
        (data / "votes.json").unlink()
    write_index(root)
    return dest


def write_index(root: Path = ROOT) -> list[dict]:
    idx = [json.loads((p / "trip.json").read_text(encoding="utf-8")) for p in list_trips(root) if (p / "trip.json").exists()]
    save_json(root / TRIPS / "index.json", idx)
    return idx
