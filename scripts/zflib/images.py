"""Download listing photos into data/images/<slug>/ and create ~480px thumbnails (needs Pillow)."""
from __future__ import annotations

import hashlib
from pathlib import Path

from . import net
from .store import ROOT

IMAGES_DIR = ROOT / "data" / "images"
THUMB_WIDTH = 480
EXT = {b"\xff\xd8": ".jpg", b"\x89P": ".png", b"RI": ".webp", b"GI": ".gif"}


def make_thumb(src: Path, width: int = THUMB_WIDTH) -> Path | None:
    """Write <name>.thumb.jpg next to src. Returns its path, or None when Pillow is missing."""
    try:
        from PIL import Image
    except ImportError:
        return None
    src = Path(src)
    dst = src.with_name(src.stem + ".thumb.jpg")
    with Image.open(src) as im:
        im = im.convert("RGB")
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(dst, "JPEG", quality=78, optimize=True, progressive=True)
    return dst


def localize(record: dict, max_images: int = 30, root: Path = ROOT, fetcher=net.fetch) -> int:
    """Download remote image_urls of one record, rewrite image_urls/thumb_urls to local paths.
    Already-local paths are kept. Returns the number of files downloaded."""
    slug = record["slug"]
    folder = root / "data" / "images" / slug
    folder.mkdir(parents=True, exist_ok=True)
    images, thumbs, n = [], [], 0
    for url in (record.get("image_urls") or [])[:max_images]:
        if not isinstance(url, str) or not url.strip():
            continue
        if not url.startswith(("http://", "https://")):
            local = root / url
        else:
            name = hashlib.sha1(url.encode()).hexdigest()[:12]
            existing = sorted(folder.glob(name + ".*"))
            existing = [p for p in existing if ".thumb." not in p.name]
            if existing:
                local = existing[0]
            else:
                try:
                    body = fetcher(url, min_interval=0.3)
                except Exception as e:  # keep the remote URL if a download fails
                    print(f"  ! {slug}: {url[:80]} ({e})")
                    images.append(url)
                    thumbs.append(None)
                    continue
                local = folder / (name + EXT.get(body[:2], ".jpg"))
                local.write_bytes(body)
                n += 1
        thumb = local.with_name(local.stem + ".thumb.jpg")
        if not thumb.exists() and local.exists():
            try:
                thumb = make_thumb(local)
            except Exception as e:
                print(f"  ! thumbnail failed for {local.name}: {e}")
                thumb = None
        images.append(local.relative_to(root).as_posix())
        thumbs.append(thumb.relative_to(root).as_posix() if thumb and thumb.exists() else None)
    record["image_urls"] = images
    record["thumb_urls"] = thumbs
    return n
