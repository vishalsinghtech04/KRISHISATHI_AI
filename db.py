"""SQLite database for KrishiSathi (no extra install needed - sqlite3 ships with Python)."""
import os, re, json, sqlite3
from datetime import datetime

BASE = os.path.dirname(os.path.abspath(__file__))
# Vercel's deployed source directory is read-only. Use its writable temporary
# directory unless a persistent external database path is explicitly configured.
if os.getenv("KRISHI_DB"):
    DB_PATH = os.getenv("KRISHI_DB")
elif os.getenv("VERCEL") == "1":
    DB_PATH = "/tmp/krishisathi.db"
else:
    DB_PATH = os.path.join(BASE, "krishisathi.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS chat_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id  TEXT NOT NULL,
    role       TEXT NOT NULL CHECK (role IN ('user','bot')),
    text       TEXT NOT NULL,
    source     TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_client ON chat_messages (client_id, id);

CREATE TABLE IF NOT EXISTS diagnoses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id    TEXT NOT NULL,
    crop         TEXT,
    disease_name TEXT,
    confidence   INTEGER,
    severity     TEXT,
    result_json  TEXT NOT NULL,
    source       TEXT,
    created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_diag_client ON diagnoses (client_id, id);

CREATE TABLE IF NOT EXISTS users (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    phone            TEXT UNIQUE,
    email            TEXT UNIQUE,
    password_hash    TEXT NOT NULL,
    state            TEXT,
    district         TEXT,
    village          TEXT,
    land_size_acres  REAL,
    saved_crops      TEXT NOT NULL DEFAULT '[]',
    saved_mandis     TEXT NOT NULL DEFAULT '[]',
    user_crops       TEXT NOT NULL DEFAULT '[]',
    created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crops (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, hindi_name TEXT, category TEXT, season TEXT, data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS schemes (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, hindi_name TEXT, category TEXT, is_popular INTEGER, data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mandi_prices (
    id TEXT PRIMARY KEY, crop TEXT NOT NULL, state TEXT, district TEXT, mandi TEXT,
    min_price REAL, max_price REAL, modal_price REAL, previous_price REAL, last_updated TEXT, data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scheme_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT, scheme_id TEXT, checked_at TEXT NOT NULL, status TEXT NOT NULL, note TEXT
);
CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY, value TEXT
);
-- other reference data (soil, tips, calendar, weather, states ...) stored as one JSON document per name
CREATE TABLE IF NOT EXISTS reference_data (
    name TEXT PRIMARY KEY, data TEXT NOT NULL
);
"""

def _conn():
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    return c

SEED_PATH = os.path.join(BASE, "seed_data.json")

def init_db():
    with _conn() as c:
        c.executescript(SCHEMA)
    seed_if_empty()

def seed_if_empty():
    """Fill the reference tables from seed_data.json the first time (or when a table is empty)."""
    if not os.path.exists(SEED_PATH):
        return
    with open(SEED_PATH, encoding="utf-8") as f:
        seed = json.load(f)
    dump = lambda o: json.dumps(o, ensure_ascii=False)
    with _conn() as c:
        if c.execute("SELECT COUNT(*) FROM crops").fetchone()[0] == 0:
            for x in seed.get("CROPS_DATA", []):
                c.execute("INSERT OR REPLACE INTO crops VALUES (?,?,?,?,?,?)",
                          (x["id"], x.get("name"), x.get("hindiName"), x.get("category"), x.get("season"), dump(x)))
        if c.execute("SELECT COUNT(*) FROM schemes").fetchone()[0] == 0:
            for x in seed.get("GOVERNMENT_SCHEMES_DATA", []):
                c.execute("INSERT OR REPLACE INTO schemes VALUES (?,?,?,?,?,?)",
                          (x["id"], x.get("name"), x.get("hindiName"), x.get("category"), 1 if x.get("isPopular") else 0, dump(x)))
        if c.execute("SELECT COUNT(*) FROM mandi_prices").fetchone()[0] == 0:
            for x in seed.get("MANDI_PRICES_DATA", []):
                c.execute("INSERT OR REPLACE INTO mandi_prices VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                          (x["id"], x.get("crop"), x.get("state"), x.get("district"), x.get("mandi"), x.get("minPrice"),
                           x.get("maxPrice"), x.get("modalPrice"), x.get("previousPrice"), x.get("lastUpdated"), dump(x)))
        if c.execute("SELECT COUNT(*) FROM reference_data").fetchone()[0] == 0:
            for name in ("MANDI_TREND_HISTORY", "STATES_LIST", "DISTRICT_WEATHER", "SOIL_TYPES", "NPK_EXPLANATION",
                         "FARMING_TIPS_DATA", "FARMING_CALENDAR_DATA", "SAMPLE_DISEASE_CASES"):
                if name in seed:
                    c.execute("INSERT OR REPLACE INTO reference_data VALUES (?,?)", (name, dump(seed[name])))

def frontend_data():
    """All reference data as {JS_GLOBAL_NAME: value}, in the same shape the old static/data/*.js files had."""
    out = {}
    with _conn() as c:
        out["CROPS_DATA"] = [json.loads(r["data"]) for r in c.execute("SELECT data FROM crops ORDER BY rowid")]
        out["GOVERNMENT_SCHEMES_DATA"] = [json.loads(r["data"]) for r in c.execute("SELECT data FROM schemes ORDER BY rowid")]
        out["SCHEMES_META"] = {"lastRun": get_meta("schemes_last_run"), "summary": get_meta("schemes_last_summary")}
        out["MANDI_PRICES_DATA"] = [json.loads(r["data"]) for r in c.execute("SELECT data FROM mandi_prices ORDER BY rowid")]
        for r in c.execute("SELECT name,data FROM reference_data"):
            out[r["name"]] = json.loads(r["data"])
    return out

# ---------- users ----------
def _user_row(r):
    if not r:
        return None
    return {"id": r["id"], "name": r["name"], "phone": r["phone"] or "", "email": r["email"] or "",
            "state": r["state"] or "", "district": r["district"] or "", "village": r["village"] or "",
            "landSizeAcres": r["land_size_acres"] if r["land_size_acres"] is not None else 0,
            "savedCrops": json.loads(r["saved_crops"]), "savedMandis": json.loads(r["saved_mandis"]),
            "userCrops": json.loads(r["user_crops"])}

def create_user(name, phone, email, password_hash, state, district):
    """Returns user dict, or None if the phone/email already exists."""
    try:
        with _conn() as c:
            cur = c.execute("""INSERT INTO users (name,phone,email,password_hash,state,district,land_size_acres,
                               saved_crops,saved_mandis,user_crops,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                            (name, phone, email, password_hash, state, district, 0,
                             '["wheat","rice"]', '["m1"]', '[]', _now()))
            uid = cur.lastrowid
    except sqlite3.IntegrityError:
        return None
    return get_user(uid)

def get_user(uid):
    with _conn() as c:
        return _user_row(c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())

def find_user_for_login(contact):
    """Returns (user_dict, password_hash) or (None, None). Contact is a phone number or an email."""
    with _conn() as c:
        r = c.execute("SELECT * FROM users WHERE phone=? OR email=?", (contact, contact.lower())).fetchone()
    return (_user_row(r), r["password_hash"]) if r else (None, None)

def update_user(uid, fields):
    cols = {"name": "name", "state": "state", "district": "district", "village": "village",
            "landSizeAcres": "land_size_acres"}
    jcols = {"savedCrops": "saved_crops", "savedMandis": "saved_mandis", "userCrops": "user_crops"}
    sets, vals = [], []
    for k, col in cols.items():
        if k in fields:
            sets.append(f"{col}=?"); vals.append(fields[k])
    for k, col in jcols.items():
        if k in fields and isinstance(fields[k], list):
            sets.append(f"{col}=?"); vals.append(json.dumps(fields[k], ensure_ascii=False))
    if sets:
        with _conn() as c:
            c.execute(f"UPDATE users SET {', '.join(sets)} WHERE id=?", (*vals, uid))
    return get_user(uid)

def migrate_client(old_id, new_id):
    """Move an anonymous browser's chat/diagnosis history to a user account after login."""
    if old_id == new_id or old_id == "anonymous":
        return
    with _conn() as c:
        c.execute("UPDATE chat_messages SET client_id=? WHERE client_id=?", (new_id, old_id))
        c.execute("UPDATE diagnoses SET client_id=? WHERE client_id=?", (new_id, old_id))

def clean_client_id(raw):
    raw = (raw or "").strip()
    return raw if re.fullmatch(r"[A-Za-z0-9_-]{8,64}", raw) else "anonymous"

def _now():
    return datetime.now().isoformat(timespec="seconds")

def save_chat(client_id, user_text, bot_text, source):
    with _conn() as c:
        c.execute("INSERT INTO chat_messages (client_id,role,text,source,created_at) VALUES (?,?,?,?,?)",
                  (client_id, "user", user_text, None, _now()))
        c.execute("INSERT INTO chat_messages (client_id,role,text,source,created_at) VALUES (?,?,?,?,?)",
                  (client_id, "bot", bot_text, source, _now()))

def get_chat(client_id, limit=100):
    with _conn() as c:
        rows = c.execute("SELECT role,text,created_at FROM chat_messages WHERE client_id=? ORDER BY id DESC LIMIT ?",
                         (client_id, limit)).fetchall()
    return [dict(r) for r in reversed(rows)]

def clear_chat(client_id):
    with _conn() as c:
        c.execute("DELETE FROM chat_messages WHERE client_id=?", (client_id,))

def save_diagnosis(client_id, crop, data, source):
    d = data if isinstance(data, dict) else {}
    conf = d.get("confidence")
    with _conn() as c:
        c.execute("""INSERT INTO diagnoses (client_id,crop,disease_name,confidence,severity,result_json,source,created_at)
                     VALUES (?,?,?,?,?,?,?,?)""",
                  (client_id, crop, d.get("diseaseName"), conf if isinstance(conf, int) else None,
                   d.get("severity"), json.dumps(data, ensure_ascii=False), source, _now()))

def get_diagnoses(client_id, limit=20):
    with _conn() as c:
        rows = c.execute("SELECT id,crop,disease_name,confidence,severity,result_json,source,created_at "
                         "FROM diagnoses WHERE client_id=? ORDER BY id DESC LIMIT ?", (client_id, limit)).fetchall()
    out = []
    for r in rows:
        x = dict(r)
        x["result"] = json.loads(x.pop("result_json"))
        out.append(x)
    return out

def delete_diagnoses(client_id):
    with _conn() as c:
        c.execute("DELETE FROM diagnoses WHERE client_id=?", (client_id,))


# ---------- meta + scheme auto-update helpers ----------
def get_meta(key):
    with _conn() as c:
        r = c.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    return r["value"] if r else None

def set_meta(key, value):
    with _conn() as c:
        c.execute("INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)", (key, value))

def list_schemes():
    with _conn() as c:
        return [json.loads(r["data"]) for r in c.execute("SELECT data FROM schemes ORDER BY rowid")]

def save_scheme(x):
    """Insert or replace one scheme (x is the full scheme dict)."""
    with _conn() as c:
        c.execute("INSERT OR REPLACE INTO schemes (id,name,hindi_name,category,is_popular,data) VALUES (?,?,?,?,?,?)",
                  (x["id"], x.get("name"), x.get("hindiName"), x.get("category"), 1 if x.get("isPopular") else 0,
                   json.dumps(x, ensure_ascii=False)))

def log_scheme_update(scheme_id, status, note=""):
    with _conn() as c:
        c.execute("INSERT INTO scheme_updates (scheme_id,checked_at,status,note) VALUES (?,?,?,?)",
                  (scheme_id, _now(), status, note[:500]))
