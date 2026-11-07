#!/usr/bin/env python3
"""Fetch F1, PDC darts and UFC schedules into independent static JSON feeds."""
from __future__ import annotations
import json, os, sys, urllib.error, urllib.parse, urllib.request
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
    save("ufc.json", {"sport": "ufc", "provider": "UFCalendar", "events": events, "notice": "UFC event schedule and selected full fight cards. Free API allowance: 1,000 requests per month."})
    print(f"UFC: saved {len(events)} events, including up to two upcoming cards and the latest completed card.")

def main():
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

if __name__ == "__main__":
    main()
