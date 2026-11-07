#!/usr/bin/env python3
"""Build the public schedule from Boxerbook's confirmed event cards, with Boxing Data fallback."""
from __future__ import annotations
import json, os, sys, urllib.error, urllib.parse, urllib.request
from collections import defaultdict
from datetime import datetime, timezone

BOXERBOOK_URL = "https://boxerbook.com/v1/schedule?when=weekend"
BOXING_URL = "https://api.boxingapi.net/v1/fights/upcoming"

def get_json(url: str, key: str, provider: str) -> dict:
    if not key:
        raise RuntimeError(f"{provider} API key is missing from GitHub Actions secrets.")
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {key}", "Accept": "application/json",
        "User-Agent": "Boxing-Fight-Calendar/0.2"
    })
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:700]
        raise RuntimeError(f"{provider} API returned HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not reach {provider}: {exc.reason}") from exc
    if not isinstance(data, dict):
        raise RuntimeError(f"{provider} returned an unexpected response.")
    return data

def boxerbook_schedule() -> dict:
    key = os.environ.get("BOXERBOOK_API_KEY", "").strip()
    data = get_json(BOXERBOOK_URL, key, "Boxerbook")
    if not isinstance(data.get("events"), list):
        raise RuntimeError("Boxerbook response did not contain an events list.")
    events = []
    for raw in data["events"]:
        if not isinstance(raw, dict):
            continue
        date = str(raw.get("date") or "")
        if not date:
            continue
        bouts = []
        for item in raw.get("bouts") or []:
            if not isinstance(item, dict):
                continue
            a, b = item.get("a") or {}, item.get("b") or {}
            if not isinstance(a, dict): a = {}
            if not isinstance(b, dict): b = {}
            bout_date = str(item.get("date") or date)
            time_utc = item.get("start_time_utc") or item.get("time_utc")
            start = f"{bout_date}T{time_utc}:00Z" if time_utc else f"{bout_date}T12:00:00Z"
            division = item.get("division") or item.get("weight_class")
            bouts.append({
                "id": item.get("id"),
                "fighter1": a.get("name") or item.get("fighter1") or "TBC",
                "fighter2": b.get("name") or item.get("fighter2") or "TBC",
                "record1": a.get("record"), "record2": b.get("record"),
                "date": bout_date, "start_time_utc": time_utc,
                "start_datetime_utc": start,
                "weight_class": division if division and division != "other" else None,
                "rounds": item.get("scheduled_rounds"),
                "title_text": item.get("title_text"),
                "status": item.get("status") or "scheduled",
                "url": item.get("url"),
                "broadcaster": None,
                "data_source": "Boxerbook"
            })
        raw_broadcasters = raw.get("broadcasters") or []
        broadcasts = []
        for entry in raw_broadcasters:
            if isinstance(entry, str):
                broadcasts.append({"name": entry})
            elif isinstance(entry, dict):
                name = entry.get("name") or entry.get("broadcaster") or entry.get("platform")
                if name:
                    broadcasts.append({"name": name, "region": entry.get("region"), "url": entry.get("url")})
        promoter = raw.get("promoter")
        name = raw.get("name") or raw.get("title") or (f"{promoter} event" if promoter else "Boxing event")
        events.append({
            "id": f"boxerbook-{raw.get('id')}",
            "source_id": raw.get("id"),
            "name": name,
            "date": f"{date}T12:00:00Z",
            "event_url": raw.get("url"),
            "promoter": promoter,
            "broadcasters": broadcasts,
            "bouts": bouts,
            "data_source": "Boxerbook"
        })
    return {"events": events, "as_of": data.get("as_of"), "attribution": data.get("attribution")}

def boxing_data_fallback(excluded_dates: set[str]) -> list[dict]:
    key = os.environ.get("BOXING_API_KEY", "").strip()
    if not key:
        print("BOXING_API_KEY not configured; skipping secondary fallback.")
        return []
    query = urllib.parse.urlencode({"days": 30, "per_page": 200})
    try:
        payload = get_json(f"{BOXING_URL}?{query}", key, "Boxing Data")
    except Exception as exc:
        print(f"BOXING_DATA_FALLBACK_WARNING: {exc}")
        return []
    grouped = defaultdict(list)
    for item in payload.get("data", []):
        if not isinstance(item, dict) or not item.get("date"):
            continue
        date = str(item["date"])
        if date in excluded_dates:
            continue
        a, b = item.get("a") or {}, item.get("b") or {}
        time_utc = item.get("start_time_utc")
        start = f"{date}T{time_utc}:00Z" if time_utc else f"{date}T12:00:00Z"
        grouped[date].append({
            "id": item.get("id"), "fighter1": a.get("name") or "TBC",
            "fighter2": b.get("name") or "TBC", "date": date,
            "start_time_utc": time_utc, "start_datetime_utc": start,
            "weight_class": item.get("weight_class") or item.get("division"),
            "rounds": item.get("rounds"), "status": "scheduled",
            "data_source": "Boxing Data API"
        })
    result = []
    for date, bouts in sorted(grouped.items()):
        dt = datetime.strptime(date, "%Y-%m-%d")
        result.append({
            "id": f"boxingdata-{date}", "name": f"Additional scheduled bouts — {dt.strftime('%a %-d %b')}",
            "date": f"{date}T12:00:00Z", "bouts": bouts,
            "data_source": "Boxing Data API",
            "source_note": "Individual bouts grouped by date; not a confirmed promoter card."
        })
    return result

def main():
    primary = boxerbook_schedule()
    covered_dates = {str(e["date"])[:10] for e in primary["events"]}
    fallback = boxing_data_fallback(covered_dates)
    events = primary["events"] + fallback
    events.sort(key=lambda e: (str(e.get("date", "")), str(e.get("name", ""))))
    count = sum(len(e.get("bouts", [])) for e in events)
    snapshot = {
        "provider": "Boxerbook + Boxing Data API",
        "last_updated": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "provider_as_of": primary.get("as_of"),
        "attribution": "Data from Boxerbook (boxerbook.com)",
        "count_events": len(events), "count_bouts": count,
        "events": events,
        "notice": "Confirmed event cards and bout details are supplied by Boxerbook where available. Additional individual bouts may be grouped by date from Boxing Data API. Missing times and broadcasters are not guessed."
    }
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "fights.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Published {count} bouts across {len(events)} events ({len(primary['events'])} Boxerbook cards, {len(fallback)} fallback date groups).")

if __name__ == "__main__":
    try: main()
    except Exception as exc:
        print(f"SYNC FAILED: {exc}", file=sys.stderr)
        raise
