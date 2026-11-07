from __future__ import annotations
import os
from datetime import datetime, timedelta, timezone
from flask import Flask, jsonify, request, make_response
import requests

app = Flask(__name__)
OWNER = "JimmyHZz1"
REPO = "Boxing-Fight-Calendar"
WORKFLOW = "sync-fights.yml"
ALLOWED_ORIGIN = "https://jimmyhzz1.github.io"
API = "https://api.github.com"
COOLDOWN = 600

def github_headers():
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if not token:
        raise RuntimeError("The sync service is missing its GitHub Actions token.")
    return {"Accept":"application/vnd.github+json","Authorization":f"Bearer {token}","X-GitHub-Api-Version":"2022-11-28"}

def cors(response):
    origin = request.headers.get("Origin")
    if origin == ALLOWED_ORIGIN:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

@app.after_request
def add_cors(response):
    return cors(response)

@app.get("/health")
def health():
    return jsonify({"ok":True,"service":"sports-calendar-sync"})

@app.route("/sync", methods=["POST","OPTIONS"])
def sync():
    if request.method == "OPTIONS":
        return cors(make_response("",204))
    if request.headers.get("Origin") != ALLOWED_ORIGIN:
        return jsonify({"message":"This request is not from the Sports Calendar app."}),403
    try:
        headers = github_headers()
        runs_url = f"{API}/repos/{OWNER}/{REPO}/actions/workflows/{WORKFLOW}/runs"
        runs_response = requests.get(runs_url, headers=headers, params={"per_page":10}, timeout=20)
        runs_response.raise_for_status()
        runs = runs_response.json().get("workflow_runs", [])
        now = datetime.now(timezone.utc)
        active = next((r for r in runs if r.get("status") in ("queued","in_progress")), None)
        if active:
            return jsonify({"message":"A sports update is already running. Please wait for it to finish."}),409
        recent = next((r for r in runs if r.get("event")=="workflow_dispatch" and r.get("created_at") and now-datetime.fromisoformat(r["created_at"].replace("Z","+00:00"))<timedelta(seconds=COOLDOWN)),None)
        if recent:
            return jsonify({"message":"A fresh update was requested recently. Please wait up to ten minutes before requesting another."}),429
        requested_at = now.isoformat().replace("+00:00","Z")
        dispatch_url = f"{API}/repos/{OWNER}/{REPO}/actions/workflows/{WORKFLOW}/dispatches"
        dispatch = requests.post(dispatch_url, headers=headers, json={"ref":"main"}, timeout=20)
        if dispatch.status_code != 204:
            return jsonify({"message":f"GitHub could not start the update (HTTP {dispatch.status_code}). Check the sync service configuration."}),502
        return jsonify({"accepted":True,"requested_at":requested_at}),202
    except requests.RequestException:
        app.logger.exception("GitHub API request failed")
        return jsonify({"message":"Could not contact GitHub to start the update. Please try again."}),502
    except Exception:
        app.logger.exception("Sync request failed")
        return jsonify({"message":"The sync service is not configured correctly yet."}),503

@app.get("/status")
def status():
    if request.headers.get("Origin") not in (None, ALLOWED_ORIGIN):
        return jsonify({"message":"Origin not allowed."}),403
    try:
        since = request.args.get("since", "")
        headers = github_headers()
        url = f"{API}/repos/{OWNER}/{REPO}/actions/workflows/{WORKFLOW}/runs"
        response = requests.get(url, headers=headers, params={"per_page":10}, timeout=20)
        response.raise_for_status()
        runs = response.json().get("workflow_runs", [])
        matches = [r for r in runs if r.get("event")=="workflow_dispatch" and r.get("created_at","") >= since]
        if not matches:
            return jsonify({"status":"queued"})
        run = matches[0]
        return jsonify({"status":run.get("status"),"conclusion":run.get("conclusion"),"run_url":run.get("html_url")})
    except Exception:
        app.logger.exception("Could not read workflow status")
        return jsonify({"status":"unknown","message":"Unable to check update status."}),502
