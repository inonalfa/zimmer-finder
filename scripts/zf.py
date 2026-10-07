#!/usr/bin/env python3
"""Zimmer Finder command line. Run `python scripts/zf.py --help`.

Typical agent flow:
  python scripts/zf.py merge new.json         # add / update records found in a search
  python scripts/zf.py enrich                 # geocode + drive times + download photos + rank
  python scripts/zf.py validate               # schema check before publishing
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from zflib import geo, images, records  # noqa: E402
from zflib.store import CONFIG_FILE, DATA_FILE, SCHEMA_FILE, load_config, load_json, load_records, save_json  # noqa: E402
from zflib.validate import errors as schema_errors  # noqa: E402
from zflib.validate import validate_records


def nights(cfg: dict) -> int | None:
    from datetime import date

    t = cfg.get("trip", {})
    try:
        return (date.fromisoformat(t["check_out"]) - date.fromisoformat(t["check_in"])).days
    except (KeyError, ValueError):
        return None


def find(recs: list[dict], slug: str) -> dict:
    for r in recs:
        if r.get("slug") == slug:
            return r
    sys.exit(f"no record with slug '{slug}'")


def cmd_validate(a) -> int:
    recs = load_json(Path(a.file), [])
    errs = validate_records(recs, load_json(SCHEMA_FILE))
    cfg_schema = SCHEMA_FILE.with_name("trip.config.schema.json")
    if cfg_schema.exists():
        errs += [f"trip.config.json {e[1:]}" for e in schema_errors(load_config(CONFIG_FILE), load_json(cfg_schema))]
    for e in errs:
        print("✗", e)
    print(f"{len(recs)} records, {len(errs)} problems")
    return 1 if errs else 0


def cmd_merge(a) -> int:
    recs = load_records(Path(a.file))
    incoming = load_json(Path(a.input))
    if isinstance(incoming, dict):
        incoming = [incoming]
    out, stats = records.merge(recs, incoming)
    save_json(Path(a.file), out)
    print(f"added {stats['added']}, updated {stats['updated']}, total {len(out)}")
    return 0


def cmd_geocode(a) -> int:
    cfg, recs = load_config(), load_records(Path(a.file))
    reg = cfg.get("region", {})
    n = geo.geocode_records(recs, reg.get("country", ""), reg.get("country_code"), force=a.force)
    save_json(Path(a.file), recs)
    print(f"geocoded {n}")
    return 0


def cmd_drive(a) -> int:
    cfg, recs = load_config(), load_records(Path(a.file))
    o = cfg.get("origin", {})
    if not isinstance(o.get("lat"), (int, float)):
        if not o.get("name"):
            sys.exit("set origin.name or origin.lat/lng in trip.config.json")
        hit = geo.geocode(o["name"], cfg.get("region", {}).get("country_code"))
        if not hit:
            sys.exit(f"could not geocode origin '{o['name']}'")
        o["lat"], o["lng"] = hit
    n = geo.drive_records(recs, (o["lat"], o["lng"]), force=a.force)
    save_json(Path(a.file), recs)
    print(f"drive times for {n}")
    return 0


def cmd_images(a) -> int:
    recs = load_records(Path(a.file))
    total = 0
    for r in recs:
        if a.slug and r.get("slug") != a.slug:
            continue
        got = images.localize(r, max_images=a.max)
        total += got
        if got:
            print(f"  {r['slug']}: {got} new")
        save_json(Path(a.file), recs)  # save as we go: long runs can be resumed
    print(f"downloaded {total} images")
    return 0


def cmd_price(a) -> int:
    cfg, recs = load_config(), load_records(Path(a.file))
    r = find(recs, a.slug)
    old = r.get("price_total")
    records.set_price(r, a.total, status=a.status, nights=nights(cfg), source=a.source,
                      budget=cfg.get("budget", {}).get("max_total"))
    save_json(Path(a.file), recs)
    print(f"{a.slug}: {old} -> {a.total} ({a.status})")
    return 0


def cmd_sold_out(a) -> int:
    recs = load_records(Path(a.file))
    for slug in a.slug:
        records.mark_sold_out(find(recs, slug), a.reason)
    save_json(Path(a.file), recs)
    print(f"marked {len(a.slug)} as unavailable")
    return 0


def cmd_available(a) -> int:
    recs = load_records(Path(a.file))
    for slug in a.slug:
        records.mark_available(find(recs, slug), verified=not a.unverified, reason=a.reason)
    save_json(Path(a.file), recs)
    print(f"marked {len(a.slug)} as available")
    return 0


def cmd_rank(a) -> int:
    cfg, recs = load_config(), load_records(Path(a.file))
    records.rank(recs, budget=cfg.get("budget", {}).get("max_total"))
    recs.sort(key=lambda r: r.get("score", 1e9))
    save_json(Path(a.file), recs)
    print(f"ranked {len(recs)}")
    return 0


def cmd_enrich(a) -> int:
    for step in (cmd_geocode, cmd_drive, cmd_images, cmd_rank):
        if a.offline and step is not cmd_rank:
            continue
        step(argparse.Namespace(file=a.file, force=False, slug=None, max=a.max))
    return cmd_validate(a)


def cmd_list(a) -> int:
    for r in sorted(load_records(Path(a.file)), key=lambda r: r.get("score", 1e9)):
        status = r.get("availability_status", "?")
        print(f"{r.get('score', '-'):>3}  {r['slug']:<40} {r.get('price_total') or r.get('price_estimate') or '-':>7}  {status}")
    return 0


def cmd_clear(a) -> int:
    if not a.yes:
        sys.exit("this deletes data/zimmers.json and data/images; re-run with --yes")
    import shutil

    shutil.rmtree(images.IMAGES_DIR, ignore_errors=True)
    save_json(Path(a.file), [])
    print("cleared example data - ready for your own search")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="zf", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--file", default=str(DATA_FILE), help="records file (default: data/zimmers.json)")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("validate", help="check records against schema/zimmer.schema.json").set_defaults(fn=cmd_validate)
    s = sub.add_parser("merge", help="merge new records (JSON array or object) into the data file, deduping")
    s.add_argument("input")
    s.set_defaults(fn=cmd_merge)
    for name, fn, hlp in (("geocode", cmd_geocode, "fill lat/lng from town via Nominatim"), ("drive", cmd_drive, "drive time from origin via OSRM")):
        s = sub.add_parser(name, help=hlp)
        s.add_argument("--force", action="store_true")
        s.set_defaults(fn=fn)
    s = sub.add_parser("images", help="download photos locally + thumbnails")
    s.add_argument("--slug")
    s.add_argument("--max", type=int, default=30)
    s.set_defaults(fn=cmd_images)
    s = sub.add_parser("price", help="record a checked price (keeps price_history)")
    s.add_argument("slug")
    s.add_argument("total", type=float)
    s.add_argument("--status", choices=["verified", "estimated"], default="verified")
    s.add_argument("--source", help="e.g. booking, airbnb, host-site")
    s.set_defaults(fn=cmd_price)
    s = sub.add_parser("sold-out", help="mark records unavailable for the dates")
    s.add_argument("slug", nargs="+")
    s.add_argument("--reason", default="")
    s.set_defaults(fn=cmd_sold_out)
    s = sub.add_parser("available", help="mark records available again")
    s.add_argument("slug", nargs="+")
    s.add_argument("--unverified", action="store_true")
    s.add_argument("--reason", default="")
    s.set_defaults(fn=cmd_available)
    sub.add_parser("rank", help="recompute default score (1 = best)").set_defaults(fn=cmd_rank)
    s = sub.add_parser("enrich", help="geocode + drive + images + rank + validate")
    s.add_argument("--max", type=int, default=30)
    s.add_argument("--offline", action="store_true", help="skip network steps")
    s.set_defaults(fn=cmd_enrich)
    sub.add_parser("list", help="print a short table").set_defaults(fn=cmd_list)
    s = sub.add_parser("clear-example", help="remove the fake example data")
    s.add_argument("--yes", action="store_true")
    s.set_defaults(fn=cmd_clear)
    a = p.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
