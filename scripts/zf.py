#!/usr/bin/env python3
"""Zimmer Finder command line. Run `python scripts/zf.py --help`.

Typical agent flow:
  python scripts/zf.py merge new.json         # add / update records found in a search
  python scripts/zf.py enrich                 # geocode + drive times + download photos + rank
  python scripts/zf.py validate               # schema check before publishing
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from zflib import geo, images, prefs, records, trips  # noqa: E402
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
    pf = Path(a.file).with_name("preferences.json")
    if pf.exists():
        errs += [f"preferences.json {e[1:]}" for e in schema_errors(load_json(pf), load_json(SCHEMA_FILE.with_name("preferences.schema.json")))]
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


def prefs_file(a) -> Path:
    return Path(a.file).with_name("preferences.json")


def votes_file(a) -> Path:
    return Path(a.file).with_name("votes.json")


def root_of(a) -> Path:
    return Path(a.file).resolve().parent.parent


def fetch_votes(cfg: dict) -> list[dict]:
    """Votes from the configured shared store (Supabase). Local/browser votes: use the app's Export votes."""
    v = (cfg.get("storage") or {}).get("votes") or {}
    if v.get("adapter") != "supabase":
        sys.exit("storage.votes.adapter is not supabase - export votes from the app (Your taste > Export votes) and pass --votes")
    from urllib.parse import quote

    from zflib import net

    url = f"{v['url'].rstrip('/')}/rest/v1/{v.get('table', 'zimmer_votes')}?trip_id=eq.{quote(v.get('trip_id', 'default'))}&select=*"
    return json.loads(net.fetch(url, headers={"apikey": v["anon_key"], "Authorization": f"Bearer {v['anon_key']}"}))


def current_votes(a, cfg) -> list[dict]:
    if getattr(a, "from_store", False):
        return fetch_votes(cfg)
    if getattr(a, "votes", None):
        body = load_json(Path(a.votes), [])
        return body.get("votes", []) if isinstance(body, dict) else body
    return load_json(votes_file(a), []) or []


def cmd_learn(a) -> int:
    cfg = load_config()
    root = root_of(a)
    obs = []
    for t in trips.list_trips(root):
        obs += prefs.observe(t.name, load_records(t / "zimmers.json"), load_json(t / "votes.json", []) or [])
    votes = current_votes(a, cfg)
    if votes and a.votes and Path(a.votes).resolve() != votes_file(a).resolve():
        save_json(votes_file(a), votes)  # keep the current trip's votes next to its data (archived later)
    obs += prefs.observe(trips.trip_id(cfg), load_records(Path(a.file)), votes)
    notes = []
    if a.note or a.feature:
        if not (a.feature and a.weight is not None):
            sys.exit("--note needs --feature and --weight (e.g. --feature near_host --weight -1.5)")
        notes.append({"feature": a.feature, "weight": a.weight, "note": a.note or "", **({"voter": a.voter} if a.voter else {})})
    new = prefs.learn(load_json(prefs_file(a), {}), obs, notes)
    save_json(prefs_file(a), new)
    shared = new["profiles"][prefs.SHARED]
    print(f"learned from {shared['votes']} votes ({shared['likes']} likes) across {len(new['trips'])} trip(s), voters: {', '.join(new['voters']) or '-'}")
    for line in prefs.summary(new):
        print("  -", line)
    return 0


def cmd_taste(a) -> int:
    p = load_json(prefs_file(a), None)
    if not p:
        print("no data/preferences.json yet - run `zf.py learn` after voting")
        return 0
    print(f"trips: {', '.join(p.get('trips', []))}  voters: {', '.join(p.get('voters', []))}")
    for line in prefs.summary(p, a.voter or prefs.SHARED, top=12):
        print("  -", line)
    return 0


def cmd_archive(a) -> int:
    cfg = load_config()
    votes = current_votes(a, cfg) if (a.votes or a.from_store) else None
    dest = trips.archive(root_of(a), cfg, votes, a.name)
    print(f"archived to {dest.relative_to(root_of(a))} - data/zimmers.json is empty, preferences kept")
    return 0


def cmd_rank(a) -> int:
    cfg, recs = load_config(), load_records(Path(a.file))
    p = load_json(prefs_file(a), None)
    if p:
        n = prefs.apply_fit(recs, p, getattr(a, "voter", None) or prefs.SHARED)
        print(f"personal fit for {n} places (data/preferences.json)")
    records.rank(recs, budget=cfg.get("budget", {}).get("max_total"))
    recs.sort(key=lambda r: r.get("score", 1e9))
    save_json(Path(a.file), recs)
    print(f"ranked {len(recs)}")
    return 0


def cmd_enrich(a) -> int:
    for step in (cmd_geocode, cmd_drive, cmd_images, cmd_rank):
        if a.offline and step is not cmd_rank:
            continue
        step(argparse.Namespace(file=a.file, force=False, slug=None, max=a.max, voter=None))
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
    # fake past trips and the taste they taught: a real user starts with a clean profile
    root = root_of(a)
    gone = {t.name for t in trips.list_trips(root) if (load_json(t / "trip.json", {}) or {}).get("example")}
    for name in gone:
        shutil.rmtree(root / "data" / "trips" / name, ignore_errors=True)
    trips.write_index(root)
    pf = prefs_file(a)
    if pf.exists():
        p = load_json(pf, {}) or {}
        p["observations"] = [o for o in p.get("observations", []) if o.get("trip") not in gone]
        p["explicit"] = [e for e in p.get("explicit", []) if not e.get("example")]
        p["trips"] = [t for t in p.get("trips", []) if t not in gone]
        if p["observations"] or p["explicit"]:
            save_json(pf, prefs.learn(p, []))
        else:
            pf.unlink()
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
    s = sub.add_parser("rank", help="recompute score (1 = best), with personal fit from data/preferences.json")
    s.add_argument("--voter", help="rank for one voter instead of everyone together")
    s.set_defaults(fn=cmd_rank)
    s = sub.add_parser("learn", help="update data/preferences.json from votes of all trips")
    s.add_argument("--votes", help="votes.json exported from the app (default: data/votes.json)")
    s.add_argument("--from-store", dest="from_store", action="store_true", help="fetch votes from Supabase (storage.votes)")
    s.add_argument("--feature", help="explicit preference, e.g. near_host, view, pool, region:Golan Heights")
    s.add_argument("--weight", type=float, help="explicit weight, -2 (avoid) .. +2 (want)")
    s.add_argument("--note", help="why, in the user's words")
    s.add_argument("--voter", help="explicit note for one voter only")
    s.set_defaults(fn=cmd_learn)
    s = sub.add_parser("taste", help="print the learned preferences")
    s.add_argument("--voter")
    s.set_defaults(fn=cmd_taste)
    s = sub.add_parser("archive", help="move the finished trip to data/trips/<name>/ and start clean")
    s.add_argument("--name", help="folder name (default: <yyyy-mm>-<first area>)")
    s.add_argument("--votes", help="votes.json exported from the app (default: data/votes.json)")
    s.add_argument("--from-store", dest="from_store", action="store_true")
    s.set_defaults(fn=cmd_archive)
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
