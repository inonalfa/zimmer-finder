"""Preference profile that learns from votes across trips (data/preferences.json).

The model is deliberately simple and explainable:
- every vote becomes an *observation* (trip, listing, voter, like/unlike, the listing's features);
- for each feature we compare how often it appears in liked vs disliked listings, with add-one (Laplace)
  smoothing: weight = ln(P(feature | liked) / P(feature | disliked)), clipped to [-2, 2];
- confidence grows with the number of votes behind the weight;
- explicit notes ("we hate being next to the host's house") add a fixed weight on top.
Re-running `learn` is idempotent: observations are keyed by (trip, slug, voter).
"""
from __future__ import annotations

import math
from collections.abc import Callable

from .records import now_iso

SHARED = "*"  # profile of everyone together


def _num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _rating_high(z: dict) -> bool:
    g, b, a = _num(z.get("google_rating")), _num(z.get("booking_rating")), _num(z.get("airbnb_rating"))
    return bool((g and g >= 4.7) or (b and b >= 9.0) or (a and a >= 4.85))


# feature key -> test on a record. Keep keys stable: they are stored in preferences.json and translated in the UI.
FEATURES: dict[str, Callable[[dict], bool]] = {
    "jacuzzi_indoor": lambda z: bool(z.get("jacuzzi_indoor")),
    "jacuzzi_outdoor": lambda z: bool(z.get("jacuzzi_outdoor")),
    "both_jacuzzi": lambda z: bool(z.get("jacuzzi_indoor") and z.get("jacuzzi_outdoor")),
    "view": lambda z: bool(z.get("has_view")),
    "pool": lambda z: bool(z.get("has_pool")),
    "kitchen": lambda z: bool(z.get("has_kitchen")),
    "bbq": lambda z: bool(z.get("has_bbq")),
    "breakfast": lambda z: bool(z.get("breakfast")),
    "detached": lambda z: bool(z.get("is_detached")),
    "near_host": lambda z: bool(z.get("near_host_house")),
    "high_rating": _rating_high,
    "red_flags": lambda z: bool(str(z.get("review_red_flags") or "").strip()),
    "long_drive": lambda z: (_num(z.get("drive_minutes")) or 0) > 150,
}


def features_of(z: dict) -> list[str]:
    out = [k for k, f in FEATURES.items() if f(z)]
    if z.get("region"):
        out.append(f"region:{z['region']}")
    return out


def _price(z):
    return _num(z.get("price_total")) or _num(z.get("price_estimate"))


def _nights(z) -> int | None:
    from datetime import date

    try:
        return (date.fromisoformat(z["check_out"][:10]) - date.fromisoformat(z["check_in"][:10])).days or None
    except (KeyError, TypeError, ValueError):
        return None


def observe(trip: str, records: list[dict], votes: list[dict]) -> list[dict]:
    """Turn votes on one trip's records into observations (latest vote per voter and listing wins)."""
    by_slug = {r.get("slug"): r for r in records}
    latest: dict[tuple, dict] = {}
    for v in sorted(votes, key=lambda v: str(v.get("updated_at") or "")):
        if v.get("vote") not in ("like", "unlike") or v.get("zimmer_slug") not in by_slug or not v.get("voter_name"):
            continue
        latest[(v["zimmer_slug"], v["voter_name"])] = v
    obs = []
    for (slug, voter), v in latest.items():
        z = by_slug[slug]
        p, n = _price(z), _nights(z)
        obs.append({
            "trip": trip, "slug": slug, "name": z.get("name", slug), "voter": voter, "vote": v["vote"],
            "features": features_of(z),
            "price_per_night": round(p / n) if p and n else _num(z.get("price_per_night")),
            "drive_minutes": _num(z.get("drive_minutes")),
        })
    return obs


def merge_observations(old: list[dict], new: list[dict]) -> list[dict]:
    key = lambda o: (o["trip"], o["slug"], o["voter"])  # noqa: E731
    out = {key(o): o for o in old}
    for o in new:
        out[key(o)] = o
    return sorted(out.values(), key=key)


def _profile(obs: list[dict]) -> dict:
    liked = [o for o in obs if o["vote"] == "like"]
    unliked = [o for o in obs if o["vote"] == "unlike"]
    nl, nu = len(liked), len(unliked)
    feats = sorted({f for o in obs for f in o["features"]})
    weights = {}
    for f in feats:
        cl = sum(f in o["features"] for o in liked)
        cu = sum(f in o["features"] for o in unliked)
        w = math.log(((cl + 1) / (nl + 2)) / ((cu + 1) / (nu + 2)))
        support = cl + cu
        weights[f] = {
            "weight": round(max(-2.0, min(2.0, w)), 2),
            "confidence": round(min(1.0, (nl + nu) / 12) * min(1.0, support / 4), 2),
            "liked_with": cl, "liked_total": nl, "unliked_with": cu, "unliked_total": nu,
            "evidence": [{"trip": o["trip"], "slug": o["slug"], "name": o["name"], "voter": o["voter"], "vote": o["vote"]}
                         for o in obs if f in o["features"]][:12],
        }

    def stats(key):
        lv = [o[key] for o in liked if _num(o.get(key)) is not None]
        uv = [o[key] for o in unliked if _num(o.get(key)) is not None]
        return lv, uv

    lp, up = stats("price_per_night")
    ld, _ = stats("drive_minutes")
    numeric = {}
    if lp:
        numeric["price_per_night"] = {
            "liked_avg": round(sum(lp) / len(lp)), "liked_max": max(lp),
            "unliked_avg": round(sum(up) / len(up)) if up else None,
            # >0: dislikes were pricier than likes (price matters); <0: likes were pricier (quality first)
            "sensitivity": round((sum(up) / len(up) - sum(lp) / len(lp)) / max(1, sum(lp) / len(lp)), 2) if up else 0.0,
        }
    if ld:
        numeric["drive_minutes"] = {"liked_max": max(ld), "liked_avg": round(sum(ld) / len(ld))}
    return {"votes": nl + nu, "likes": nl, "unlikes": nu, "features": weights, "numeric": numeric}


def learn(prefs: dict | None, new_obs: list[dict], notes: list[dict] | None = None) -> dict:
    prefs = dict(prefs or {})
    obs = merge_observations(prefs.get("observations", []), new_obs)
    explicit = list(prefs.get("explicit", []))
    for n in notes or []:
        explicit = [e for e in explicit if not (e["feature"] == n["feature"] and e.get("voter", SHARED) == n.get("voter", SHARED))]
        explicit.append({"voter": SHARED, "added_at": now_iso(), **n})
    voters = sorted({o["voter"] for o in obs})
    profiles = {SHARED: _profile(obs)}
    for v in voters:
        profiles[v] = _profile([o for o in obs if o["voter"] == v])
    return {
        "version": 1,
        "updated_at": now_iso(),
        "trips": sorted({o["trip"] for o in obs}),
        "voters": voters,
        "profiles": profiles,
        "explicit": explicit,
        "observations": obs,
    }


def effective_weights(prefs: dict, voter: str = SHARED) -> dict[str, float]:
    """Learned weight x confidence, plus explicit notes. Small weights are ignored as noise."""
    prof = (prefs.get("profiles") or {}).get(voter) or (prefs.get("profiles") or {}).get(SHARED) or {}
    out = {f: round(d["weight"] * d["confidence"], 3) for f, d in (prof.get("features") or {}).items()}
    for e in prefs.get("explicit", []):
        if e.get("voter", SHARED) in (SHARED, voter):
            out[e["feature"]] = round(out.get(e["feature"], 0) + float(e.get("weight", 0)), 3)
    return {f: w for f, w in out.items() if abs(w) >= 0.15}


def fit(z: dict, prefs: dict, voter: str = SHARED) -> tuple[int | None, list[dict]]:
    """Personal fit 0-100 and structured reasons (rendered and translated by the app)."""
    w = effective_weights(prefs, voter)
    if not w:
        return None, []
    feats = set(features_of(z))
    prof = (prefs.get("profiles") or {}).get(voter) or prefs["profiles"][SHARED]
    total, reasons = 0.0, []
    for f, wt in sorted(w.items(), key=lambda x: -abs(x[1])):
        d = (prof.get("features") or {}).get(f, {})
        note = next((e.get("note") for e in prefs.get("explicit", []) if e["feature"] == f), None)
        info = {"feature": f, "liked_with": d.get("liked_with"), "liked_total": d.get("liked_total"),
                "unliked_with": d.get("unliked_with"), "unliked_total": d.get("unliked_total")}
        if note:
            info["note"] = note
        if f in feats:
            total += wt
            reasons.append({**info, "kind": "match" if wt > 0 else "warn"})
        elif wt > 0.5 and not f.startswith("region:"):
            total -= wt * 0.3
            reasons.append({**info, "kind": "miss"})
    num = (prof.get("numeric") or {})
    dmax = (num.get("drive_minutes") or {}).get("liked_max")
    d = _num(z.get("drive_minutes"))
    if dmax and d and d > dmax * 1.15:
        total -= 0.5
        reasons.append({"feature": "drive_over", "kind": "warn", "value": round(d), "limit": round(dmax)})
    pn = (num.get("price_per_night") or {})
    p, n = _price(z), _nights(z)
    if pn.get("liked_max") and p and n and p / n > pn["liked_max"] * 1.15 and pn.get("sensitivity", 0) > 0:
        total -= 0.5
        reasons.append({"feature": "price_over", "kind": "warn", "value": round(p / n), "limit": pn["liked_max"]})
    score = round(100 / (1 + math.exp(-total)))
    order = {"match": 0, "warn": 1, "miss": 2}
    reasons.sort(key=lambda r: order[r["kind"]])
    return score, reasons[:5]


def apply_fit(records: list[dict], prefs: dict, voter: str = SHARED) -> int:
    n = 0
    for z in records:
        s, why = fit(z, prefs, voter)
        if s is None:
            z.pop("fit_score", None)
            z.pop("fit_reasons", None)
            continue
        z["fit_score"], z["fit_reasons"] = s, why
        n += 1
    return n


def summary(prefs: dict, voter: str = SHARED, top: int = 6) -> list[str]:
    """Plain-English lines an agent can tell the user ("from past trips we assume ...")."""
    w = effective_weights(prefs, voter)
    lines = []
    for f, wt in sorted(w.items(), key=lambda x: -abs(x[1]))[:top]:
        lines.append(f"{'likes' if wt > 0 else 'avoids'} {f.replace('region:', 'region ').replace('_', ' ')} ({wt:+.2f})")
    num = ((prefs.get("profiles") or {}).get(voter) or {}).get("numeric") or {}
    if num.get("drive_minutes"):
        lines.append(f"liked places up to {num['drive_minutes']['liked_max']:.0f} min drive")
    if num.get("price_per_night"):
        lines.append(f"liked places up to {num['price_per_night']['liked_max']:.0f} per night")
    return lines
