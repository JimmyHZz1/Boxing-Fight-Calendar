#!/usr/bin/env python3
"""Safely inspect the Boxerbook schedule payload shape without printing secrets."""
import json
import os
import urllib.error
import urllib.request

URL = "https://boxerbook.com/v1/schedule?when=weekend"

def main():
    key = os.environ.get("BOXERBOOK_API_KEY", "").strip()
    if not key:
        print("BOXERBOOK_DIAGNOSTIC: BOXERBOOK_API_KEY secret is missing.")
        return
    request = urllib.request.Request(
        URL,
        headers={"Authorization": f"Bearer {key}", "Accept": "application/json",
                 "User-Agent": "Boxing-Fight-Calendar/0.1"}
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        print(f"BOXERBOOK_DIAGNOSTIC: HTTP {exc.code}: {detail}")
        return
    except Exception as exc:
        print(f"BOXERBOOK_DIAGNOSTIC: {type(exc).__name__}: {exc}")
        return

    print("BOXERBOOK_DIAGNOSTIC: request succeeded")
    if isinstance(payload, dict):
        print("TOP_LEVEL_KEYS:", sorted(payload.keys()))
        for key_name, value in payload.items():
            if isinstance(value, list):
                print(f"LIST_FIELD {key_name}: count={len(value)}")
                if value and isinstance(value[0], dict):
                    print(f"FIRST_{key_name.upper()}_KEYS:", sorted(value[0].keys()))
                    print(f"FIRST_{key_name.upper()}_SAMPLE:", json.dumps(value[0], ensure_ascii=False)[:3500])
            elif isinstance(value, dict):
                print(f"OBJECT_FIELD {key_name}_KEYS:", sorted(value.keys()))
        print("ATTRIBUTION:", payload.get("attribution"))
        print("AS_OF:", payload.get("as_of"))
    else:
        print("UNEXPECTED_ROOT_TYPE:", type(payload).__name__)

if __name__ == "__main__":
    main()
