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

def first_value(obj: dict, *keys):
    for key in keys:
        value = obj.get(key)
        if value not in (None, "", [], {}):
            return value
    return None

def fighter_nationality(fighter: dict, item: dict, side: str):
    value = first_value(fighter, "nationality", "country", "nationality_code", "country_code")
    if isinstance(value, dict):
        value = first_value(value, "name", "code", "country", "iso_code")
    if value:
        return value
    value = first_value(item, f"{side}_nationality", f"{side}_country", f"{side}_country_code")
    if isinstance(value, dict):
        value = first_value(value, "name", "code", "country", "iso_code")
    return value

def normalise_broadcasters(raw: dict) -> list[dict]:
    value = first_value(raw, "broadcasters", "broadcasts", "broadcast", "where_to_watch", "watch", "platforms", "tv")
    if isinstance(value, dict):
        value = value.get("broadcasters") or value.get("platforms") or value.get("services") or [value]
    if isinstance(value, str):
        value = [value]
    result = []
    for entry in value or []:
        if isinstance(entry, str):
            result.append({"name": entry})
        elif isinstance(entry, dict):
            name = first_value(entry, "name", "broadcaster", "platform", "service", "channel")
            if name:
                result.append({"name": name, "region": first_value(entry, "region", "country", "market"), "url": first_value(entry, "url", "watch_url")})
    return result

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
        event_start = first_value(raw, "start_time_utc", "card_start_time_utc", "event_start_time_utc", "scheduled_start_utc", "start_utc", "card_start", "start_time")
        for item in raw.get("bouts") or []:
            if not isinstance(item, dict):
                continue
            a, b = item.get("a") or {}, item.get("b") or {}
            if not isinstance(a, dict): a = {}
            if not isinstance(b, dict): b = {}
            bout_date = str(item.get("date") or date)
            time_utc = first_value(item, "start_time_utc", "time_utc")
            start = f"{bout_date}T{time_utc}:00Z" if time_utc else None
            division = item.get("division") or item.get("weight_class")
            bouts.append({
                "id": item.get("id"),
                "fighter1": a.get("name") or item.get("fighter1") or "TBC",
                "fighter2": b.get("name") or item.get("fighter2") or "TBC",
                "fighter1_image": first_value(a, "image_url", "photo_url", "portrait_url", "image", "photo") or first_value(item, "fighter1_image", "fighter1_photo", "image1", "photo1"),
                "fighter2_image": first_value(b, "image_url", "photo_url", "portrait_url", "image", "photo") or first_value(item, "fighter2_image", "fighter2_photo", "image2", "photo2"),
                "fighter1_nationality": fighter_nationality(a, item, "fighter1"),
                "fighter2_nationality": fighter_nationality(b, item, "fighter2"),
                "record1": a.get("record"), "record2": b.get("record"),
                "date": bout_date, "start_time_utc": time_utc,
                "start_datetime_utc": start,
                "weight_class": division if division and division != "other" else None,
                "rounds": item.get("scheduled_rounds") or item.get("rounds"),
                "title_text": item.get("title_text"),
                "status": item.get("status") or "scheduled",
                "url": item.get("url"),
                "broadcaster": first_value(item, "broadcaster", "broadcast", "tv_channel"),
                "data_source": "Boxerbook"
            })
        broadcasts = normalise_broadcasters(raw)
        location = first_value(raw, "location", "venue", "place", "site")
        if isinstance(location, dict):
            location_text = first_value(location, "name", "venue", "address", "label")
            city = first_value(location, "city", "town")
            country = first_value(location, "country", "country_name", "country_code", "countryCode", "country_iso", "nation")
            country_code = first_value(location, "country_code", "countryCode", "country_iso", "iso_country")
        else:
            location_text = location
            city = first_value(raw, "city", "town")
            country = first_value(raw, "country", "country_name", "country_code")
            country_code = first_value(raw, "country_code", "iso_country")
        city = city or first_value(raw, "city_name", "town")
        country = country or first_value(raw, "country_name", "country_code", "country")
        promoter = raw.get("promoter")
        name = first_value(raw, "name", "title", "event_name") or (f"{promoter} event" if promoter else (f"{city} boxing event" if city else "Boxing event"))
        events.append({
            "id": f"boxerbook-{raw.get('id')}",
            "source_id": raw.get("id"),
            "name": name,
            "date": f"{date}T12:00:00Z",
            "event_url": raw.get("url"),
            "promoter": promoter,
            "location": location_text,
            "city": city,
            "country": country,
            "country_code": country_code,
            "start_time_utc": event_start,
            "broadcasters": broadcasts,
            "bouts": bouts,
            "data_source": "Boxerbook"
        })
    return {"events": events, "as_of": data.get("as_of"), "attribution": data.get("attribution")}

def boxing_data_fallback() -> list[dict]:
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
        a, b = item.get("a") or {}, item.get("b") or {}
        time_utc = item.get("start_time_utc")
        start = f"{date}T{time_utc}:00Z" if time_utc else None
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
    fallback = boxing_data_fallback()
    # Publish confirmed event cards only. Unassigned individual bouts are not
    # presented as a made-up "additional scheduled bouts" card.
    events = primary["events"]
    events.sort(key=lambda e: (str(e.get("date", "")), str(e.get("name", ""))))
    count = sum(len(e.get("bouts", [])) for e in events)
    snapshot = {
        "provider": "Boxerbook + Boxing Data API",
        "last_updated": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "provider_as_of": primary.get("as_of"),
        "attribution": "Data from Boxerbook (boxerbook.com)",
        "count_events": len(events), "count_bouts": count,
        "events": events,
        "notice": "Confirmed event cards and bout details are supplied by Boxerbook. Unassigned individual bouts are omitted rather than shown as unconfirmed cards. Missing times and broadcasters are not guessed."
    }
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "fights.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Published {count} bouts across {len(events)} confirmed Boxerbook event cards.")

if __name__ == "__main__":
    try: main()
    except Exception as exc:
        print(f"SYNC FAILED: {exc}", file=sys.stderr)
        raise
