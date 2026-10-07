import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from zflib import prefs, records, trips  # noqa: E402


def place(slug, **kw):
    z = {"slug": slug, "name": slug, "region": "North", "price_total": 2000, "check_in": "2026-07-01", "check_out": "2026-07-03"}
    z.update(kw)
    return z


PAST = [
    place("a", is_detached=True, has_view=True),
    place("b", is_detached=True, has_view=True),
    place("c", near_host_house=True),
    place("d", near_host_house=True),
]
VOTES = [
    {"zimmer_slug": "a", "voter_name": "Dana", "vote": "like"},
    {"zimmer_slug": "b", "voter_name": "Dana", "vote": "like"},
    {"zimmer_slug": "c", "voter_name": "Dana", "vote": "unlike"},
    {"zimmer_slug": "d", "voter_name": "Noam", "vote": "unlike"},
]


class LearnTest(unittest.TestCase):
    def setUp(self):
        self.p = prefs.learn(None, prefs.observe("t1", PAST, VOTES))

    def test_weights_have_the_right_sign(self):
        f = self.p["profiles"]["*"]["features"]
        self.assertGreater(f["detached"]["weight"], 0)
        self.assertLess(f["near_host"]["weight"], 0)
        self.assertLessEqual(abs(f["detached"]["weight"]), 2)
        self.assertEqual(f["detached"]["liked_with"], 2)
        self.assertIn("Dana", self.p["profiles"])

    def test_learn_is_idempotent(self):
        again = prefs.learn(self.p, prefs.observe("t1", PAST, VOTES))
        self.assertEqual(len(again["observations"]), len(self.p["observations"]))
        self.assertEqual(again["profiles"]["*"]["features"], self.p["profiles"]["*"]["features"])

    def test_explicit_note_counts(self):
        p = prefs.learn(self.p, [], [{"feature": "pool", "weight": 1.5, "note": "we want a pool"}])
        self.assertAlmostEqual(prefs.effective_weights(p)["pool"], 1.5, places=1)

    def test_fit_ranks_liked_style_higher(self):
        good, why = prefs.fit(place("x", is_detached=True, has_view=True), self.p)
        bad, _ = prefs.fit(place("y", near_host_house=True), self.p)
        self.assertGreater(good, 50)
        self.assertLess(bad, 50)
        self.assertTrue(any(r["feature"] == "detached" and r["kind"] == "match" for r in why))

    def test_rank_uses_fit(self):
        recs = [place("y", near_host_house=True), place("x", is_detached=True, has_view=True)]
        self.assertEqual(prefs.apply_fit(recs, self.p), 2)
        best = min(records.rank(recs), key=lambda r: r["score"])
        self.assertEqual(best["slug"], "x")


class ArchiveTest(unittest.TestCase):
    def test_archive_moves_trip(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "data" / "images" / "a").mkdir(parents=True)
            (root / "data" / "images" / "a" / "1.jpg").write_bytes(b"x")
            (root / "data" / "zimmers.json").write_text(json.dumps([place("a", image_urls=["data/images/a/1.jpg"])]))
            out = trips.archive(root, {"trip": {"check_in": "2026-03-10", "check_out": "2026-03-12"}}, VOTES, "march")
            self.assertTrue((out / "images" / "a" / "1.jpg").exists())
            saved = json.loads((out / "zimmers.json").read_text())
            self.assertTrue(saved[0]["image_urls"][0].startswith("data/trips/march/"))
            self.assertEqual(json.loads((root / "data" / "zimmers.json").read_text()), [])
            self.assertEqual([t.name for t in trips.list_trips(root)], ["march"])


if __name__ == "__main__":
    unittest.main()
