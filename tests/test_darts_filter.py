import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "sync_sports.py"
SPEC = importlib.util.spec_from_file_location("sync_sports", SCRIPT)
sync_sports = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sync_sports)


class TelevisedPdcFilterTests(unittest.TestCase):
    def test_televised_majors_are_included(self):
        for name in (
            "PDC World Darts Championship",
            "World Matchplay",
            "Premier League",
            "UK Open",
            "World Grand Prix",
            "Grand Slam of Darts",
            "World Cup of Darts",
            "Players Championship Finals",
        ):
            with self.subTest(name=name):
                self.assertTrue(sync_sports.is_main_televised_pdc_event({"name": name, "organiser": "pdc"}))

    def test_european_tour_and_world_series_are_included(self):
        self.assertTrue(sync_sports.is_main_televised_pdc_event({"name": "European Darts Grand Prix", "organiser": "pdc", "tier": "european_tour"}))
        self.assertTrue(sync_sports.is_main_televised_pdc_event({"name": "World Series of Darts Finals", "organiser": "pdc", "tier": "world_series"}))

    def test_development_and_non_televised_events_are_excluded(self):
        for name in ("PDC Development Tour", "PDC U23 Tour", "UK Open Qualifier", "Players Championship 12", "PDC Challenge Tour"):
            with self.subTest(name=name):
                self.assertFalse(sync_sports.is_main_televised_pdc_event({"name": name, "organiser": "pdc"}))

    def test_official_calendar_fallback_has_upcoming_televised_events(self):
        events = sync_sports.pdc_official_fallback_events()
        names = {event["name"] for event in events}
        self.assertIn("2026 Grand Slam of Darts", names)
        self.assertIn("2026 Players Championship Finals", names)
        self.assertIn("2026/27 World Championship", names)
        self.assertTrue(all(event["source_url"] == "https://www.pdc.tv/calendar" for event in events))

    def test_recent_results_keep_only_televised_pdc_matches(self):
        payload = {
            "data": [
                {
                    "match_id": "mt_tv_1",
                    "played_on": "2026-11-01",
                    "round": "final",
                    "winner": {"name": "Player A", "score": 8},
                    "loser": {"name": "Player B", "score": 5},
                    "event": {"event_id": "ev_1", "name": "Grand Slam of Darts", "tier": "majors"},
                },
                {
                    "match_id": "mt_floor_1",
                    "played_on": "2026-11-01",
                    "winner": {"name": "Player C", "score": 6},
                    "loser": {"name": "Player D", "score": 4},
                    "event": {"event_id": "ev_2", "name": "Players Championship 28", "tier": "players_championship"},
                },
            ],
            "meta": {"next_cursor": None},
        }
        with unittest.mock.patch.object(sync_sports, "request_json", return_value=payload):
            rows = sync_sports.paged_darts_results("test-key")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["event_name"], "Grand Slam of Darts")
        self.assertEqual(rows[0]["winner"]["score"], 8)

    def test_pdc_calendar_uses_short_forward_window(self):
        calls = []
        def fake_request(url, key=None, provider="API"):
            calls.append(url)
            return {"data": [], "meta": {"next_cursor": None}}
        with unittest.mock.patch.object(sync_sports, "request_json", side_effect=fake_request):
            sync_sports.paged_darts_calendar("test-key", "pdc")
        self.assertEqual(len(calls), 1)
        self.assertIn("to=" + (sync_sports.TODAY + sync_sports.timedelta(days=60)).isoformat(), calls[0])

    def test_non_pdc_organisers_are_excluded(self):
        self.assertFalse(sync_sports.is_main_televised_pdc_event({"name": "World Championship", "organiser": "pdc_development", "tier": "majors"}))


if __name__ == "__main__":
    unittest.main()
