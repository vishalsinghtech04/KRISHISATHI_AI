"""Automatic updates for the Government Schemes data.

How it works
  1. For every scheme in the database we ask Gemini (with Google Search grounding) for the CURRENT details.
  2. We only accept an answer that (a) is valid JSON, (b) has real web sources, and (c) passes validation
     (lengths, https official website on a .gov.in / .nic.in host). Anything else is ignored and the old data stays.
  3. New schemes found online are added with autoAdded=True so the page can tell the farmer to verify them.
  4. Every run is logged in the `scheme_updates` table and the time is kept in `meta`.
"""
import json, re, time, threading
from datetime import datetime
from urllib.parse import urlparse
import db

CATEGORIES = ["Credit", "Direct Income", "Infrastructure", "Insurance", "Machinery", "Organic Farming", "Soil & Inputs"]
LIST_FIELDS = ["benefits", "eligibility", "requiredDocuments", "applicationProcess"]
_lock = threading.Lock()

def extract_json(text):
    """Pull the first JSON object out of a model reply (it may be wrapped in ``` fences or have extra words)."""
    if not text:
        return None
    t = text.strip()
    t = re.sub(r"^```(?:json)?|```$", "", t, flags=re.M).strip()
    start = t.find("{")
    if start < 0:
        return None
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(t)):
        ch = t[i]
        if in_str:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == '"': in_str = False
        else:
            if ch == '"': in_str = True
            elif ch == "{": depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(t[start:i + 1])
                    except ValueError:
                        return None
    return None

def good_website(u):
    if not isinstance(u, str):
        return None
    try:
        p = urlparse(u.strip())
    except ValueError:
        return None
    host = (p.hostname or "").lower()
    if p.scheme == "https" and (host.endswith(".gov.in") or host.endswith(".nic.in") or host in ("gov.in", "nic.in")):
        return u.strip()
    return None

def good_text(v, lo, hi):
    return v.strip() if isinstance(v, str) and lo <= len(v.strip()) <= hi else None

def good_list(v):
    if not isinstance(v, list):
        return None
    items = [x.strip() for x in v if isinstance(x, str) and 3 <= len(x.strip()) <= 300]
    return items[:12] if 1 <= len(items) <= 12 else None

def _now():
    return datetime.now().isoformat(timespec="seconds")

def refresh_one(generate, scheme):
    """generate(prompt) -> (text, sources). Returns (status, note)."""
    prompt = f"""Use Google Search and prefer official Indian government sources (.gov.in / .nic.in).
Find the CURRENT details of this Indian agriculture scheme: "{scheme['name']}".
Return ONLY one JSON object with these keys:
"overview" (2-3 sentences), "benefits" (array of short strings), "eligibility" (array), "requiredDocuments" (array),
"applicationProcess" (array of steps), "officialWebsite" (the official https URL, only if you saw it on a .gov.in or .nic.in site, else null),
"recentChanges" (one short sentence about any recent change/announcement, else null).
Rules: do not invent amounts, dates or rules. If you are not sure about a field, use null for it. No text outside the JSON."""
    text, sources = generate(prompt)
    if not sources:
        return "skipped", "no web sources returned"
    obj = extract_json(text)
    if not isinstance(obj, dict):
        return "failed", "reply was not valid JSON"
    new = dict(scheme)
    changed = []
    ov = good_text(obj.get("overview"), 40, 900)
    if ov and ov != scheme.get("overview"):
        new["overview"] = ov; changed.append("overview")
    for f in LIST_FIELDS:
        v = good_list(obj.get(f))
        if v and v != scheme.get(f):
            new[f] = v; changed.append(f)
    site = good_website(obj.get("officialWebsite"))
    if site and site != scheme.get("officialWebsite"):
        new["officialWebsite"] = site; changed.append("officialWebsite")
    new["lastChecked"] = _now()
    new["sources"] = sources
    if changed:
        new["lastUpdated"] = _now()
        note = good_text(obj.get("recentChanges"), 5, 300)
        if note:
            new["recentChanges"] = note
    db.save_scheme(new)
    return ("updated", ",".join(changed)) if changed else ("unchanged", "")

def discover_new(generate, existing):
    names = [s["name"] for s in existing]
    prompt = f"""Use Google Search and official Indian government sources (.gov.in / .nic.in).
These farmer schemes are already in my app: {json.dumps(names)}.
List up to 4 OTHER currently active Indian government schemes for farmers (central or national-level) that are NOT in that list.
Return ONLY a JSON object: {{"schemes":[{{"name":..., "hindiName":..., "category": one of {json.dumps(CATEGORIES)}, "authority":..., "overview":...,
"benefits":[...], "eligibility":[...], "requiredDocuments":[...], "applicationProcess":[...], "officialWebsite": "https://... (.gov.in or .nic.in)"}}]}}.
Rules: only real schemes you found on official sources; do not invent; use an empty list if unsure. No text outside the JSON."""
    text, sources = generate(prompt)
    if not sources:
        return 0
    obj = extract_json(text)
    if not isinstance(obj, dict) or not isinstance(obj.get("schemes"), list):
        return 0
    have = {re.sub(r"\W+", "", n.lower()) for n in names}
    auto_count = sum(1 for s in existing if s.get("autoAdded"))
    added = 0
    for x in obj["schemes"][:4]:
        if not isinstance(x, dict) or auto_count + added >= 20:
            continue
        name = good_text(x.get("name"), 4, 120)
        site = good_website(x.get("officialWebsite"))
        ov = good_text(x.get("overview"), 40, 900)
        lists = {f: good_list(x.get(f)) for f in LIST_FIELDS}
        if not (name and site and ov and all(lists.values())):
            continue
        key = re.sub(r"\W+", "", name.lower())
        if any(key in h or h in key for h in have):
            continue
        cat = x.get("category") if x.get("category") in CATEGORIES else "Direct Income"
        rec = {"id": "auto-" + (re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:50]), "name": name,
               "hindiName": good_text(x.get("hindiName"), 2, 120) or name, "category": cat,
               "isPopular": False, "authority": good_text(x.get("authority"), 2, 160) or "Government of India",
               "overview": ov, "officialWebsite": site, "autoAdded": True,
               "lastChecked": _now(), "lastUpdated": _now(), "sources": sources, **lists}
        db.save_scheme(rec)
        have.add(key)
        added += 1
    return added

def refresh_all(generate, discover=True, pause=4):
    """Run one full update. Returns a short summary string. Safe to call from a thread."""
    if not _lock.acquire(blocking=False):
        return "already running"
    try:
        counts = {"updated": 0, "unchanged": 0, "skipped": 0, "failed": 0}
        for s in db.list_schemes():
            try:
                status, note = refresh_one(generate, s)
            except Exception as e:
                status, note = "failed", repr(e)[:200]
            counts[status] = counts.get(status, 0) + 1
            db.log_scheme_update(s["id"], status, note)
            time.sleep(pause)
        added = 0
        if discover:
            try:
                added = discover_new(generate, db.list_schemes())
                db.log_scheme_update("(discovery)", "ok", f"{added} new")
            except Exception as e:
                db.log_scheme_update("(discovery)", "failed", repr(e)[:200])
        summary = f"{counts['updated']} updated, {counts['unchanged']} unchanged, {counts['skipped']+counts['failed']} not verified, {added} new"
        db.set_meta("schemes_last_run", _now())
        db.set_meta("schemes_last_summary", summary)
        return summary
    finally:
        _lock.release()

def due(days):
    last = db.get_meta("schemes_last_run")
    if not last:
        return True
    try:
        return (datetime.now() - datetime.fromisoformat(last)).total_seconds() >= days * 86400
    except ValueError:
        return True

def start_scheduler(generate, days=7, first_delay=45):
    """Background thread: checks hourly, runs a refresh when the last run is older than `days`."""
    def loop():
        time.sleep(first_delay)
        while True:
            try:
                if due(days):
                    print("[schemes] auto-update started", flush=True)
                    print("[schemes] done:", refresh_all(generate), flush=True)
            except Exception as e:
                print("[schemes] scheduler error:", repr(e), flush=True)
            time.sleep(3600)
    t = threading.Thread(target=loop, name="schemes-updater", daemon=True)
    t.start()
    return t
