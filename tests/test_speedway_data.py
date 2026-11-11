import json
import unittest
from pathlib import Path

DATA = json.loads((Path(__file__).resolve().parents[1] / "data" / "speedway.json").read_text(encoding="utf-8"))

class SpeedwayDataTests(unittest.TestCase):
    def test_official_2027_grand_prix_calendar_is_populated(self):
        events = DATA["competitions"]["sgp"]["events"]
        self.assertEqual(len(events), 11)
        self.assertTrue(all(event.get("source_url", "").startswith("https://fimspeedway.com/") for event in events))
        self.assertTrue(any(event.get("date") is None for event in events), "TBC round must remain explicitly undated")

    def test_british_grand_prix_is_highlighted(self):
        events = DATA["competitions"]["sgp"]["events"]
        british = [event for event in events if event.get("british_gp")]
        self.assertEqual(len(british), 1)
        self.assertEqual(british[0]["date"], "2027-08-14")
        self.assertIn("Ipswich", british[0]["name"])

    def test_speedway_of_nations_and_world_cup_status(self):
        son = DATA["competitions"]["son"]
        self.assertEqual(len(son["events"]), 2)
        self.assertTrue(any(event["id"] == "son-2027" and event["date"] == "2027-08-28" for event in son["events"]))
        self.assertEqual(DATA["competitions"]["swc"]["nextSeason"], 2029)

    def test_rider_standings_have_required_profile_fields(self):
        riders = DATA["riderStandings"]["riders"]
        self.assertGreaterEqual(len(riders), 15)
        for rider in riders:
            for field in ("rank", "name", "number", "nationality", "points"):
                self.assertIn(field, rider)

if __name__ == "__main__":
    unittest.main()
