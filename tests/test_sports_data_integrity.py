import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "sync_sports.py"
SPEC = importlib.util.spec_from_file_location("sync_sports_integrity", SCRIPT)
sync_sports = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sync_sports)


class SportsFeedIntegrityTests(unittest.TestCase):
    def test_bkfc_visible_page_fallback_parses_event(self):
        page = """
        <div>November 7, 2026 November 7, 2026 7:00 PM # BKFC 96 Glasgow: Weir vs Cohoon Buy tickets</div>
        """
        rows = sync_sports.bkfc_visible_event_records(page, "https://www.bkfc.com/events")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["name"], "BKFC 96 Glasgow: Weir vs Cohoon")
        self.assertEqual(rows[0]["startDate"], "November 7, 2026")

    def test_f1_empty_schedule_does_not_replace_previous_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            old_data = sync_sports.DATA
            sync_sports.DATA = directory
            previous = {"sport": "f1", "last_updated": "2026-11-10T10:00:00Z", "events": [{"name": "Existing Grand Prix", "date": "2026-11-20"}]}
            path = Path(directory) / "f1.json"
            path.write_text(json.dumps(previous), encoding="utf-8")
            try:
                with mock.patch.object(sync_sports, "request_json", return_value={"MRData": {"RaceTable": {"Races": []}}}):
                    with self.assertRaisesRegex(RuntimeError, "empty or incomplete race schedule"):
                        sync_sports.sync_f1()
                self.assertEqual(json.loads(path.read_text(encoding="utf-8")), previous)
            finally:
                sync_sports.DATA = old_data

    def test_ufc_empty_response_does_not_replace_previous_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            old_data = sync_sports.DATA
            sync_sports.DATA = directory
            previous = {"sport": "ufc", "last_updated": "2026-11-10T10:00:00Z", "events": [{"name": "Existing UFC Event", "date": "2026-11-20"}]}
            path = Path(directory) / "ufc.json"
            path.write_text(json.dumps(previous), encoding="utf-8")
            try:
                with mock.patch.dict(os.environ, {"UFCALENDAR_API_KEY": "test-key"}):
                    with mock.patch.object(sync_sports, "request_json", return_value={"data": []}):
                        with self.assertRaisesRegex(RuntimeError, "no upcoming or recent completed"):
                            sync_sports.sync_ufc()
                self.assertEqual(json.loads(path.read_text(encoding="utf-8")), previous)
            finally:
                sync_sports.DATA = old_data


if __name__ == "__main__":
    unittest.main()
