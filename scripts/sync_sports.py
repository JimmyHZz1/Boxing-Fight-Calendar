#!/usr/bin/env python3
"""Fetch F1, PDC darts, UFC and BKFC schedules into static JSON feeds."""
from __future__ import annotations
import json, os, sys, re, time, urllib.error, urllib.parse, urllib.request
from html.parser import HTMLParser
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(__file__))
DATA = os.path.join(ROOT, "data")
NOW = datetime.now(timezone.utc)
TODAY = NOW.date()

def iso_now():
    return NOW.isoformat(timespec="seconds").replace("+00:00", "Z")

def request_json(url, key=None, provider="API"):
    # Wikimedia Commons asks automated clients to keep request rates low.
    # Pace each request to avoid HTTP 429 and wasting an image-enrichment batch.
    if provider == "Wikimedia Commons":
        time.sleep(2.0)
    headers = {"Accept": "application/json", "User-Agent": "Sports-Calendar/1.0 (scheduled data sync)"}
    if key:
        headers["Authorization"] = "Bearer " + key
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=40) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"{provider} HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"{provider} connection error: {exc.reason}") from exc

def save(name, payload):
    payload["last_updated"] = iso_now()
    os.makedirs(DATA, exist_ok=True)
    path = os.path.join(DATA, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

def preserve_or_status(name, sport, provider, message):
    path = os.path.join(DATA, name)
    try:
        with open(path, encoding="utf-8") as f:
            payload = json.load(f)
        payload["sync_warning"] = message
        payload["sync_attempted_at"] = iso_now()
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
            f.write("\n")
    except (FileNotFoundError, json.JSONDecodeError):
        save(name, {"sport": sport, "provider": provider, "events": [], "sync_warning": message})

def races_from(payload):
    return payload.get("MRData", {}).get("RaceTable", {}).get("Races", []) or []

def session_time(session):
    if not isinstance(session, dict) or not session.get("date"):
        return None
    return str(session["date"]) + ("T" + str(session["time"]) if session.get("time") else "T12:00:00Z")

def f1_results_map(payload, key):
    out = {}
    for race in races_from(payload):
        rows = race.get(key) or []
        if rows:
            out[str(race.get("round"))] = [{
                "position": r.get("position") or r.get("positionText"),
                "driver": " ".join(x for x in [r.get("Driver", {}).get("givenName"), r.get("Driver", {}).get("familyName")] if x),
                "code": r.get("Driver", {}).get("code"),
                "team": r.get("Constructor", {}).get("name"),
                "time": (r.get("Time") or {}).get("time"),
                "status": r.get("status"),
                "points": r.get("points"),
                "q1": r.get("Q1"), "q2": r.get("Q2"), "q3": r.get("Q3")
            } for r in rows]
    return out

def sync_f1():
    year = NOW.year
    base = f"https://api.jolpi.ca/ergast/f1/{year}"
    schedule = races_from(request_json(f"{base}/races.json?limit=100", provider="Jolpica F1"))
    results = f1_results_map(request_json(f"{base}/results.json?limit=1000", provider="Jolpica F1"), "Results")
    qualifying = f1_results_map(request_json(f"{base}/qualifying.json?limit=1000", provider="Jolpica F1"), "QualifyingResults")
    sprint = f1_results_map(request_json(f"{base}/sprint.json?limit=1000", provider="Jolpica F1"), "SprintResults")
    events = []
    for race in schedule:
        circuit = race.get("Circuit") or {}
        loc = circuit.get("Location") or {}
        round_no = str(race.get("round"))
        sessions = []
        for field, label in [
            ("FirstPractice", "Practice 1"), ("SecondPractice", "Practice 2"),
            ("ThirdPractice", "Practice 3"), ("Sprint", "Sprint"),
            ("SprintQualifying", "Sprint Qualifying"), ("SprintShootout", "Sprint Shootout"),
            ("Qualifying", "Qualifying")
        ]:
            value = race.get(field)
            if isinstance(value, dict) and value.get("date"):
                sessions.append({"name": label, "date": value["date"], "start_at": session_time(value)})
        events.append({
            "id": f"f1-{year}-{round_no}", "name": race.get("raceName") or "Grand Prix",
            "date": race.get("date"), "start_at": session_time({"date": race.get("date"), "time": race.get("time")}),
            "round": int(round_no) if round_no.isdigit() else round_no,
            "circuit": circuit.get("circuitName"), "locality": loc.get("locality"),
            "country": loc.get("country"), "sessions": sessions,
            "results": results.get(round_no, []), "qualifying_results": qualifying.get(round_no, []),
            "sprint_results": sprint.get(round_no, []),
            "status": "completed" if results.get(round_no) else "scheduled",
            "source_url": race.get("url")
        })
    events.sort(key=lambda e: (e.get("date") or "", e.get("round") or 0))
    save("f1.json", {"sport": "f1", "provider": "Jolpica F1", "season": year, "events": events, "notice": "F1 data provided by the community-maintained Jolpica F1 API."})
    print(f"F1: saved {len(events)} events for {year}.")

def paged_darts_calendar(key, organiser):
    """Read the documented Darts API calendar shape and retain paging metadata."""
    all_rows, cursor = [], None
    for _ in range(8):
        params = {"from": (TODAY - timedelta(days=7)).isoformat(), "to": (TODAY + timedelta(days=60)).isoformat(), "organiser": organiser, "limit": 200}
        if cursor:
            params["cursor"] = cursor
        url = "https://api.dartsapi.com/v1/calendar?" + urllib.parse.urlencode(params)
        payload = request_json(url, key, "Darts API")
        rows = payload.get("data") or []
        if isinstance(rows, dict):
            rows = rows.get("events") or rows.get("items") or rows.get("calendar") or []
        if not isinstance(rows, list):
            raise RuntimeError("Darts API calendar returned an unexpected data shape.")
        all_rows.extend(rows)
        cursor = (payload.get("meta") or {}).get("next_cursor")
        if not cursor:
            break
    return all_rows

def is_main_televised_pdc_event(row):
    name = str(row.get("name") or row.get("competition_name") or "").strip()
    organiser = str(row.get("organiser") or "").lower()
    tier = str(row.get("tier") or "").lower()
    if organiser and organiser != "pdc":
        return False
    excluded = re.search(r"\b(?:u\s?23|youth|junior|development|qualifier|qualifying|challenge tour|development tour|affiliate|players championship(?!s? finals)|women(?:'s)? series|pro tour|floor event)\b", name, re.I)
    if excluded:
        return False
    allowed_tiers = {"majors", "european_tour", "world_series"}
    name_match = re.search(
        r"world(?: darts)? championship|world matchplay|premier league|uk open|world grand prix|grand slam|"
        r"european championship|european tour|players championship finals|world cup of darts|"
        r"world series of darts|world masters|\bmasters\b|"
        r"\b(?:bahrain|nordic|us|new zealand|australian|poland|saudi arabia) darts masters\b",
        name, re.I
    )
    return bool(name_match or tier in allowed_tiers)

def pdc_official_fallback_events():
    """Known upcoming televised PDC dates from the official PDC calendar.

    Darts API free-key calendar coverage can omit the forward televised
    schedule. Keep a small, verified safety-net rather than publishing an
    empty darts feed or filling it with youth/qualifier/floor events.
    """
    schedule = [
        {
            "id": "pdc-2026-grand-slam",
            "name": "2026 Grand Slam of Darts",
            "date": "2026-11-14",
            "end_date": "2026-11-22",
            "venue": "Aldersley Leisure Village, Wolverhampton",
            "tier": "majors",
        },
        {
            "id": "pdc-2026-players-championship-finals",
            "name": "2026 Players Championship Finals",
            "date": "2026-11-27",
            "end_date": "2026-11-29",
            "venue": "Butlins, Minehead",
            "tier": "majors",
        },
        {
            "id": "pdc-2026-27-world-championship",
            "name": "2026/27 World Championship",
            "date": "2026-12-11",
            "end_date": "2027-01-03",
            "venue": "Alexandra Palace, London",
            "tier": "majors",
        },
    ]
    events = []
    for item in schedule:
        if item["date"] < (TODAY - timedelta(days=7)).isoformat() or item["date"] > (TODAY + timedelta(days=60)).isoformat():
            continue
        events.append({
            **item,
            "status": "scheduled",
            "organiser": "pdc",
            "source": "Official PDC calendar",
            "source_url": "https://www.pdc.tv/calendar",
        })
    return events


def sync_darts():
    key = os.environ.get("DARTS_API_KEY", "").strip()
    api_rows = []
    api_events = []
    warning = None
    if key:
        try:
            api_rows = paged_darts_calendar(key, "pdc")
            seen = set()
            for row in api_rows:
                if not isinstance(row, dict):
                    continue
                event_name = row.get("name") or row.get("competition_name") or "PDC event"
                event_id = row.get("event_id") or row.get("id")
                date = row.get("date") or row.get("starts_at") or row.get("start_date")
                if not is_main_televised_pdc_event(row) or not date:
                    continue
                stable_id = str(event_id or (str(date) + "-" + re.sub(r"[^a-z0-9]+", "-", event_name.lower()).strip("-")))
                if stable_id in seen:
                    continue
                seen.add(stable_id)
                if str(date)[:10] > (TODAY + timedelta(days=60)).isoformat():
                    continue
                api_events.append({
                    "id": stable_id, "name": event_name, "date": date,
                    "start_at": row.get("starts_at"), "end_date": row.get("end_date") or row.get("ends_at"),
                    "status": row.get("status") or "scheduled",
                    "organiser": row.get("organiser") or "pdc", "tier": row.get("tier"),
                    "venue": row.get("venue") or row.get("location"),
                    "matches": row.get("matches"), "competition_id": row.get("competition_id"),
                    "source": "Darts API",
                    "source_url": row.get("url") or "https://www.pdc.tv/calendar",
                })
        except Exception as exc:
            warning = "Darts API calendar unavailable: " + str(exc)
    else:
        warning = "DARTS_API_KEY is not configured; using verified official PDC calendar dates."

    # Keep the API's detailed/archive entries, but always fill upcoming televised
    # headline dates from the official PDC calendar when the API omits them.
    fallback = pdc_official_fallback_events()
    merged = {str(event.get("id")): event for event in api_events}
    api_names = {re.sub(r"[^a-z0-9]+", " ", str(e.get("name", "")).lower()).strip() for e in api_events}
    for event in fallback:
        key_name = re.sub(r"[^a-z0-9]+", " ", event["name"].lower()).strip()
        if event["id"] not in merged and key_name not in api_names:
            merged[event["id"]] = event
    events = list(merged.values())
    events.sort(key=lambda e: (e.get("date") or "", e.get("name") or ""))

    if not events:
        message = warning or "No televised PDC dates were returned; retaining the previous published schedule."
        preserve_or_status("darts.json", "darts", "Darts API + official PDC calendar", message)
        print("DARTS_EMPTY_WARNING: " + message)
        return

    notice = (
        "Main televised PDC tournaments only. The Darts API supplies available event records; "
        "official PDC calendar dates fill gaps in upcoming headline events. U23, youth, development, "
        "affiliate, qualifier and non-televised Players Championship events are excluded."
    )
    payload = {
        "sport": "darts", "provider": "Darts API + official PDC calendar",
        "organisers_included": ["pdc"], "events": events, "notice": notice,
    }
    if warning:
        payload["sync_warning"] = warning
    save("darts.json", payload)
    print(f"Darts: saved {len(events)} televised PDC events ({len(api_events)} API, {len(fallback)} official fallback candidates from {len(api_rows)} API rows).")

def api_data(payload):
    data = payload.get("data", payload)
    if isinstance(data, dict) and isinstance(data.get("events"), list):
        return data["events"]
    return data if isinstance(data, list) else []

def ufc_detail(key, event):
    identity = event.get("slug") or event.get("id")
    if not identity:
        return event
    payload = request_json("https://api.ufcalendar.com/v1/events/" + urllib.parse.quote(str(identity), safe=""), key, "UFCalendar")
    detail = payload.get("data", payload)
    if isinstance(detail, dict):
        merged = dict(event)
        merged.update(detail)
        return merged
    return event


def enrich_event_fighter_images(events):
    """Attach Commons portraits to UFC/BKFC card rows, with attribution and a local cache."""
    cache_path = os.path.join(DATA, "event-fighter-images.json")
    try:
        with open(cache_path, encoding="utf-8") as handle:
            cache = json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError):
        cache = {"images": {}, "attempted": {}}
    load_image_library()
    images, attempted = cache.setdefault("images", {}), cache.setdefault("attempted", {})
    library_attempted = IMAGE_LIBRARY.setdefault("attempted", {})
    def person_name(value):
        if isinstance(value, dict):
            return value.get("name") or " ".join(x for x in [value.get("given_name"), value.get("family_name")] if x)
        return str(value or "").strip()
    def image_from(value):
        if isinstance(value, dict):
            return value.get("image_url") or value.get("photo_url") or value.get("portrait_url") or value.get("image") or value.get("photo")
        return None
    def sides(bout):
        return [
            ("fighter1", bout.get("fighter1") or bout.get("fighter_a") or bout.get("red") or bout.get("corner_a")),
            ("fighter2", bout.get("fighter2") or bout.get("fighter_b") or bout.get("blue") or bout.get("corner_b"))
        ]
    pending = {}
    for event in events:
        for bout in event.get("fights") or event.get("card") or event.get("bouts") or []:
            if not isinstance(bout, dict): continue
            for side, raw in sides(bout):
                name = person_name(raw)
                key = re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()
                if not key or name.upper() == "TBC": continue
                direct = bout.get(side + "_image") or bout.get(side + "_photo") or image_from(raw)
                if direct: bout[side + "_image"] = direct
                elif key in IMAGE_LIBRARY.get("images", {}):
                    images[key] = IMAGE_LIBRARY["images"][key]
                elif key not in images and key not in attempted:
                    last_attempt = library_attempted.get(key)
                    try:
                        cooling_down = last_attempt and (datetime.now(timezone.utc).date() - datetime.fromisoformat(last_attempt[:10]).date()).days < 30
                    except ValueError:
                        cooling_down = False
                    if not cooling_down: pending[key] = name
    import time
    for key, name in list(pending.items())[:30]:
        if IMAGE_LOOKUP_RATE_LIMITED or IMAGE_DIAGNOSTICS["attempted"] >= IMAGE_LOOKUP_BUDGET:
            break
        IMAGE_DIAGNOSTICS["attempted"] += 1
        result = commons_photo(name, image_kind="portrait")
        if not IMAGE_LOOKUP_RATE_LIMITED:
            attempted[key] = datetime.now(timezone.utc).date().isoformat()
            library_attempted[key] = iso_now()
        if result and result.get("image_url"):
            result = cache_image_locally(name, result, "ufc/bkfc event fighters")
            images[key] = result
            record_image(name, result, "ufc/bkfc event fighters")
            print(f"EVENT_FIGHTER_IMAGE_FOUND: {name}")
        else:
            print(f"EVENT_FIGHTER_IMAGE_NOT_FOUND: {name}")
        time.sleep(0.2)
    for event in events:
        for bout in event.get("fights") or event.get("card") or event.get("bouts") or []:
            if not isinstance(bout, dict): continue
            for side, raw in sides(bout):
                key = re.sub(r"[^a-z0-9]+", " ", person_name(raw).lower()).strip()
                result = images.get(key) or {}
                if not bout.get(side + "_image") and result.get("image_url"):
                    bout[side + "_image"] = result["image_url"]
                if result.get("image_credit"):
                    bout[side + "_image_credit"] = result["image_credit"]
    cache["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    IMAGE_DIAGNOSTICS["checked_at"] = iso_now()
    IMAGE_DIAGNOSTICS["library_entries"] = len(IMAGE_LIBRARY.get("images", {}))
    save_image_library()
    os.makedirs(DATA, exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as handle:
        json.dump(cache, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return events


def sync_ufc():
    key = os.environ.get("UFCALENDAR_API_KEY", "").strip()
    if not key:
        preserve_or_status("ufc.json", "ufc", "UFCalendar", "UFCALENDAR_API_KEY is not configured in GitHub repository secrets.")
        print("UFC: skipped; UFCALENDAR_API_KEY secret is not configured.")
        return
    upcoming_url = "https://api.ufcalendar.com/v1/events?org=ufc&status=upcoming&limit=100"
    recent_url = "https://api.ufcalendar.com/v1/events?org=ufc&status=completed&from=" + (TODAY - timedelta(days=45)).isoformat() + "&limit=100"
    upcoming = api_data(request_json(upcoming_url, key, "UFCalendar"))
    completed = api_data(request_json(recent_url, key, "UFCalendar"))
    upcoming.sort(key=lambda e: e.get("starts_at") or e.get("start_at") or "")
    completed.sort(key=lambda e: e.get("starts_at") or e.get("start_at") or "", reverse=True)

    # Keep every upcoming event in the calendar, but only make detail calls for
    # the next two cards (plus the latest completed card) to protect API quota.
    detail_targets = upcoming[:2] + completed[:1]
    detailed = {}
    for event in detail_targets:
        identity = str(event.get("id") or event.get("slug") or event.get("starts_at") or event.get("start_at") or "")
        try:
            detailed[identity] = ufc_detail(key, event)
        except Exception as exc:
            print(f"UFC_CARD_WARNING: {event.get('title') or event.get('slug')}: {exc}")
            detailed[identity] = event

    events = []
    for event in upcoming + completed[:1]:
        identity = str(event.get("id") or event.get("slug") or event.get("starts_at") or event.get("start_at") or "")
        raw = detailed.get(identity, event)
        fights = raw.get("fights") or raw.get("card") or raw.get("bouts") or []
        events.append({
            "id": raw.get("id") or raw.get("slug"),
            "slug": raw.get("slug"), "name": raw.get("title") or raw.get("name") or raw.get("short_title") or "UFC event",
            "date": str(raw.get("starts_at") or raw.get("start_at") or "")[:10],
            "start_at": raw.get("starts_at") or raw.get("start_at"),
            "status": raw.get("status") or "scheduled",
            "number": raw.get("number"), "is_ppv": raw.get("is_ppv"),
            "is_title_card": raw.get("is_title_card"),
            "main_card_at": raw.get("main_card_at"), "prelims_at": raw.get("prelims_at"),
            "early_prelims_at": raw.get("early_prelims_at"),
            "fights": fights, "source": "UFCalendar"
        })
    events.sort(key=lambda e: (e.get("date") or "", e.get("name") or ""))
    enrich_event_fighter_images(events)
    save("ufc.json", {"sport": "ufc", "provider": "UFCalendar", "events": events, "notice": "All upcoming UFC events returned by UFCalendar, with detailed fight cards for the next two events and the latest completed card. Free API allowance: 1,000 requests per month."})
    print(f"UFC: saved {len(events)} events; detailed cards fetched for the next two upcoming events and latest completed event.")


def sync_bkfc():
    """Read BKFC's public event listings and publish structured event metadata."""
    import html
    import re

    url = "https://www.bkfc.com/events"
    request = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (compatible; SportsCalendar/1.0)",
        "Accept": "text/html,application/xhtml+xml"
    })
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            page = response.read().decode("utf-8", errors="replace")
    except Exception as exc:
        preserve_or_status("bkfc.json", "bkfc", "BKFC official events", f"BKFC schedule could not be fetched: {exc}")
        raise

    records = []
    def walk(value):
        if isinstance(value, dict):
            typ = value.get("@type")
            types = typ if isinstance(typ, list) else [typ]
            if any(str(t).lower() == "event" for t in types) and (value.get("name") or value.get("url")):
                records.append(value)
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    patterns = [
        r"<script[^>]+type=['\"]application/ld\+json['\"][^>]*>(.*?)</script>",
        r"<script[^>]+id=['\"]__NEXT_DATA__['\"][^>]*>(.*?)</script>"
    ]
    for pattern in patterns:
        for match in re.findall(pattern, page, re.I | re.S):
            try:
                walk(json.loads(html.unescape(match)))
            except Exception:
                continue

    # BKFC's current Webflow event list also renders a plain-text card feed.
    # Use its published dates and names as a safe fallback; do not guess time zones.
    if not records:
        visible = html.unescape(re.sub(r"<[^>]+>", " ", page))
        visible = re.sub(r"\\s+", " ", visible)
        pattern = r"((?:January|February|March|April|May|June|July|August|September|October|November|December) \\d{1,2}, \\d{4}) \\1 \\d{1,2}:\\d{2} \\s*[AP]M \\s*#? \\s*(BKFC[^#]{3,100}?) \\s*Buy tickets"
        for match in re.finditer(pattern, visible, re.I):
            records.append({"@type":"Event","name":match.group(2).strip(),"startDate":match.group(1),"url":url,"eventStatus":"EventScheduled"})
    events, seen = [], set()
    for row in records:
        name = html.unescape(str(row.get("name") or row.get("headline") or "")).strip()
        start = row.get("startDate") or row.get("start_date") or row.get("date")
        if not name or not start:
            continue
        event_url = row.get("url") or url
        if isinstance(event_url, dict):
            event_url = event_url.get("url") or url
        if str(event_url).startswith("/"):
            event_url = "https://www.bkfc.com" + str(event_url)
        if "bkfc" not in (name + " " + str(event_url)).lower():
            continue
        identity = str(event_url) + str(start)
        if identity in seen:
            continue
        seen.add(identity)
        location = row.get("location") or {}
        if isinstance(location, dict):
            address = location.get("address") or {}
            place = ", ".join(str(v) for v in [address.get("addressLocality"), address.get("addressRegion"), address.get("addressCountry")] if v) if isinstance(address, dict) else str(address)
        else:
            place = str(location)
        events.append({
            "id": "bkfc-" + str(len(events) + 1),
            "name": name,
            "date": str(start)[:10],
            "start_at": start if "T" in str(start) else None,
            "status": "completed" if "completed" in str(row.get("eventStatus", "")).lower() else "scheduled",
            "location": place or None,
            "source_url": str(event_url),
            "fights": [],
            "source": "BKFC official events"
        })

    if not events:
        preserve_or_status("bkfc.json", "bkfc", "BKFC official events", "The official BKFC page returned no machine-readable event records. Existing published schedule was preserved; parser needs review.")
        raise RuntimeError("No structured BKFC event records found on the official events page.")
    # Preserve previously verified UK-local times, venue details and fight cards
    # when the public listing only exposes a date-level summary.
    try:
        with open(os.path.join(DATA, "bkfc.json"), encoding="utf-8") as existing_file:
            previous = json.load(existing_file)
        old_by_name = {re.sub(r"[^a-z0-9]+", "", str(item.get("name", "")).lower()): item for item in previous.get("events", [])}
        for event in events:
            event_key = re.sub(r"[^a-z0-9]+", "", str(event.get("name", "")).lower())
            old = old_by_name.get(event_key)
            if old:
                for field in ("start_at", "location", "fights", "source_url"):
                    if not event.get(field) and old.get(field):
                        event[field] = old[field]
                if old.get("start_at"):
                    event["date"] = old.get("date") or event["date"]
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    events.sort(key=lambda e: (e.get("date") or "", e.get("name") or ""))
    enrich_event_fighter_images(events)
    save("bkfc.json", {
        "sport": "bkfc", "provider": "BKFC official events", "events": events,
        "notice": "Schedule sourced from BKFC's official events page. Start times and full fight cards are shown only when published by BKFC. UK viewing is event-dependent: BKFC+ carries many live events; selected cards are exclusive to DAZN."
    })
    print(f"BKFC: saved {len(events)} official event listings.")


IMAGE_LIBRARY_PATH = os.path.join(DATA, "sports-images.json")
IMAGE_DIAGNOSTICS = {"attempted": 0, "found": 0, "missing": 0, "rejected": 0, "by_sport": {}}
IMAGE_LIBRARY = {"version": 1, "images": {}}
IMAGE_LIBRARY_LOADED = False
IMAGE_LOOKUP_BUDGET = 0  # Image searches run in a separate scheduled workflow.
IMAGE_LOOKUP_RATE_LIMITED = False

def image_key(name):
    import unicodedata
    value = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", value).strip()

def load_image_library():
    global IMAGE_LIBRARY, IMAGE_LIBRARY_LOADED
    if IMAGE_LIBRARY_LOADED:
        return IMAGE_LIBRARY
    try:
        with open(IMAGE_LIBRARY_PATH, encoding="utf-8") as handle:
            loaded = json.load(handle)
        if isinstance(loaded, dict) and isinstance(loaded.get("images"), dict):
            IMAGE_LIBRARY = loaded
            IMAGE_LIBRARY.setdefault("attempted", {})
    except (FileNotFoundError, json.JSONDecodeError):
        IMAGE_LIBRARY = {"version": 1, "images": {}, "attempted": {}}
    IMAGE_LIBRARY_LOADED = True
    return IMAGE_LIBRARY

def save_image_library():
    os.makedirs(DATA, exist_ok=True)
    IMAGE_LIBRARY["updated_at"] = iso_now()
    with open(IMAGE_LIBRARY_PATH, "w", encoding="utf-8") as handle:
        json.dump(IMAGE_LIBRARY, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def persistent_enrichment_state():
    """Return durable batch history stored separately from per-run diagnostics."""
    load_image_library()
    return IMAGE_LIBRARY.setdefault("enrichment", {
        "batch_number": 0,
        "cumulative_attempted": 0,
        "cumulative_found": 0,
        "cumulative_missing": 0,
        "last_batch_at": None,
        "last_successful_batch_at": None,
        "last_rate_limited_at": None,
        "history": []
    })


IMAGE_MANIFEST_PATH = os.path.join(DATA, "image-library.json")

def load_image_manifest():
    try:
        with open(IMAGE_MANIFEST_PATH, encoding="utf-8") as handle:
            manifest = json.load(handle)
        if not isinstance(manifest, dict):
            raise ValueError("Image manifest must be an object.")
    except (FileNotFoundError, json.JSONDecodeError, ValueError):
        manifest = {"version": 1, "images": {}, "collections": {}}
    manifest.setdefault("images", {})
    manifest.setdefault("collections", {})
    return manifest

def save_image_manifest(manifest):
    os.makedirs(DATA, exist_ok=True)
    manifest["updated_at"] = iso_now()
    with open(IMAGE_MANIFEST_PATH, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

def cache_image_locally(name, result, sport):
    """Download a licensed Commons thumbnail into the repository image library."""
    if not result or not str(result.get("image_url", "")).startswith("https://"):
        return result
    import mimetypes
    url = result["image_url"]
    req = urllib.request.Request(url, headers={"User-Agent": "Sports-Calendar/1.2 (licensed image cache)"})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            content_type = response.headers.get("Content-Type", "").split(";")[0].lower()
            payload = response.read(4 * 1024 * 1024 + 1)
        if not content_type.startswith("image/") or len(payload) > 4 * 1024 * 1024:
            print(f"IMAGE_DOWNLOAD_REJECTED: {name}: unsupported content type or file too large")
            return result
    except Exception as exc:
        print(f"IMAGE_DOWNLOAD_WARNING: {name}: {exc}")
        return result
    extension = {
        "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
        "image/gif": ".gif", "image/svg+xml": ".svg"
    }.get(content_type) or mimetypes.guess_extension(content_type) or ".img"
    category = re.sub(r"[^a-z0-9]+", "-", str(sport).lower()).strip("-") or "other"
    slug = re.sub(r"[^a-z0-9]+", "-", image_key(name)).strip("-") or "image"
    relative = f"assets/images/{category}/{slug}{extension}"
    absolute = os.path.join(ROOT, relative)
    os.makedirs(os.path.dirname(absolute), exist_ok=True)
    if not os.path.exists(absolute):
        with open(absolute, "wb") as handle:
            handle.write(payload)
    manifest = load_image_manifest()
    manifest.setdefault("images", {})[image_key(name)] = {
        "name": name, "path": relative,
        "source_url": result.get("image_page_url"),
        "licence": result.get("image_license"),
        "licence_url": result.get("image_license_url"),
        "creator": result.get("image_credit"),
        "attribution": result.get("image_credit"),
        "verified_at": result.get("image_verified_at") or iso_now(),
        "sport": sport
    }
    save_image_manifest(manifest)
    local_result = dict(result)
    local_result["image_url"] = "./" + relative
    local_result["image_local_path"] = relative
    return local_result

def image_aliases(name):
    """Return ordered Commons search phrases, including common sporting-name variants."""
    key = image_key(name)
    aliases = {
        "max verstappen": ["Max Verstappen", "Verstappen F1"],
        "lewis hamilton": ["Lewis Hamilton", "Hamilton F1"],
        "lando norris": ["Lando Norris", "Norris F1"],
        "charles leclerc": ["Charles Leclerc", "Leclerc F1"],
        "fernando alonso": ["Fernando Alonso", "Alonso F1"],
        "sergio perez": ["Sergio Perez", "Perez F1"],
        "andrea kimi antonelli": ["Kimi Antonelli", "Andrea Kimi Antonelli", "Antonelli Formula One"],
        "red bull racing": ["Red Bull Racing", "Oracle Red Bull Racing"],
        "red bull": ["Red Bull Racing logo ita", "Oracle Red Bull Racing", "Red Bull Racing F1", "Red Bull F1 Team"],
        "rb f1 team": ["Visa Cash App Racing Bulls", "Racing Bulls F1 Team"],
        "alpine f1 team": ["BWT Alpine F1 Team", "Alpine Formula One Team"],
        "haas f1 team": ["MoneyGram Haas F1 Team", "Haas F1 Team"],
        "audi": ["Audi Revolut F1 Team", "Audi F1 Team"],
        "cadillac f1 team": ["Cadillac Formula 1 Team", "Cadillac F1"],
        "mercedes": ["Mercedes AMG Petronas F1 Team", "Mercedes F1"],
        "mclaren": ["McLaren Formula One Team", "McLaren F1"],
        "aston martin": ["Aston Martin F1 Team logo 2024", "Aston Martin Aramco F1 Team"],
        "williams": ["Williams Racing"],
        "alpine": ["BWT Alpine F1 Team"],
        "ferrari": ["Scuderia Ferrari"],
        "racing bulls": ["Visa Cash App Racing Bulls"],
        "kick sauber": ["Stake F1 Team", "Sauber F1 Team"],
        "haas": ["MoneyGram Haas F1 Team"]
    }
    return aliases.get(key, [str(name).strip()])

def commons_photo(name, image_kind="portrait"):
    """Find a high-confidence, licensed Commons image using alternate names and category fallback."""
    global IMAGE_LOOKUP_RATE_LIMITED
    if not name:
        return None
    import html, unicodedata
    def words(value):
        value = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode().lower()
        return set(re.findall(r"[a-z0-9]+", value))
    wanted = words(name) - {"jr", "sr", "ii", "iii", "iv", "team", "f1", "racing", "club"}
    if not wanted:
        return None
    query_names = image_aliases(name)
    if image_kind == "portrait":
        # Search the name and common athlete descriptors in one Commons request.
        # This broadens indexing coverage without multiplying API calls or
        # weakening the exact adjacent-name identity check below.
        variants = []
        for alias in query_names:
            for suffix in ("", "UFC", "MMA fighter", "professional athlete"):
                phrase = ('"' + str(alias).strip() + '" ' + suffix).strip()
                if phrase not in variants:
                    variants.append(phrase)
        query_names = ["(" + " OR ".join(variants) + ")"]
    candidates = []
    seen_titles = set()
    rejection_counts = {}
    query_count = 0

    def reject(reason):
        rejection_counts[reason] = rejection_counts.get(reason, 0) + 1
        IMAGE_DIAGNOSTICS["rejected"] = IMAGE_DIAGNOSTICS.get("rejected", 0) + 1
        IMAGE_DIAGNOSTICS.setdefault("rejection_reasons", {})[reason] = (
            IMAGE_DIAGNOSTICS.setdefault("rejection_reasons", {}).get(reason, 0) + 1
        )

    def inspect_pages(pages, source_label):
        for page in pages:
            title = page.get("title", "").replace("File:", "")
            if not title or title in seen_titles:
                continue
            seen_titles.add(title)
            info = (page.get("imageinfo") or [{}])[0]
            if not str(info.get("mime", "")).startswith("image/"):
                reject("not_an_image")
                continue
            meta = info.get("extmetadata") or {}
            def meta_value(key):
                value = meta.get(key) or {}
                raw = value.get("value", "") if isinstance(value, dict) else str(value)
                return html.unescape(re.sub(r"<[^>]+>", "", str(raw))).strip()
            image_url = info.get("thumburl") or info.get("url")
            page_url = info.get("descriptionurl")
            licence = meta_value("LicenseShortName")
            licence_url = meta_value("LicenseUrl")
            # Commons public-domain text logos sometimes omit LicenseUrl while
            # explicitly identifying their status in LicenseShortName.
            if not licence_url and "public domain" in licence.lower():
                licence_url = "https://commons.wikimedia.org/wiki/Commons:Licensing"
            if not image_url or not page_url or not licence or not licence_url:
                reject("missing_licence_or_source_metadata")
                continue

            title_words = words(title)
            metadata_words = words(meta_value("Artist") + " " + meta_value("Credit"))
            all_identity_words = title_words | metadata_words
            if image_kind == "logo":
                # A constructor result must explicitly identify itself as a logo/mark.
                # This prevents Commons search from accepting cars, liveries or race photos.
                description_words = words(meta_value("ImageDescription"))
                if not ({"logo", "wordmark", "emblem", "crest", "badge", "insignia"} & (title_words | description_words)):
                    reject("logo_asset_not_explicit")
                    continue
                alias_words = words(" ".join(query_names)) - {"logo", "team", "f1", "racing", "formula", "one", "visa", "cash", "app"}
                identity_words = wanted | alias_words
                identity_words -= {"logo", "team", "f1", "racing", "formula", "one"}
                title_hits = identity_words.intersection(title_words)
                meta_hits = identity_words.intersection(metadata_words)
                if not (title_hits | meta_hits):
                    reject("logo_identity_not_matched")
                    continue
                score = len(title_hits | meta_hits) / max(1, len(identity_words))
                if score < 0.20:
                    reject("identity_match_too_weak")
                    continue
            else:
                # Portraits must contain the athlete's adjacent final two name
                # tokens in one source field. Loose surname + first-name matching
                # accepted unrelated people with common names.
                def token_list(value):
                    return re.findall(r"[a-z0-9]+", unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode().lower())
                name_tokens = token_list(name)
                identity_pair = name_tokens[-2:] if len(name_tokens) >= 2 else []
                source_texts = [title, meta_value("ImageDescription"), meta_value("ObjectName"), meta_value("Credit")]
                pair_matched = bool(identity_pair) and any(
                    any(tokens[index:index + 2] == identity_pair for index in range(max(0, len(tokens) - 1)))
                    for tokens in (token_list(value) for value in source_texts)
                )
                if not pair_matched:
                    reject("exact_name_pair_not_matched")
                    continue
                title_hits = wanted.intersection(title_words)
                meta_hits = wanted.intersection(metadata_words)
                score = len(title_hits | meta_hits) / max(1, len(wanted))
            candidates.append((score, {
                "image_url": image_url,
                "image_page_url": page_url,
                "image_credit": "Wikimedia Commons · " + (meta_value("Artist") or meta_value("Credit") or "See source file") + " · " + licence,
                "image_license": licence,
                "image_license_url": licence_url,
                "image_source": "Wikimedia Commons",
                "image_source_class": "licensed-third-party",
                "image_match_score": round(score, 2),
                "image_match_method": source_label,
                "image_verified_at": iso_now()
            }))

    # A few constructor marks have stable Commons file titles but weak
    # search indexing. Resolve those exact file pages before broad searches.
    if image_kind == "logo":
        known_logo_files = {
            "red bull": ["Red Bull Racing logo ita.png", "Red Bull Racing - 2005 Logo.png"],
            "aston martin": ["Aston Martin F1 Team logo 2024.jpg"],
            "mercedes": ["Mercedes-AMG Petronas F1 Team logo (2026).svg"],
            "ferrari": ["Ferrari wordmark.svg"],
            "mclaren": ["McLaren logo (2026).svg"]
        }
        known_titles = known_logo_files.get(image_key(name), [])
        if known_titles and not IMAGE_LOOKUP_RATE_LIMITED:
            params = {
                "action": "query", "format": "json",
                "titles": "|".join("File:" + title for title in known_titles),
                "prop": "imageinfo", "iiprop": "url|extmetadata|mime", "iiurlwidth": 480,
                "iiextmetadatafilter": "Artist|Credit|LicenseShortName|LicenseUrl|UsageTerms"
            }
            try:
                payload = request_json("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params), provider="Wikimedia Commons")
                query_count += 1
                inspect_pages((payload.get("query") or {}).get("pages", {}).values(), "known-file-title")
            except Exception as exc:
                print(f"COMMONS_IMAGE_KNOWN_FILE_WARNING: {name}: {exc}")
                if "HTTP 429" in str(exc):
                    IMAGE_LOOKUP_RATE_LIMITED = True

    for query_name in query_names:
        if IMAGE_LOOKUP_RATE_LIMITED or candidates:
            break
        params = {
            "action": "query", "format": "json", "generator": "search",
            "gsrsearch": query_name + (" logo" if image_kind == "logo" else " portrait"),
            "gsrnamespace": 6, "gsrlimit": 30,
            "prop": "imageinfo", "iiprop": "url|extmetadata|mime", "iiurlwidth": 480,
            "iiextmetadatafilter": "Artist|Credit|LicenseShortName|LicenseUrl|UsageTerms"
        }
        try:
            payload = request_json("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params), provider="Wikimedia Commons")
            query_count += 1
            inspect_pages((payload.get("query") or {}).get("pages", {}).values(), "search:" + query_name)
        except Exception as exc:
            print(f"COMMONS_IMAGE_WARNING: {name} [{query_name}]: {exc}")
            if "HTTP 429" in str(exc):
                IMAGE_LOOKUP_RATE_LIMITED = True
                break

    # Category browsing is useful for logos, but portrait category results are
    # noisy and can surface unrelated people sharing a surname.
    if image_kind == "logo" and not IMAGE_LOOKUP_RATE_LIMITED and not candidates:
        for category_query in query_names:
            if IMAGE_LOOKUP_RATE_LIMITED or candidates:
                break
            params = {
                "action": "query", "format": "json", "list": "search",
                "srsearch": "intitle:\"" + category_query + "\"",
                "srnamespace": 14, "srlimit": 3
            }
            try:
                payload = request_json("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params), provider="Wikimedia Commons")
                query_count += 1
                categories = (payload.get("query") or {}).get("search", [])
                for category in categories:
                    if IMAGE_LOOKUP_RATE_LIMITED or candidates:
                        break
                    category_title = category.get("title", "")
                    if not category_title.startswith("Category:"):
                        continue
                    category_params = {
                        "action": "query", "format": "json", "generator": "categorymembers",
                        "gcmtitle": category_title, "gcmtype": "file", "gcmlimit": 30,
                        "prop": "imageinfo", "iiprop": "url|extmetadata|mime", "iiurlwidth": 480,
                        "iiextmetadatafilter": "Artist|Credit|LicenseShortName|LicenseUrl|UsageTerms"
                    }
                    try:
                        category_payload = request_json("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(category_params), provider="Wikimedia Commons")
                        query_count += 1
                        inspect_pages((category_payload.get("query") or {}).get("pages", {}).values(), "category:" + category_title)
                        if candidates:
                            break
                    except Exception as exc:
                        print(f"COMMONS_IMAGE_CATEGORY_WARNING: {name} [{category_title}]: {exc}")
                        if "HTTP 429" in str(exc):
                            IMAGE_LOOKUP_RATE_LIMITED = True
                            break
            except Exception as exc:
                print(f"COMMONS_IMAGE_CATEGORY_SEARCH_WARNING: {name} [{category_query}]: {exc}")
                if "HTTP 429" in str(exc):
                    IMAGE_LOOKUP_RATE_LIMITED = True
                    break

    IMAGE_DIAGNOSTICS.setdefault("search_details", []).append({
        "name": name, "queries": query_count, "candidate_files": len(seen_titles),
        "accepted": len(candidates), "rejections": rejection_counts
    })
    if not candidates:
        print(f"COMMONS_IMAGE_NOT_FOUND: {name}; queries={query_count}; candidates={len(seen_titles)}; rejections={rejection_counts}")
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    print(f"COMMONS_IMAGE_MATCH: {name}; method={candidates[0][1].get('image_match_method')}; score={candidates[0][0]:.2f}")
    return candidates[0][1]

def record_image(name, result, sport="other"):
    if not result or not result.get("image_url"):
        return
    key = image_key(name)
    if not key:
        return
    record = {"name": name, "sport": sport, **result}
    IMAGE_LIBRARY.setdefault("images", {})[key] = record
    bucket = IMAGE_DIAGNOSTICS["by_sport"].setdefault(sport, {"attempted": 0, "found": 0, "missing": 0, "rejected": 0})
    bucket["found"] += 1
    IMAGE_DIAGNOSTICS["found"] += 1

def add_photos(rows, name_field="name", limit=8, sport="other", image_kind="portrait"):
    load_image_library()
    global IMAGE_LOOKUP_RATE_LIMITED
    for row_index, row in enumerate(rows):
        name = row.get(name_field)
        key = image_key(name)
        if row.get("image_url") or row.get("image") or row.get("photo_url"):
            row["image_url"] = row.get("image_url") or row.get("image") or row.get("photo_url")
            row.setdefault("image_source", "Upstream data")
            continue
        cached = IMAGE_LIBRARY.get("images", {}).get(key) if key else None
        if cached and cached.get("image_url"):
            row.update({k: v for k, v in cached.items() if k.startswith("image_")})
            continue
        if not name or row_index >= limit:
            continue
        attempted = IMAGE_LIBRARY.setdefault("attempted", {})
        last_attempt = attempted.get(key) if key else None
        if last_attempt:
            try:
                if (datetime.now(timezone.utc).date() - datetime.fromisoformat(last_attempt[:10]).date()).days < 14:
                    continue
            except ValueError:
                pass
        if IMAGE_LOOKUP_RATE_LIMITED or IMAGE_DIAGNOSTICS["attempted"] >= IMAGE_LOOKUP_BUDGET:
            break
        IMAGE_DIAGNOSTICS["attempted"] += 1
        bucket = IMAGE_DIAGNOSTICS["by_sport"].setdefault(sport, {"attempted": 0, "found": 0, "missing": 0, "rejected": 0})
        bucket["attempted"] += 1
        result = commons_photo(name, image_kind=image_kind)
        if key and not IMAGE_LOOKUP_RATE_LIMITED:
            # Only cool down a name after a completed Commons lookup. A 429
            # means the request was not completed, so leave it eligible for the
            # next scheduled recovery run.
            attempted[key] = iso_now()
        if result:
            result = cache_image_locally(name, result, sport)
            row.update(result)
            record_image(name, result, sport)
        else:
            IMAGE_DIAGNOSTICS["missing"] += 1
            bucket["missing"] += 1
    return rows

class RankingTableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.row, self.cell = [], None, None
    def handle_starttag(self, tag, attrs):
        if tag == 'tr': self.row = []
        elif tag in ('td', 'th') and self.row is not None: self.cell = []
    def handle_data(self, data):
        value = data.strip()
        if value and self.cell is not None: self.cell.append(value)
    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None and self.row is not None:
            self.row.append(' '.join(self.cell).strip()); self.cell = None
        elif tag == 'tr' and self.row is not None:
            if self.row: self.rows.append(self.row)
            self.row = None

def darts_rankings_from_web():
    url = 'https://www.dartsrankings.com/?wpmobileexternal=true'
    req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0 Sports-Calendar/1.0','Accept':'text/html'})
    with urllib.request.urlopen(req, timeout=40) as response: source = response.read().decode('utf-8', errors='replace')
    parser = RankingTableParser(); parser.feed(source)
    rankings = []
    for cells in parser.rows:
        if len(cells) < 4 or not re.fullmatch(r'\d+', cells[0].strip()): continue
        amount = re.sub(r'[^0-9.]', '', cells[3])
        if not cells[2].strip() or not amount: continue
        rankings.append({'rank':int(cells[0]),'name':cells[2].strip(),'prize_money':f'{float(amount)*1000:,.0f}'})
    if not rankings: raise RuntimeError('Darts rankings page returned no parseable player rows.')
    return rankings

def standings_list(payload, key):
    mr = payload.get("MRData") or {}
    table = mr.get("StandingsTable") or {}
    lists = table.get("StandingsLists") or []
    return (lists[0] or {}).get(key) or [] if lists else []

F1_PROFILE_SLUGS = {
    "george russell": "george-russell", "andrea kimi antonelli": "kimi-antonelli",
    "charles leclerc": "charles-leclerc", "lewis hamilton": "lewis-hamilton",
    "max verstappen": "max-verstappen", "isack hadjar": "isack-hadjar",
    "lando norris": "lando-norris", "oscar piastri": "oscar-piastri",
    "liam lawson": "liam-lawson", "arvid lindblad": "arvid-lindblad",
    "pierre gasly": "pierre-gasly", "franco colapinto": "franco-colapinto",
    "oliver bearman": "oliver-bearman", "rafael camara": "rafael-camara",
    "nico hulkenberg": "nico-hulkenberg", "gabriel bortoleto": "gabriel-bortoleto",
    "carlos sainz": "carlos-sainz", "alexander albon": "alexander-albon",
    "fernando alonso": "fernando-alonso", "lance stroll": "lance-stroll",
    "sergio perez": "sergio-perez", "valtteri bottas": "valtteri-bottas",
    "esteban ocon": "esteban-ocon", "ryo hirakawa": "ryo-hirakawa",
}

def official_f1_driver_images(rows):
    """Use the portrait linked by each driver's official Formula1.com profile."""
    output = []
    for row in rows:
        name = row.get("name", "")
        slug = F1_PROFILE_SLUGS.get(image_key(name))
        if not slug:
            row.pop("image_url", None)
            output.append(row)
            continue
        profile_url = "https://www.formula1.com/en/drivers/" + slug
        try:
            request = urllib.request.Request(
                profile_url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; SportsCalendar/1.0)", "Accept": "text/html"}
            )
            with urllib.request.urlopen(request, timeout=25) as response:
                source = response.read().decode("utf-8", errors="replace")
            source = source.replace("\\/", "/").replace("\\u002F", "/").replace("\\u002f", "/").replace("&amp;", "&")
            candidates = re.findall(r'https://media\.formula1\.com/image/upload/[^"\'\s<>]+', source)
            candidates = [url.rstrip("),;") for url in candidates]
            portrait = next((url for url in candidates if "/common/f1/2026/" in url and "right.webp" in url.lower()), None)
            if not portrait:
                portrait = next((url for url in candidates if "/common/f1/2026/" in url and url.lower().endswith((".webp", ".png", ".jpg", ".jpeg"))), None)
            if not portrait:
                raise RuntimeError("Official driver portrait not present on profile page")
            row.update({
                "image_url": portrait,
                "image_page_url": profile_url,
                "image_credit": "Official Formula 1 driver profile",
                "image_source": "Formula1.com",
                "image_match_method": "official-driver-profile",
                "image_verified_at": iso_now()
            })
            print(f"OFFICIAL_F1_PORTRAIT_FOUND: {name}")
        except Exception as exc:
            row.pop("image_url", None)
            for field in ("image_page_url", "image_credit", "image_source", "image_match_method", "image_verified_at", "image_local_path"):
                row.pop(field, None)
            print(f"OFFICIAL_F1_PORTRAIT_NOT_FOUND: {name}: {exc}")
        output.append(row)
        time.sleep(0.2)
    return output

def sync_sports_hub():
    """Publish current championship tables and rankings as a single static JSON feed."""
    # Keep the last good rankings when an upstream provider is temporarily down.
    # The previous implementation replaced the whole hub with empty arrays on
    # any failed request, which made every sport page lose its standings.
    hub_path = os.path.join(DATA, "sports-hub.json")
    try:
        with open(hub_path, encoding="utf-8") as existing_file:
            existing_hub = json.load(existing_file)
    except (FileNotFoundError, json.JSONDecodeError):
        existing_hub = {}
    previous = existing_hub.get("sports") or {}
    hub = {"sports": dict(previous), "provider": "Jolpica F1, Darts API, UFCalendar and Open Boxing"}
    year = NOW.year

    # Formula 1 driver and constructor championship tables.
    try:
        base = f"https://api.jolpi.ca/ergast/f1/{year}"
        drivers_raw = standings_list(request_json(f"{base}/driverStandings.json?limit=100", provider="Jolpica F1"), "DriverStandings")
        constructors_raw = standings_list(request_json(f"{base}/constructorStandings.json?limit=100", provider="Jolpica F1"), "ConstructorStandings")
        if not drivers_raw or not constructors_raw:
            raise RuntimeError("Jolpica returned an empty driver or constructor table; keeping the last published snapshot.")
        drivers = [{
            "rank": int(x.get("position", 0)), "name": " ".join(y for y in [x.get("Driver", {}).get("givenName"), x.get("Driver", {}).get("familyName")] if y),
            "team": ", ".join(c.get("name", "") for c in x.get("Constructors", [])), "points": x.get("points")
        } for x in drivers_raw]
        constructors = [{"rank": int(x.get("position", 0)), "name": (x.get("Constructor") or {}).get("name"), "points": x.get("points")} for x in constructors_raw]
        hub["sports"]["f1"] = {"drivers": official_f1_driver_images(drivers), "constructors": add_photos(constructors, limit=11, sport="f1 constructors", image_kind="logo"), "season": year, "notice": "Official Formula 1 driver profile portraits; championship data sourced from Jolpica F1."}
    except Exception as exc:
        hub["sports"]["f1"] = {**previous.get("f1", {"drivers": [], "constructors": []}), "sync_warning": str(exc)}

    # PDC Order of Merit.
    try:
        key = os.environ.get("DARTS_API_KEY", "").strip()
        if not key:
            raise RuntimeError("DARTS_API_KEY is not configured.")
        rankings = []
        try:
            raw = request_json("https://api.dartsapi.com/v1/order-of-merit", key, "Darts API")
            data = raw.get("data") or {}
            rows = data.get("table") or data.get("rankings") or data.get("players") or data.get("entries") or []
            if isinstance(rows, dict):
                rows = rows.get("table") or rows.get("players") or rows.get("entries") or []
            for i, row in enumerate(rows):
                if not isinstance(row, dict): continue
                player = row.get("player") if isinstance(row.get("player"), dict) else {}
                name = row.get("name") or row.get("player_name") or (row.get("player") if isinstance(row.get("player"), str) else None) or player.get("name") or "Unknown player"
                rankings.append({
                    "rank": row.get("position") or row.get("rank") or row.get("place") or i + 1,
                    "name": name,
                    "prize_money": row.get("prize_money") or row.get("ranking_prize_money") or row.get("amount"),
                    "points": row.get("points"),
                    "movement": row.get("movement") or row.get("position_change") or row.get("rank_change"),
                    "previous_rank": row.get("previous_position") or row.get("previous_rank"),
                    "image_url": row.get("image_url") or player.get("image_url") or player.get("photo_url")
                })
        except Exception:
            rankings = []
        previous_darts = previous.get("darts", {}).get("rankings", [])
        previous_by_name = {
            image_key(row.get("name")): row
            for row in previous_darts
            if isinstance(row, dict) and row.get("name")
        }

        if not rankings:
            # The public live table is also the fallback when the API is unavailable.
            rankings = darts_rankings_from_web()
        else:
            # The API ranking feed can return the player order without the prize-money
            # amounts. Enrich those same rows from the live Order of Merit table, keeping
            # the API's ordering and all previously verified player identities/images.
            try:
                live_money_rows = darts_rankings_from_web()
                live_money = {
                    image_key(row.get("name")): row
                    for row in live_money_rows
                    if row.get("name") and row.get("prize_money")
                }
                enriched = 0
                for row in rankings:
                    amount = live_money.get(image_key(row.get("name")))
                    if amount and not row.get("prize_money"):
                        row["prize_money"] = amount["prize_money"]
                        row["prize_money_source"] = "DartsRankings.com live PDC Order of Merit"
                        row["prize_money_updated_at"] = iso_now()
                        enriched += 1
                print(f"PDC_PRIZE_MONEY_ENRICHED: {enriched}/{len(rankings)} ranking rows.")
            except Exception as exc:
                print(f"PDC_PRIZE_MONEY_REFRESH_WARNING: {exc}")

        # If the live money table was temporarily unavailable, retain the last known
        # amount for each player rather than blanking the valuation on a routine sync.
        # Keep verified portraits as well: upstream ranking feeds often omit image data.
        previous_images = {
            image_key(row.get("name")): row
            for row in previous_darts
            if isinstance(row, dict) and row.get("name") and row.get("image_url")
        }
        for row in rankings:
            prior = previous_by_name.get(image_key(row.get("name")))
            if prior:
                if not row.get("prize_money") and prior.get("prize_money"):
                    row["prize_money"] = prior["prize_money"]
                    row["prize_money_source"] = prior.get("prize_money_source", "Previously published PDC Order of Merit")
                    row["prize_money_updated_at"] = prior.get("prize_money_updated_at")
                if not row.get("image_url"):
                    for field, value in prior.items():
                        if field == "image_url" or field == "image_rights" or field.startswith("image_"):
                            row[field] = value
        hub["sports"]["darts"] = {
            "rankings": add_photos(rankings, limit=40, sport="darts"),
            "source_url": "https://www.dartsrankings.com/",
            "notice": "PDC Order of Merit prize money (rolling two-year ranking total), updated after PDC ranking events."
        }
    except Exception as exc:
        hub["sports"]["darts"] = {**previous.get("darts", {"rankings": []}), "sync_warning": str(exc)}

    # UFC official divisional rankings and champion rows.
    try:
        key = os.environ.get("UFCALENDAR_API_KEY", "").strip()
        if not key:
            raise RuntimeError("UFCALENDAR_API_KEY is not configured.")
        raw = request_json("https://api.ufcalendar.com/v1/rankings/ufc", key, "UFCalendar")
        board = raw.get("data") or {}
        divisions = []
        for division in board.get("divisions") or []:
            entries = []
            for row in division.get("entries") or []:
                entries.append({"rank": row.get("rank"), "name": row.get("name") or row.get("fighter_name"), "image_url": row.get("image_url") or row.get("photo_url") or row.get("image")})
            divisions.append({"division": division.get("division"), "name": str(division.get("division") or "").replace("-", " ").title(), "entries": add_photos(entries, limit=5, sport="ufc")})
        if not divisions or not any(x.get("entries") for x in divisions):
            raise RuntimeError("UFCalendar returned no UFC ranking entries; keeping the last published snapshot.")
        hub["sports"]["ufc"] = {"divisions": divisions, "snapshot_date": board.get("snapshot_date"), "notice": "Official UFC divisional rankings from UFCalendar. Rank 0 denotes the champion; rankings are updated when the publisher releases a new snapshot."}
    except Exception as exc:
        hub["sports"]["ufc"] = {**previous.get("ufc", {"divisions": []}), "sync_warning": str(exc)}

    # Current boxing title reigns, grouped by weight and sanctioning body.
    try:
        raw = request_json("https://openboxing.org/api/reigns/all.json", provider="Open Boxing")
        reigns = raw if isinstance(raw, list) else raw.get("reigns") or raw.get("data") or []
        grouped = {}
        for reign in reigns:
            period = reign.get("period") or {}
            if period.get("current") not in (True, "true", "True", 1, "1"): continue
            champion = reign.get("champion") or {}
            name_obj = champion.get("name") or {}
            name = name_obj.get("short") or " ".join(x for x in [name_obj.get("first"), name_obj.get("last")] if x)
            title = reign.get("title") or {}
            if not name: continue
            weight = (title.get("weight") or {}).get("class") or "Other"
            org = ((title.get("org") or {}).get("name") or {}).get("abbreviation") or "World title"
            grouped.setdefault(weight, []).append({"name": name, "org": org, "rank": 0, "since": period.get("begins"), "image_url": champion.get("image_url")})
        divisions = []
        for weight, rows in sorted(grouped.items()):
            divisions.append({"name": weight, "champions": add_photos(rows, limit=3, sport="boxing")})
        if not divisions:
            raise RuntimeError("Open Boxing returned no current title reigns; keeping the last published snapshot.")
        hub["sports"]["boxing"] = {"divisions": divisions, "notice": "Current reigns from Open Boxing, covering the major sanctioning bodies and The Ring where recorded. Boxing title status can change between updates; data coverage is subject to the source database."}
    except Exception as exc:
        hub["sports"]["boxing"] = {**previous.get("boxing", {"divisions": []}), "sync_warning": str(exc)}

    for sport_name, sport_data in hub["sports"].items():
        if sport_name == "darts" and sport_data.get("sync_warning"):
            # A retained ranking snapshot is not a fresh update. Keep its last
            # successful timestamp and expose the failed attempt separately.
            sport_data["sync_attempted_at"] = iso_now()
        else:
            sport_data["last_updated"] = iso_now()
            if sport_name == "darts":
                sport_data["last_successful_update"] = iso_now()
                sport_data["data_status"] = "current"
    coverage = {}
    def count_rows(rows):
        rows = rows or []
        return {"total": len(rows), "with_image": sum(1 for row in rows if row.get("image_url")), "missing": sum(1 for row in rows if not row.get("image_url"))}
    f1_data = hub["sports"].get("f1", {})
    coverage["f1 drivers"] = count_rows(f1_data.get("drivers"))
    coverage["f1 constructors"] = count_rows(f1_data.get("constructors"))
    coverage["darts"] = count_rows(hub["sports"].get("darts", {}).get("rankings"))
    coverage["ufc"] = count_rows([entry for division in hub["sports"].get("ufc", {}).get("divisions", []) for entry in division.get("entries", [])])
    coverage["boxing"] = count_rows([champion for division in hub["sports"].get("boxing", {}).get("divisions", []) for champion in division.get("champions", [])])
    IMAGE_DIAGNOSTICS["newly_found"] = IMAGE_DIAGNOSTICS.get("found", 0)
    IMAGE_DIAGNOSTICS["coverage"] = coverage
    IMAGE_DIAGNOSTICS["found"] = sum(item["with_image"] for item in coverage.values())
    IMAGE_DIAGNOSTICS["missing"] = sum(item["missing"] for item in coverage.values())
    IMAGE_DIAGNOSTICS["checked_at"] = iso_now()
    IMAGE_DIAGNOSTICS["library_entries"] = len(IMAGE_LIBRARY.get("images", {}))
    state = persistent_enrichment_state()
    IMAGE_DIAGNOSTICS["attempted"] = state.get("cumulative_attempted", 0)
    IMAGE_DIAGNOSTICS["cumulative_found"] = state.get("cumulative_found", 0)
    IMAGE_DIAGNOSTICS["cumulative_missing"] = state.get("cumulative_missing", 0)
    IMAGE_DIAGNOSTICS["rejected"] = state.get("cumulative_rejected", 0)
    IMAGE_DIAGNOSTICS["cumulative_rejected"] = state.get("cumulative_rejected", 0)
    IMAGE_DIAGNOSTICS["batch_number"] = state.get("batch_number", 0)
    IMAGE_DIAGNOSTICS["last_batch_at"] = state.get("last_batch_at")
    IMAGE_DIAGNOSTICS["last_successful_batch_at"] = state.get("last_successful_batch_at")
    IMAGE_DIAGNOSTICS["last_rate_limited_at"] = state.get("last_rate_limited_at")
    paused = bool(state.get("last_batch_rate_limited", False))
    IMAGE_DIAGNOSTICS["enrichment_status"] = "paused after rate limit" if paused else "awaiting next scheduled batch"
    IMAGE_DIAGNOSTICS["rate_limited"] = paused
    hub["image_diagnostics"] = IMAGE_DIAGNOSTICS
    save_image_library()
    save("sports-hub.json", hub)
    print("IMAGE_DIAGNOSTICS: " + json.dumps(IMAGE_DIAGNOSTICS, ensure_ascii=False))
    print("Sports hub: standings, rankings, title-holders and image diagnostics refreshed.")

def enrich_cached_images():
    """Enrich published image rows in a separate, rate-limited workflow."""
    global IMAGE_LOOKUP_BUDGET, IMAGE_DIAGNOSTICS, IMAGE_LOOKUP_RATE_LIMITED
    IMAGE_LOOKUP_BUDGET = 5
    IMAGE_DIAGNOSTICS = {"attempted": 0, "found": 0, "missing": 0, "rejected": 0, "by_sport": {}}
    IMAGE_LOOKUP_RATE_LIMITED = False
    load_image_library()
    hub_path = os.path.join(DATA, "sports-hub.json")
    with open(hub_path, encoding="utf-8") as handle:
        hub = json.load(handle)
    sports = hub.get("sports") or hub
    f1 = sports.get("f1") or {}
    f1["drivers"] = add_photos(f1.get("drivers") or [], limit=30, sport="f1 drivers")
    # Prioritise fighters before the long tail of the PDC list. The PDC Top 50
    # already has complete portrait coverage; processing the remaining 175 first
    # would otherwise consume every five-image batch before UFC/boxing are reached.
    ufc = sports.get("ufc") or {}
    for division in ufc.get("divisions") or []:
        division["entries"] = add_photos(division.get("entries") or [], limit=15, sport="ufc")
    boxing = sports.get("boxing") or {}
    for division in boxing.get("divisions") or []:
        division["champions"] = add_photos(division.get("champions") or [], limit=12, sport="boxing")
    fights_path = os.path.join(DATA, "fights.json")
    fighter_cache_path = os.path.join(DATA, "fighter-images.json")
    try:
        with open(fights_path, encoding="utf-8") as handle:
            fights_feed = json.load(handle)
        with open(fighter_cache_path, encoding="utf-8") as handle:
            fighter_cache = json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError):
        fights_feed, fighter_cache = {"events": []}, {"images": {}, "attempted": {}}
    boxer_names = sorted({
        str(bout.get(side) or "").strip()
        for event in fights_feed.get("events", [])
        for bout in event.get("bouts", [])
        for side in ("fighter1", "fighter2")
        if str(bout.get(side) or "").strip() and str(bout.get(side) or "").strip().upper() != "TBC"
    })
    boxer_rows = [{"name": name} for name in boxer_names]
    add_photos(boxer_rows, limit=len(boxer_rows), sport="boxing fighters")
    cached_boxers = fighter_cache.setdefault("images", {})
    for row in boxer_rows:
        if not row.get("image_url"):
            continue
        key = image_key(row["name"])
        cached_boxers[key] = {
            "url": row["image_url"], "page_url": row.get("image_page_url"),
            "artist": row.get("image_credit"), "license": row.get("image_license"),
            "license_url": row.get("image_license_url"), "source": row.get("image_source")
        }
    fighter_cache["updated_at"] = iso_now()
    with open(fighter_cache_path, "w", encoding="utf-8") as handle:
        json.dump(fighter_cache, handle, ensure_ascii=False, indent=2)
    # After UFC and boxing title-holders, process boxing event fighters and
    # then the wider PDC list. Keep the already-complete Top 50 out of the way.
    darts = sports.get("darts") or {}
    darts["rankings"] = add_photos(darts.get("rankings") or [], limit=225, sport="darts")
    for sport in ("ufc", "bkfc"):
        path = os.path.join(DATA, sport + ".json")
        try:
            with open(path, encoding="utf-8") as handle:
                feed = json.load(handle)
            feed["events"] = enrich_event_fighter_images(feed.get("events") or [])
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(feed, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
        except (FileNotFoundError, json.JSONDecodeError):
            continue
    def count_rows(rows):
        rows = rows or []
        return {"total": len(rows), "with_image": sum(1 for row in rows if row.get("image_url")), "missing": sum(1 for row in rows if not row.get("image_url"))}
    coverage = {
        "boxing fight card fighters": count_rows(boxer_rows),
        "f1 drivers": count_rows(f1.get("drivers")), "f1 constructors": count_rows(f1.get("constructors")),
        "darts": count_rows(darts.get("rankings")),
        "ufc": count_rows([r for d in ufc.get("divisions", []) for r in d.get("entries", [])]),
        "boxing": count_rows([r for d in boxing.get("divisions", []) for r in d.get("champions", [])])
    }
    found_this_batch = IMAGE_DIAGNOSTICS.get("found", 0)
    state = persistent_enrichment_state()
    if IMAGE_DIAGNOSTICS["attempted"] > 0:
        state["batch_number"] = int(state.get("batch_number", 0)) + 1
        state["last_batch_at"] = iso_now()
        state["last_successful_batch_at"] = iso_now()
    state["cumulative_attempted"] = int(state.get("cumulative_attempted", 0)) + IMAGE_DIAGNOSTICS["attempted"]
    state["cumulative_found"] = int(state.get("cumulative_found", 0)) + found_this_batch
    state["cumulative_missing"] = int(state.get("cumulative_missing", 0)) + IMAGE_DIAGNOSTICS.get("missing", 0)
    state["cumulative_rejected"] = int(state.get("cumulative_rejected", 0)) + IMAGE_DIAGNOSTICS.get("rejected", 0)
    state["last_batch_rate_limited"] = bool(IMAGE_LOOKUP_RATE_LIMITED)
    if IMAGE_LOOKUP_RATE_LIMITED:
        state["last_rate_limited_at"] = iso_now()
    state.setdefault("history", []).append({
        "batch": state.get("batch_number", 0),
        "at": iso_now(),
        "attempted": IMAGE_DIAGNOSTICS["attempted"],
        "found": found_this_batch,
        "missing": IMAGE_DIAGNOSTICS.get("missing", 0),
        "rate_limited": IMAGE_LOOKUP_RATE_LIMITED
    })
    state["history"] = state["history"][-30:]
    IMAGE_DIAGNOSTICS["newly_found"] = found_this_batch
    IMAGE_DIAGNOSTICS["cumulative_attempted"] = state["cumulative_attempted"]
    IMAGE_DIAGNOSTICS["cumulative_found"] = state["cumulative_found"]
    IMAGE_DIAGNOSTICS["cumulative_missing"] = state["cumulative_missing"]
    IMAGE_DIAGNOSTICS["cumulative_rejected"] = state["cumulative_rejected"]
    IMAGE_DIAGNOSTICS["batch_number"] = state["batch_number"]
    IMAGE_DIAGNOSTICS["last_batch_at"] = state.get("last_batch_at")
    IMAGE_DIAGNOSTICS["last_successful_batch_at"] = state.get("last_successful_batch_at")
    IMAGE_DIAGNOSTICS["last_rate_limited_at"] = state.get("last_rate_limited_at")
    IMAGE_DIAGNOSTICS["coverage"] = coverage
    IMAGE_DIAGNOSTICS["found"] = sum(v["with_image"] for v in coverage.values())
    IMAGE_DIAGNOSTICS["missing"] = sum(v["missing"] for v in coverage.values())
    IMAGE_DIAGNOSTICS["checked_at"] = iso_now()
    IMAGE_DIAGNOSTICS["library_entries"] = len(IMAGE_LIBRARY.get("images", {}))
    IMAGE_DIAGNOSTICS["rate_limited"] = IMAGE_LOOKUP_RATE_LIMITED
    hub["image_diagnostics"] = IMAGE_DIAGNOSTICS
    save_image_library()
    with open(hub_path, "w", encoding="utf-8") as handle:
        json.dump(hub, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print("IMAGE_ENRICHMENT: " + json.dumps(IMAGE_DIAGNOSTICS, ensure_ascii=False))


def main(skip_darts_calendar=False):
    try:
        sync_sports_hub()
    except Exception as exc:
        print(f"SPORTS_HUB_WARNING: {exc}")
    try:
        sync_f1()
    except Exception as exc:
        preserve_or_status("f1.json", "f1", "Jolpica F1", str(exc))
        print(f"F1_SYNC_WARNING: {exc}")
    if not skip_darts_calendar:
        try:
            sync_darts()
        except Exception as exc:
            preserve_or_status("darts.json", "darts", "Darts API", str(exc))
            print(f"DARTS_SYNC_WARNING: {exc}")
    try:
        sync_ufc()
    except Exception as exc:
        preserve_or_status("ufc.json", "ufc", "UFCalendar", str(exc))
        print(f"UFC_SYNC_WARNING: {exc}")
    try:
        sync_bkfc()
    except Exception as exc:
        print(f"BKFC_SYNC_WARNING: {exc}")

if __name__ == "__main__":
    if "--images-only" in sys.argv:
        enrich_cached_images()
    elif "--darts-calendar-only" in sys.argv:
        try:
            sync_darts()
        except Exception as exc:
            preserve_or_status("darts.json", "darts", "Darts API", str(exc))
            print(f"DARTS_SYNC_WARNING: {exc}")
            raise
    else:
        main(skip_darts_calendar="--skip-darts-calendar" in sys.argv)
