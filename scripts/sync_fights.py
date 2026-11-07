#!/usr/bin/env python3
"""Fetch the free Boxing Data API upcoming-bouts feed and publish a safe JSON snapshot."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

API_URL = "https://api.boxingapi.net/v1/fights/upcoming"


def api_get(days: int = 30) -> dict:
    key = os.environ.get("BOXING_API_KEY", "").strip()
    if not key:
        raise RuntimeError("BOXING_API_KEY is not configured in GitHub Actions secrets.")

    query = urllib.parse.urlencode({"days": days, "per_page": 200})
    request = urllib.request.Request(
        f"{API_URL}?{query}",
        headers={
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "User-Agent": "Boxing-Fight-Calendar/0.1",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"Boxing Data API returned HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not reach Boxing Data API: {exc.reason}") from exc

    if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
        raise RuntimeError("The API response did not contain the expected data list.")
    return payload


def normalize(payload: dict) -> dict:
    grouped = defaultdict(list)
    for item in payload.get("data", []):
        if not isinstance(item, dict) or not item.get("date"):
            continue
        date = str(item["date"])
        side_a = item.get("a") or {}
        side_b = item.get("b") or {}
        time_utc = item.get("start_time_utc")
        start = f"{date}T{time_utc}:00Z" if time_utc else f"{date}T00:00:00Z"
        grouped[date].append({
            "id": item.get("id"),
            "fighter1": side_a.get("name") or "TBC",
            "fighter2": side_b.get("name") or "TBC",
            "start_time_utc": time_utc,
            "date": date,
            "start_datetime_utc": start,
            "weight_class": item.get("weight_class") or item.get("division"),
            "broadcaster": item.get("broadcaster") or item.get("broadcast") or item.get("tv_channel"),
            "broadcast_url": item.get("broadcast_url") or item.get("broadcaster_url") or item.get("watch_url"),
            "status": "scheduled",
            "data_source": "Boxing Data API",
        })

    events = []
    for date in sorted(grouped):
        bouts = sorted(
            grouped[date],
            key=lambda bout: bout.get("start_time_utc") or "99:99",
        )
        first_time = bouts[0].get("start_time_utc")
        event_datetime = f"{date}T{first_time}:00Z" if first_time else f"{date}T00:00:00Z"
        dt = datetime.strptime(date, "%Y-%m-%d")
        events.append({
            "id": f"date-{date}",
            "name": f"Fight schedule — {dt.strftime('%a %-d %b')}",
            "date": event_datetime,
            "bouts": bouts,
            "source_note": "Bouts grouped by UTC date; this is not a confirmed promoter event card.",
        })

    meta = payload.get("meta") or {}
    return {
        "provider": "Boxing Data API",
        "last_updated": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "provider_generated_at": meta.get("generated_at"),
        "range_days": 30,
        "count_bouts": sum(len(event["bouts"]) for event in events),
        "events": events,
        "notice": "Free API data lists scheduled individual bouts. It may not include full undercards, official event names, weight divisions or broadcaster information. Bouts are grouped by UK local date for display, not by confirmed promoter event.",
    }


def main() -> None:
    payload = api_get()
    snapshot = normalize(payload)
    output = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "fights.json")
    os.makedirs(os.path.dirname(output), exist_ok=True)
    with open(output, "w", encoding="utf-8") as handle:
        json.dump(snapshot, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"Published {snapshot['count_bouts']} scheduled bouts across {len(snapshot['events'])} UTC dates.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"SYNC FAILED: {error}", file=sys.stderr)
        raise
