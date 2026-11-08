#!/usr/bin/env python3
"""Fetch F1, PDC darts, UFC and BKFC schedules into static JSON feeds."""
from __future__ import annotations
import json, os, sys, re, urllib.error, urllib.parse, urllib.request
from html.parser import HTMLParser
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(__file__))
DATA = os.path.join(ROOT, "data")
NOW = datetime.now(timezone.utc)
TODAY = NOW.date()

def iso_now():
    return NOW.isoformat(timespec="seconds").replace("+00:00", "Z")

def request_json(url, key=None, provider="API"):
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
    all_rows, cursor = [], None
    for _ in range(4):
        params = {"from": (TODAY - timedelta(days=7)).isoformat(), "to": (TODAY + timedelta(days=370)).isoformat(), "organiser": organiser, "limit": 200}
        if cursor:
            params["cursor"] = cursor
        url = "https://api.dartsapi.com/v1/calendar?" + urllib.parse.urlencode(params)
        payload = request_json(url, key, "Darts API")
        all_rows.extend(payload.get("data") or [])
        cursor = (payload.get("meta") or {}).get("next_cursor")
        if not cursor:
            break
    return all_rows

def sync_darts():
    key = os.environ.get("DARTS_API_KEY", "").strip()
    if not key:
        preserve_or_status("darts.json", "darts", "Darts API", "DARTS_API_KEY is not configured in GitHub repository secrets.")
        print("Darts: skipped; DARTS_API_KEY secret is not configured.")
        return
    rows = []
    for organiser in ("pdc", "pdc_development", "pdc_affiliate"):
        rows.extend(paged_darts_calendar(key, organiser))
    seen, events = set(), []
    for row in rows:
        event_id = row.get("event_id")
        if not event_id or event_id in seen:
            continue
        seen.add(event_id)
        events.append({
            "id": str(event_id), "name": row.get("name") or "PDC event",
            "date": row.get("date"), "status": row.get("status") or "scheduled",
            "organiser": row.get("organiser"), "tier": row.get("tier"),
            "matches": row.get("matches"), "competition_id": row.get("competition_id"),
            "source": "Darts API"
        })
    events.sort(key=lambda e: (e.get("date") or "", e.get("name") or ""))
    save("darts.json", {"sport": "darts", "provider": "Darts API", "organisers_included": ["pdc", "pdc_development", "pdc_affiliate"], "events": events, "notice": "PDC, PDC Development Tour and PDC Affiliate events. MODUS and non-PDC events are excluded. Free API calendar data may lag the live feed by up to seven days."})
    print(f"Darts: saved {len(events)} PDC-related calendar events.")

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
                elif key not in images and key not in attempted: pending[key] = name
    import time
    for key, name in list(pending.items())[:30]:
        result = commons_photo(name)
        attempted[key] = datetime.now(timezone.utc).date().isoformat()
        if result and result.get("image_url"):
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
    upcoming.sort(key=lambda e: e.get("starts_at") or "")
    completed.sort(key=lambda e: e.get("starts_at") or "", reverse=True)
    chosen = []
    for event in upcoming[:2] + completed[:1]:
        try:
            chosen.append(ufc_detail(key, event))
        except Exception as exc:
            print(f"UFC_CARD_WARNING: {event.get('title') or event.get('slug')}: {exc}")
            chosen.append(event)
    events = []
    for raw in chosen:
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
    save("ufc.json", {"sport": "ufc", "provider": "UFCalendar", "events": events, "notice": "UFC event schedule and selected full fight cards. Free API allowance: 1,000 requests per month."})
    print(f"UFC: saved {len(events)} events, including up to two upcoming cards and the latest completed card.")



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
IMAGE_LIBRARY = {"version": 1, "images": {}}\nIMAGE_LIBRARY_LOADED = False

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
    except (FileNotFoundError, json.JSONDecodeError):
        IMAGE_LIBRARY = {"version": 1, "images": {}}
    IMAGE_LIBRARY_LOADED = True
    return IMAGE_LIBRARY

def save_image_library():
    os.makedirs(DATA, exist_ok=True)
    IMAGE_LIBRARY["updated_at"] = iso_now()
    with open(IMAGE_LIBRARY_PATH, "w", encoding="utf-8") as handle:
        json.dump(IMAGE_LIBRARY, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

def image_aliases(name):
    key = image_key(name)
    aliases = {
        "max verstappen": ["Max Verstappen"],
        "lewis hamilton": ["Lewis Hamilton"],
        "lando norris": ["Lando Norris"],
        "charles leclerc": ["Charles Leclerc"],
        "fernando alonso": ["Fernando Alonso"],
        "sergio perez": ["Sergio Perez"],
        "red bull racing": ["Red Bull Racing", "Oracle Red Bull Racing"],
        "mercedes": ["Mercedes AMG Petronas F1 Team", "Mercedes F1"],
        "mclaren": ["McLaren Formula One Team", "McLaren F1"],
        "aston martin": ["Aston Martin Aramco F1 Team"],
        "williams": ["Williams Racing"],
        "alpine": ["BWT Alpine F1 Team"],
        "ferrari": ["Scuderia Ferrari"],
        "racing bulls": ["Visa Cash App Racing Bulls"],
        "kick sauber": ["Stake F1 Team", "Sauber F1 Team"],
        "haas": ["MoneyGram Haas F1 Team"]
    }
    return aliases.get(key, [str(name).strip()])

def commons_photo(name):
    """Find a high-confidence, reusable Commons image and retain its attribution."""
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
    candidates = []
    seen_titles = set()
    for query_name in query_names:
        params = {
            "action": "query", "format": "json", "generator": "search",
            "gsrsearch": query_name + " portrait",
            "gsrnamespace": 6, "gsrlimit": 20,
            "prop": "imageinfo", "iiprop": "url|extmetadata|mime", "iiurlwidth": 480,
            "iiextmetadatafilter": "Artist|Credit|LicenseShortName|LicenseUrl|UsageTerms"
        }
        try:
            payload = request_json("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params), provider="Wikimedia Commons")
        except Exception as exc:
            print(f"COMMONS_IMAGE_WARNING: {name}: {exc}")
            continue
        for page in (payload.get("query") or {}).get("pages", {}).values():
            title = page.get("title", "").replace("File:", "")
            if title in seen_titles:
                continue
            seen_titles.add(title)
            info = (page.get("imageinfo") or [{}])[0]
            if not str(info.get("mime", "")).startswith("image/"):
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
            if not image_url or not page_url or not licence or not licence_url:
                IMAGE_DIAGNOSTICS["rejected"] += 1
                continue
            title_words = words(title)
            metadata_words = words(meta_value("Artist") + " " + meta_value("Credit"))
            # Prefer title matches. Metadata can strengthen a match but never
            # substitute a missing surname for a multi-word person's name.
            title_hits = wanted.intersection(title_words)
            meta_hits = wanted.intersection(metadata_words)
            surname = sorted(wanted, key=len)[-1]
            if len(wanted) >= 2 and surname not in title_words and surname not in metadata_words:
                IMAGE_DIAGNOSTICS["rejected"] += 1
                continue
            coverage = len(title_hits) / max(1, len(wanted))
            metadata_coverage = len(meta_hits) / max(1, len(wanted))
            score = max(coverage, coverage * 0.75 + metadata_coverage * 0.25)
            if len(wanted) == 1:
                score = 1.0 if next(iter(wanted)) in title_words else 0.0
            if score < 0.62:
                IMAGE_DIAGNOSTICS["rejected"] += 1
                continue
            candidates.append((score, {
                "image_url": image_url,
                "image_page_url": page_url,
                "image_credit": "Wikimedia Commons · " + (meta_value("Artist") or meta_value("Credit") or "See source file") + " · " + licence,
                "image_license": licence,
                "image_license_url": licence_url,
                "image_source": "Wikimedia Commons",
                "image_match_score": round(score, 2),
                "image_verified_at": iso_now()
            }))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
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

def add_photos(rows, name_field="name", limit=8, sport="other"):
    load_image_library()
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
        IMAGE_DIAGNOSTICS["attempted"] += 1
        bucket = IMAGE_DIAGNOSTICS["by_sport"].setdefault(sport, {"attempted": 0, "found": 0, "missing": 0, "rejected": 0})
        bucket["attempted"] += 1
        result = commons_photo(name)
        if result:
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
        hub["sports"]["f1"] = {"drivers": add_photos(drivers, limit=25, sport="f1 drivers"), "constructors": add_photos(constructors, limit=11, sport="f1 constructors"), "season": year, "notice": "Official season standings sourced from the community-maintained Jolpica F1 API."}
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
            rows = raw.get("data") or []
            if isinstance(rows, dict): rows = rows.get("players") or rows.get("entries") or rows.get("rankings") or []
            for i, row in enumerate(rows):
                player = row.get("player") if isinstance(row.get("player"), dict) else {}
                name = row.get("name") or row.get("player_name") or (row.get("player") if isinstance(row.get("player"), str) else None) or player.get("name") or "Unknown player"
                rankings.append({"rank": row.get("position") or row.get("rank") or i + 1, "name": name, "prize_money": row.get("prize_money") or row.get("ranking_prize_money"), "points": row.get("points"), "image_url": row.get("image_url") or player.get("image_url") or player.get("photo_url")})
        except Exception:
            rankings = []
        if not rankings: rankings = darts_rankings_from_web()
        hub["sports"]["darts"] = {"rankings": add_photos(rankings, limit=40, sport="darts"), "source_url": "https://www.dartsrankings.com/", "notice": "PDC Order of Merit live table. Rankings are updated after PDC ranking events."}
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

    for sport_data in hub["sports"].values():
        sport_data["last_updated"] = iso_now()
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
    hub["image_diagnostics"] = IMAGE_DIAGNOSTICS
    save_image_library()
    save("sports-hub.json", hub)
    print("IMAGE_DIAGNOSTICS: " + json.dumps(IMAGE_DIAGNOSTICS, ensure_ascii=False))
    print("Sports hub: standings, rankings, title-holders and image diagnostics refreshed.")

def main():
    try:
        sync_sports_hub()
    except Exception as exc:
        print(f"SPORTS_HUB_WARNING: {exc}")
    try:
        sync_f1()
    except Exception as exc:
        preserve_or_status("f1.json", "f1", "Jolpica F1", str(exc))
        print(f"F1_SYNC_WARNING: {exc}")
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
    main()
