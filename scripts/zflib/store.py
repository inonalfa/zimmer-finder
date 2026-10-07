"""Load / save data/zimmers.json and trip.config.json atomically."""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_FILE = ROOT / "data" / "zimmers.json"
CONFIG_FILE = ROOT / "trip.config.json"
SCHEMA_FILE = ROOT / "schema" / "zimmer.schema.json"


def load_json(path: Path, default=None):
    path = Path(path)
    if not path.exists():
        return default
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data) -> None:
    """Write JSON atomically (temp file + rename) so a crash never leaves a half-written file."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def load_records(path: Path = DATA_FILE) -> list[dict]:
    data = load_json(path, [])
    if isinstance(data, dict):
        data = data.get("zimmers", [])
    if not isinstance(data, list):
        raise ValueError(f"{path}: expected a JSON array of records")
    return data


def load_config(path: Path = CONFIG_FILE) -> dict:
    return load_json(path, {}) or {}
