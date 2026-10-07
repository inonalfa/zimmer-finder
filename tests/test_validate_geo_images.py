import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from zflib import geo, images, store  # noqa: E402
from zflib.validate import errors, validate_records  # noqa: E402

SCHEMA = json.loads((ROOT / "schema" / "zimmer.schema.json").read_text())


class ValidateTest(unittest.TestCase):
    def test_example_data_is_valid(self):
        self.assertEqual(validate_records(store.load_records(), SCHEMA), [])

    def test_config_is_valid(self):
        cfg_schema = json.loads((ROOT / "schema" / "trip.config.schema.json").read_text())
        self.assertEqual(errors(store.load_config(), cfg_schema), [])

    def test_catches_problems(self):
        errs = validate_records(
            [
                {"slug": "Bad Slug", "name": "x"},
                {"slug": "a", "name": "x", "price_status": "maybe", "google_rating": 7},
                {"slug": "a", "name": "y", "check_in": "2026-02-02", "check_out": "2026-02-01"},
                {"name": "no slug"},
            ],
            SCHEMA,
        )
        text = "\n".join(errs)
        for needle in ("does not match", "not one of", "> 5", "duplicate slug", "check_out", "missing required 'slug'"):
            self.assertIn(needle, text)


class GeoTest(unittest.TestCase):
    def test_geocode_caches_and_skips_known(self):
        calls = []

        def fake(q, cc):
            calls.append(q)
            return (1.0, 2.0)

        recs = [{"town": "A"}, {"town": "A"}, {"town": "B", "lat": 5.0, "lng": 6.0}]
        n = geo.geocode_records(recs, "Country", "xx", geocoder=fake)
        self.assertEqual(n, 2)
        self.assertEqual(calls, ["A, Country"])
        self.assertEqual(recs[2]["lat"], 5.0)

    def test_drive_records(self):
        recs = [{"lat": 1.0, "lng": 2.0}, {"lat": 1.0, "lng": 2.0, "drive_minutes": 9}]
        n = geo.drive_records(recs, (0, 0), router=lambda o, d: (42, 30.5))
        self.assertEqual(n, 1)
        self.assertEqual((recs[0]["drive_minutes"], recs[0]["drive_km"], recs[1]["drive_minutes"]), (42, 30.5, 9))


class ImagesTest(unittest.TestCase):
    def test_localize_downloads_once_and_thumbs(self):
        try:
            from PIL import Image
        except ImportError:
            self.skipTest("Pillow not installed")
        import io

        buf = io.BytesIO()
        Image.new("RGB", (1000, 500), (200, 100, 50)).save(buf, "JPEG")
        body = buf.getvalue()
        calls = []

        def fetcher(url, **kw):
            calls.append(url)
            return body

        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            rec = {"slug": "s", "image_urls": ["https://example.com/a.jpg", "https://example.com/b.jpg"]}
            self.assertEqual(images.localize(rec, root=root, fetcher=fetcher), 2)
            self.assertTrue(all(u.startswith("data/images/s/") for u in rec["image_urls"]))
            with Image.open(root / rec["thumb_urls"][0]) as t:
                self.assertEqual(t.width, 480)
            rec["image_urls"] = ["https://example.com/a.jpg"]
            self.assertEqual(images.localize(rec, root=root, fetcher=fetcher), 0)
            self.assertEqual(len(calls), 2)


class StoreTest(unittest.TestCase):
    def test_atomic_save_roundtrip(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x" / "z.json"
            store.save_json(p, [{"a": "ש"}])
            self.assertEqual(store.load_records(p), [{"a": "ש"}])
            self.assertEqual(list(p.parent.glob(".tmp-*")), [])


if __name__ == "__main__":
    unittest.main()
