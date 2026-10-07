import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from zflib import records  # noqa: E402


class SlugTest(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(records.slugify("Oak Hill", "Rosh Pina", "Suite 2"), "oak-hill-rosh-pina-suite-2")

    def test_slugify_non_latin_falls_back(self):
        self.assertEqual(records.slugify("צימר"), "place")

    def test_canonical_url(self):
        a = records.canonical_url("https://www.airbnb.co.uk/rooms/123?check_in=2027-01-01#x")
        b = records.canonical_url("https://airbnb.com/rooms/123/")
        self.assertEqual(a, b)


class MergeTest(unittest.TestCase):
    def test_adds_new_and_assigns_unique_slug(self):
        out, stats = records.merge([{"slug": "a", "name": "A"}], [{"slug": "a-x", "name": "A2"}, {"name": "Oak", "town": "Dan"}])
        self.assertEqual(stats, {"added": 2, "updated": 0})
        self.assertEqual(out[-1]["slug"], "oak-dan")
        self.assertTrue(out[-1]["is_active"])
        self.assertIn("found_date", out[-1])

    def test_dedupes_by_listing_url(self):
        old = [{"slug": "a", "name": "A", "listing_url": "https://example.com/l/1", "found_date": "2026-01-01"}]
        out, stats = records.merge(old, [{"name": "A new", "listing_url": "https://example.com/l/1?x=1", "found_date": "2026-02-02"}])
        self.assertEqual(stats["updated"], 1)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["name"], "A new")
        self.assertEqual(out[0]["found_date"], "2026-01-01")

    def test_dedupes_by_phone_town_unit(self):
        a = {"slug": "a", "name": "A", "phone": "050-000-0001", "town": "T"}
        self.assertTrue(records.same_place(a, {"name": "B", "phone": "+972 50 000 0001", "town": "T"}))
        self.assertFalse(records.same_place(a, {"name": "B", "phone": "+972 50 000 0001", "town": "T", "unit": "2"}))

    def test_keeps_local_images(self):
        old = {"slug": "a", "name": "A", "image_urls": ["data/images/a/1.jpg"], "thumb_urls": ["data/images/a/1.thumb.jpg"]}
        out = records.merge_record(old, {"image_urls": ["https://example.com/1.jpg"]})
        self.assertEqual(out["image_urls"], ["data/images/a/1.jpg"])

    def test_empty_values_do_not_overwrite(self):
        out = records.merge_record({"slug": "a", "phone": "1"}, {"phone": "", "town": None})
        self.assertEqual(out["phone"], "1")


class PriceTest(unittest.TestCase):
    def test_history_appends_changes_only(self):
        r = {}
        records.set_price(r, 4000, on="2026-01-01", nights=4, budget=4500)
        records.set_price(r, 4000, on="2026-01-02")
        records.set_price(r, 3800, on="2026-01-03", source="booking")
        self.assertEqual([h["total"] for h in r["price_history"]], [4000, 3800])
        self.assertEqual(r["price_total"], 3800)
        self.assertEqual(r["price_checked_at"], "2026-01-03")
        self.assertTrue(r["within_budget"])
        self.assertEqual(r["price_per_night"], 1000)

    def test_same_day_replaces(self):
        r = {"price_history": [{"date": "2026-01-01", "total": 1}]}
        self.assertEqual(records.add_price_point(r, 2, "2026-01-01"), [{"date": "2026-01-01", "total": 2}])


class StatusTest(unittest.TestCase):
    def test_sold_out_and_back(self):
        r = records.mark_sold_out({"slug": "a"}, "gone on booking", on="2026-01-01")
        self.assertEqual((r["availability_status"], r["is_active"]), ("unavailable", False))
        records.mark_available(r, verified=False)
        self.assertEqual((r["availability_status"], r["is_active"]), ("unverified", True))

    def test_rank_puts_sold_out_last(self):
        recs = [
            {"slug": "sold", "google_rating": 5, "availability_status": "unavailable"},
            {"slug": "ok", "google_rating": 4.5, "price_total": 3000},
            {"slug": "pricey", "google_rating": 4.5, "price_total": 9000},
        ]
        records.rank(recs, budget=5000)
        by = {r["slug"]: r["score"] for r in recs}
        self.assertEqual(by["ok"], 1)
        self.assertEqual(by["sold"], 3)


if __name__ == "__main__":
    unittest.main()


class CliTest(unittest.TestCase):
    def test_merge_price_sold_out(self):
        import json
        import tempfile

        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
        import zf  # noqa: E402

        with tempfile.TemporaryDirectory() as d:
            f, new = Path(d) / "z.json", Path(d) / "new.json"
            f.write_text("[]")
            new.write_text(json.dumps([{"name": "Oak", "town": "Dan", "price_total": 1000}]))
            self.assertEqual(zf.main(["--file", str(f), "merge", str(new)]), 0)
            self.assertEqual(zf.main(["--file", str(f), "price", "oak-dan", "900", "--source", "test"]), 0)
            self.assertEqual(zf.main(["--file", str(f), "sold-out", "oak-dan", "--reason", "gone"]), 0)
            rec = json.loads(f.read_text())[0]
            self.assertEqual(rec["price_total"], 900)
            self.assertFalse(rec["is_active"])
            self.assertEqual(zf.main(["--file", str(f), "validate"]), 0)
