"""Polite HTTP helpers: User-Agent, retries, and a per-host rate limit (Nominatim allows 1 request/second)."""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

USER_AGENT = os.environ.get("ZF_USER_AGENT", "zimmer-finder/1.0 (+https://github.com/; personal trip planning)")
_last: dict[str, float] = {}


def _wait(host: str, min_interval: float) -> None:
    gap = time.monotonic() - _last.get(host, 0)
    if gap < min_interval:
        time.sleep(min_interval - gap)
    _last[host] = time.monotonic()


def fetch(url: str, *, min_interval: float = 0.0, retries: int = 3, timeout: float = 30, headers: dict | None = None) -> bytes:
    host = url.split("/")[2]
    for attempt in range(retries):
        _wait(host, min_interval)
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                time.sleep(2 ** attempt * 2)
                continue
            raise
        except urllib.error.URLError:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise
    raise RuntimeError("unreachable")


def fetch_json(url: str, **kw):
    return json.loads(fetch(url, **kw).decode("utf-8"))
