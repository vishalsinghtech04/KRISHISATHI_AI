
import os, re, json, base64, secrets, threading, sys, urllib.request, urllib.parse, traceback, time
from dotenv import load_dotenv
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, render_template, session, Response
from werkzeug.security import generate_password_hash, check_password_hash
import db
import schemes_updater

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

BASE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE, ".env"))
app = Flask(__name__, template_folder=os.path.join(BASE, "templates"), static_folder=os.path.join(BASE, "static"))
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024

def _secret_key():
    """Use configured key; avoid writing to the read-only source directory on Vercel."""
    k = os.getenv("SECRET_KEY")
    if k:
        return k
    # Serverless instances may be replaced at any time. Set SECRET_KEY in Vercel
    # for stable login sessions; this fallback only prevents startup write errors.
    if os.getenv("VERCEL") == "1":
        return secrets.token_hex(32)
    path = os.path.join(BASE, ".secret_key")
    try:
        with open(path, encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        k = secrets.token_hex(32)
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(k)
        except OSError:
            pass
        return k

app.secret_key = _secret_key()
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax", PERMANENT_SESSION_LIFETIME=60*60*24*30)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip().strip('"').strip("'")
if GEMINI_API_KEY in ("YOUR_KEY", "YOUR_API_KEY", "your_key_here"):
    GEMINI_API_KEY = ""
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.7-flash")

WMO = {
    0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Fog",
    51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",
    71:"Light snow",73:"Snow",75:"Heavy snow",80:"Rain showers",81:"Rain showers",82:"Violent showers",
    95:"Thunderstorm",96:"Thunderstorm with hail",99:"Thunderstorm with hail"
}
_weather_cache = {}
db.init_db()

def anon_client_id():
    return db.clean_client_id(request.headers.get("X-Client-Id"))

def current_user_id():
    return session.get("uid")

def client_id():
    """History is stored per logged-in user, or per anonymous browser id when nobody is logged in."""
    uid = current_user_id()
    return f"u{uid}" if uid else anon_client_id()

LANGUAGES = {"English","Hindi","Hinglish","Marathi","Gujarati","Punjabi","Bengali","Tamil","Telugu","Kannada","Malayalam","Odia","Urdu"}

def clean_language(raw):
    raw = str(raw or "").strip().title()
    return raw if raw in LANGUAGES else None

def _grounding_sources(response):
    """Web pages Gemini used (from Google Search grounding), as [{title, uri}]."""
    out, seen = [], set()
    try:
        cand = (response.candidates or [None])[0]
        gm = getattr(cand, "grounding_metadata", None)
        for ch in (getattr(gm, "grounding_chunks", None) or []):
            w = getattr(ch, "web", None)
            uri = getattr(w, "uri", None)
            if isinstance(uri, str) and uri.startswith("http") and uri not in seen:
                seen.add(uri)
                out.append({"title": (getattr(w, "title", None) or uri)[:120], "uri": uri})
    except Exception:
        pass
    return out[:6]

def grounded_generate(prompt, system=None):
    """-> (text, sources). Uses Google Search grounding; if that is unavailable, falls back to a normal answer (sources=[])."""
    contents = [{"role": "user", "parts": [{"text": prompt}]}]
    try:
        return gemini_generate(contents, system, grounded=True, want_sources=True)
    except Exception as e:
        print("Grounded call failed, retrying without search:", repr(e), flush=True)
        return gemini_generate(contents, system) or "", []

def err_code(e):
    """google-genai errors expose the HTTP status as `.code` (not `.status_code`)."""
    for attr in ("code", "status_code"):
        v = getattr(e, attr, None)
        if isinstance(v, int):
            return v
    return None

def friendly_error(e):
    code = err_code(e)
    text = str(e)
    if code in (400, 401, 403) and ("API key" in text or "API_KEY" in text or code in (401, 403)):
        return 401, "Gemini API key galat hai ya allowed nahi hai. .env me sahi key dalein (aistudio.google.com/apikey) aur server restart karein."
    if code == 404:
        return 502, "Gemini model nahi mila. .env me GEMINI_MODEL=gemini-2.5-flash ya gemini-3.5-flash try karein."
    if code == 429:
        return 429, "Gemini ka free quota/limit khatam ho gaya. Thodi der baad try karein."
    if code in (500, 503, 504):
        return 503, "Gemini abhi busy hai. Thodi der baad dobara try karein."
    return 502, "Gemini request fail hui. Server terminal me exact error dekhein."

def gemini_generate(contents, system_instruction=None, response_mime=None, grounded=False, want_sources=False):
    """Generate content with the official Google GenAI Python SDK.

    Retries temporary 503/429 errors with backoff. If the primary model
    remains temporarily unavailable, one configured fallback model is tried.
    """
    if not GEMINI_API_KEY:
        return None
    if genai is None or types is None:
        raise RuntimeError("google-genai package is not installed. Run: pip install -U google-genai")

    client = genai.Client(api_key=GEMINI_API_KEY)

    sdk_contents = []
    for item in contents:
        role = item.get("role", "user")
        parts = []
        for part in item.get("parts", []):
            if "text" in part:
                parts.append(types.Part.from_text(text=part["text"]))
            elif "inlineData" in part:
                data = base64.b64decode(part["inlineData"]["data"])
                parts.append(types.Part.from_bytes(
                    data=data,
                    mime_type=part["inlineData"].get("mimeType", "image/jpeg")
                ))
        sdk_contents.append(types.Content(role=role, parts=parts))

    config_kwargs = {}
    if system_instruction:
        config_kwargs["system_instruction"] = system_instruction
    if response_mime:
        config_kwargs["response_mime_type"] = response_mime
    if grounded:   # let Gemini use Google Search for fresh, source-backed answers
        config_kwargs["tools"] = [types.Tool(google_search=types.GoogleSearch())]
    config = types.GenerateContentConfig(**config_kwargs) if config_kwargs else None

    models_to_try = [GEMINI_MODEL]
    if GEMINI_FALLBACK_MODEL and GEMINI_FALLBACK_MODEL != GEMINI_MODEL:
        models_to_try.append(GEMINI_FALLBACK_MODEL)

    last_error = None
    for model_index, model_name in enumerate(models_to_try):
        for attempt in range(3):
            try:
                print(f"Gemini request: model={model_name}, attempt={attempt + 1}", flush=True)
                response = client.models.generate_content(
                    model=model_name,
                    contents=sdk_contents,
                    config=config,
                )
                text = response.text or ""
                return (text, _grounding_sources(response)) if want_sources else text
            except Exception as e:
                last_error = e
                status_code = err_code(e)

                if status_code in (503, 500, 429) and attempt < 2:
                    delay = 2 * (attempt + 1)
                    print(
                        f"Gemini temporarily unavailable ({status_code}). "
                        f"Retrying in {delay}s... ({attempt + 1}/2)",
                        flush=True
                    )
                    time.sleep(delay)
                    continue

                if status_code in (503, 500, 429, 404) and model_index < len(models_to_try) - 1:
                    print(
                        f"Primary Gemini model {model_name} unavailable; "
                        f"trying fallback model {models_to_try[model_index + 1]}",
                        flush=True
                    )
                    break

                raise

    raise last_error

def fallback_chat(query):
    q = (query or "").lower()
    if any(x in q for x in ["yellow","leaf","leaves","peele patte","peela"]):
        return """### Diagnostic Assessment: Leaf Yellowing (Chlorosis)

**1. Summary / Direct Answer:**
Yellowing of leaves in Indian crops is commonly caused by nitrogen deficiency, waterlogging/poor drainage, or iron/zinc deficiency. Some fungal diseases can also cause yellowing.

**2. Possible Causes:**
- Nitrogen deficiency, especially on older lower leaves.
- Root waterlogging or poor drainage.
- Zinc or iron deficiency causing interveinal chlorosis.
- Early rust/blight when yellow spots or pustules appear.

**3. Basic Prevention:**
- Maintain field drainage and avoid standing water.
- Use well-decomposed farmyard manure and balanced nutrition.
- Rotate with suitable legume crops.

**4. Recommended Next Steps:**
- Check soil moisture and the pattern of yellowing before applying fertilizer.
- Use a soil test to confirm nutrient deficiency.
- If disease symptoms spread quickly, take a sample to a KVK for diagnosis.

**5. When to Contact an Agriculture Expert:**
If yellowing spreads rapidly, plants wilt, or distinct fungal/pest signs appear, contact your local KVK or Kisan Call Centre at 1800-180-1551."""
    if any(x in q for x in ["fertilizer","wheat","npk","urea","dap","khaad","gehun"]):
        return """### Nutrient & Fertilizer Guidance

**1. Summary / Direct Answer:**
For wheat and cereal crops, fertilizer rates should be based on soil testing, variety, target yield and local recommendations.

**2. Recommended Schedule:**
- Apply the basal phosphorus/potassium dose and part of nitrogen at sowing.
- Split nitrogen applications, with an important dose around the crown-root-initiation stage.
- Avoid excessive nitrogen and apply urea when soil and weather conditions are suitable.

**3. Basic Prevention:**
- Prefer a Soil Health Card/soil test before the season.
- Use balanced NPK and micronutrients only when indicated.

**4. When to Contact an Agriculture Expert:**
Ask the local agriculture officer or KVK for a field-specific fertilizer recommendation."""
    if any(x in q for x in ["scheme","pm kisan","kisan credit","fasal bima","yojana"]):
        return """### Agriculture Government Schemes Overview

**PM-KISAN:** Income support is transferred directly to eligible farmer families subject to current government rules and verification.

**PM Fasal Bima Yojana:** Crop insurance support is available under notified crops/areas and applicable premium rules.

**Kisan Credit Card (KCC):** Institutional agricultural credit is available to eligible farmers subject to bank and government norms.

Use the Government Schemes section in KrishiSathi for official portal links and application guidance."""
    return """### KrishiSathi Agronomy Advisory

**1. Summary / Direct Answer:**
Good farm decisions depend on timely sowing, balanced nutrition, soil testing, irrigation management, weather monitoring and regular pest scouting.

**2. Basic Prevention:**
- Test soil before major fertilizer decisions.
- Use certified seed suitable for your agro-climatic zone.
- Check weather before spraying or irrigating.
- Compare mandi prices before selling.

**3. When to Contact an Agriculture Expert:**
For severe disease, unknown pests, rapid crop decline or soil salinity, contact your District Agriculture Officer, block agriculture officer or KVK."""

def fallback_diagnosis(crop):
    c = (crop or "").lower()
    if "tomato" in c:
        return {
            "diseaseName":"Early Blight (Alternaria solani)","scientificName":"Alternaria solani","confidence":92,"severity":"Moderate",
            "symptoms":["Concentric dark rings on older leaves","Yellow halo around brown lesions","Premature lower-leaf defoliation"],
            "possibleCauses":["Leaf wetness and moderate temperatures","Infected crop debris","High humidity and splashing rain"],
            "prevention":["Crop rotation","Mulch to reduce soil splash","Prefer drip irrigation"],
            "recommendedNextSteps":["Remove infected leaves","Use only locally approved crop-protection products at label rates","Consult KVK if symptoms spread"],
            "expertAdvice":"Consult a local KVK plant-protection officer if symptoms reach stems or spread rapidly."
        }
    if "rice" in c or "paddy" in c:
        return {
            "diseaseName":"Rice Blast","scientificName":"Magnaporthe oryzae","confidence":89,"severity":"High",
            "symptoms":["Spindle-shaped lesions with pale centres","Lesions may merge and dry leaves","Neck infection can cause poorly filled panicles"],
            "possibleCauses":["Excess nitrogen","High humidity and dew","Dense planting"],
            "prevention":["Avoid excessive nitrogen","Maintain balanced potassium","Use locally recommended resistant varieties"],
            "recommendedNextSteps":["Improve field aeration and drainage where appropriate","Use only locally approved fungicides at label rates","Seek extension advice quickly if neck blast is suspected"],
            "expertAdvice":"Rice blast can spread quickly; contact your local agriculture extension service for field-specific control."
        }
    if "potato" in c:
        return {
            "diseaseName":"Late Blight of Potato","scientificName":"Phytophthora infestans","confidence":94,"severity":"High",
            "symptoms":["Water-soaked dark lesions","White growth may appear under leaves in humid conditions","Rapid foliage collapse in conducive weather"],
            "possibleCauses":["Cool humid weather","Infected seed tubers","Poor drainage"],
            "prevention":["Use certified seed","Good ridge/field drainage","Follow locally recommended preventive schedule"],
            "recommendedNextSteps":["Remove badly affected foliage where appropriate","Use only locally approved fungicides at label rates","Contact the agriculture office during an outbreak"],
            "expertAdvice":"Late blight can cause rapid losses; seek local extension guidance."
        }
    return {
        "diseaseName":"Stripe Rust / Yellow Rust of Wheat","scientificName":"Puccinia striiformis f. sp. tritici","confidence":91,"severity":"Moderate",
        "symptoms":["Yellow/orange pustules in stripes on leaves","Yellow powder may rub off","Premature leaf drying can occur"],
        "possibleCauses":["Cool temperatures with dew","Susceptible varieties","Spore movement from cooler regions"],
        "prevention":["Use locally recommended rust-resistant varieties","Follow recommended sowing windows","Scout field boundaries regularly"],
        "recommendedNextSteps":["Confirm diagnosis before spraying","Use only locally approved fungicides at label rates if confirmed","Contact KVK/extension service for outbreak guidance"],
        "expertAdvice":"Report suspected outbreaks to the local agriculture extension service."
    }

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/api/weather")
def live_weather():
    try:
        lat = float(request.args.get("lat",""))
        lon = float(request.args.get("lon",""))
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError()
    except Exception:
        return jsonify(error="Valid lat and lon are required"), 400
    key = f"{lat:.2f},{lon:.2f}"
    hit = _weather_cache.get(key)
    if hit and (datetime.now().timestamp() - hit["at"] < 600):
        return jsonify(hit["data"])
    try:
        params = {
            "latitude":lat,"longitude":lon,"current":"temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
            "daily":"weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,precipitation_sum",
            "timezone":"Asia/Kolkata","forecast_days":7
        }
        url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(params)
        with urllib.request.urlopen(url, timeout=15) as r:
            j = json.loads(r.read().decode())
        days=[]
        for i,d in enumerate(j["daily"]["time"]):
            dt=datetime.fromisoformat(d)
            days.append({
                "day":"Today" if i==0 else dt.strftime("%a"),
                "date":f"{dt.day} {dt.strftime('%b')}",
                "tempMax":round(j["daily"]["temperature_2m_max"][i]),
                "tempMin":round(j["daily"]["temperature_2m_min"][i]),
                "condition":WMO.get(j["daily"]["weather_code"][i],"Mixed"),
                "rainProbability":j["daily"]["precipitation_probability_max"][i] or 0,
                "rainMm":j["daily"]["precipitation_sum"][i] or 0
            })
        alerts=[]
        nxt=days[:3]
        if any(d["rainProbability"]>=60 for d in nxt):
            alerts.append({"severity":"high","title":"Rain expected","message":"High chance of rain in the next 3 days. Postpone spraying and fertilizer; check field drainage."})
        if any(d["tempMax"]>=42 for d in nxt):
            alerts.append({"severity":"high","title":"Heat wave","message":"Very high temperature expected. Irrigate in the evening or early morning and protect young plants."})
        if any(d["tempMin"]<=4 for d in nxt):
            alerts.append({"severity":"high","title":"Cold / frost risk","message":"Very low night temperature expected. Light irrigation in the evening can reduce frost damage."})
        data={"source":"open-meteo","fetchedAt":datetime.now().isoformat(),"alerts":alerts,
              "current":{"temp":round(j["current"]["temperature_2m"]),"feelsLike":round(j["current"]["apparent_temperature"]),
                         "condition":WMO.get(j["current"]["weather_code"],"Mixed"),"humidity":j["current"]["relative_humidity_2m"],
                         "windSpeed":round(j["current"]["wind_speed_10m"]),"rainProbability":days[0]["rainProbability"],
                         "uvIndex":round(j["daily"]["uv_index_max"][0] or 0),"rainNowMm":j["current"]["precipitation"] or 0},
              "forecast":days}
        _weather_cache[key]={"at":datetime.now().timestamp(),"data":data}
        return jsonify(data)
    except Exception as e:
        return jsonify(error="Live weather unavailable right now"), 502

@app.post("/api/chat")
def chat():
    body=request.get_json(silent=True) or {}
    message=body.get("message")
    if not isinstance(message,str) or not message.strip():
        return jsonify(error="Message text is required"),400
    history=body.get("history") if isinstance(body.get("history"),list) else []
    language=clean_language(body.get("language"))
    if GEMINI_API_KEY:
        system="""You are AI Krishi Sathi, a friendly agriculture assistant for Indian farmers.

LANGUAGE: __LANG_RULE__ Keep sentences short and simple.

ACCURACY RULES (very important):
- Only state facts you are confident about. If you are not sure, say "mujhe pakka nahi pata" and suggest KVK / Kisan Call Centre (1800-180-1551).
- NEVER invent mandi prices, scheme amounts/dates, pesticide brand names, or exact chemical doses. For prices, say they change daily and to check eNAM/Agmarknet. For chemicals, give only the generic name/type and say follow the label and local KVK advice.
- If the question is vague (crop, state, growth stage or symptoms missing), ask 1-2 short clarifying questions first instead of guessing.
- If the question is not about farming, politely say you help only with farming topics.
- Do not claim you can see the field or know today's weather.

DETAIL LEVEL: Give detailed, thorough, practical answers (roughly 250-500 words), not short replies. Explain the "why" behind each point, give step-by-step actions, mention timing/stage of the crop, and give simple examples a farmer can follow. Only a greeting or a very simple yes/no question may get a short reply.

FORMAT (use these headings, with **bold** and "- " bullet points, no tables):
### Summary / Direct Answer
### Possible Causes (most likely first, and how to tell them apart in the field)
### Basic Prevention
### Recommended Next Steps (numbered, in order: today, this week, next season)
### Common Mistakes to Avoid
### When to Contact an Agriculture Expert
For non-problem questions (schemes, sowing time, fertilizer plan, etc.) keep the same detailed style but use headings that fit the topic. End with one short follow-up question that would help you give more specific advice (crop variety, state, soil type, growth stage)."""

        if language:
            lang_rule=f"Write the whole reply in {language} (use the {language} script, except Hinglish which is Hindi written in English letters). Keep crop, scheme and chemical names understandable."
        else:
            lang_rule="Reply in the same language/script the farmer used (Hindi, English or Hinglish)."
        system=system.replace("__LANG_RULE__",lang_rule)
        # The frontend already includes the current message at the end of `history`;
        # drop it so the model does not see the same question twice.
        turns=[]
        for item in history:
            if isinstance(item,dict) and item.get("sender") in ("user","bot") and isinstance(item.get("text"),str) and item["text"].strip():
                turns.append(("user" if item["sender"]=="user" else "model", item["text"]))
        if turns and turns[-1][0]=="user" and turns[-1][1].strip()==message.strip():
            turns.pop()
        turns=turns[-8:]
        while turns and turns[0][0]!="user":   # Gemini needs the conversation to start with a user turn
            turns.pop(0)
        contents=[]
        for role,text in turns:
            if contents and contents[-1]["role"]==role:   # merge consecutive same-role turns
                contents[-1]["parts"][0]["text"]+="\n"+text
            else:
                contents.append({"role":role,"parts":[{"text":text}]})
        if contents and contents[-1]["role"]=="user":
            contents[-1]["parts"][0]["text"]+="\n"+message
        else:
            contents.append({"role":"user","parts":[{"text":message}]})
        try:
            reply=gemini_generate(contents,system)
            if reply:
                try: db.save_chat(client_id(), message, reply, "gemini-live")
                except Exception as dbe: print("DB save error:", repr(dbe), flush=True)
                return jsonify(reply=reply,source="gemini-live")
            return jsonify(error="Gemini returned an empty response"), 502
        except Exception as e:
            print("Gemini /api/chat error:", repr(e), flush=True)
            traceback.print_exc()
            status, msg = friendly_error(e)
            return jsonify(error=msg, detail=str(e)[:300]), status
    reply=fallback_chat(message)
    try: db.save_chat(client_id(), message, reply, "krishi-knowledgebase")
    except Exception as dbe: print("DB save error:", repr(dbe), flush=True)
    return jsonify(reply=reply,source="krishi-knowledgebase")

@app.post("/api/diagnose")
def diagnose():
    body=request.get_json(silent=True) or {}
    image=body.get("imageBase64")
    crop=body.get("cropName","Crop")
    mime=body.get("mimeType","image/jpeg")
    language=clean_language(body.get("language")) or "English"
    if not image:
        return jsonify(error="Image data is required"),400
    clean=image.split(",",1)[1] if "," in image else image
    if GEMINI_API_KEY:
        prompt=f"""You are KrishiSathi Crop Doctor, an AI plant pathologist.
Farmer says the crop is: {crop or 'Unknown'}.
Look carefully at the photo and describe ONLY what is actually visible. Do not guess.
- If the photo is not a plant/leaf, is too blurry/dark, or you cannot tell, set diseaseName to "Cannot determine from this photo", confidence to 0, severity to "Low", and use expertAdvice to ask for a clearer close-up of the affected leaf in daylight.
- If the plant looks healthy, set diseaseName to "No disease detected (looks healthy)".
- If the photo shows a different crop than the farmer said, mention that in expertAdvice.
- confidence is an honest integer 0-100 of how sure you are (use lower numbers when unsure; do not inflate).
- Never give pesticide doses or brand names; mention only generic types and tell the farmer to confirm with KVK / local agriculture officer.
Return JSON with exactly these keys: diseaseName, scientificName, confidence (integer), severity (Low/Moderate/High), symptoms (array of strings), possibleCauses (array of strings), prevention (array of strings), recommendedNextSteps (array of strings), expertAdvice (string).
Write ALL text values (diseaseName, symptoms, possibleCauses, prevention, recommendedNextSteps, expertAdvice) in simple {language}. The JSON keys must stay exactly as written in English. scientificName stays in Latin. severity stays one of the English words Low/Moderate/High.
Also add two more keys: severityLabel (the severity word translated into {language}) and labels (an object with the keys symptoms, possibleCauses, prevention, recommendedNextSteps, expertAdvice, confidence, severity whose values are those headings translated into {language})."""
        try:
            contents=[{"role":"user","parts":[{"inlineData":{"mimeType":mime,"data":clean}},{"text":prompt}]}]
            raw=gemini_generate(contents,None,"application/json")
            if raw:
                raw=raw.strip()
                if raw.startswith("```"):
                    raw=raw.strip("`").removeprefix("json").strip()
                data=json.loads(raw)
                if isinstance(data,list) and data:
                    data=data[0]
                try: db.save_diagnosis(client_id(), crop, data, "gemini-vision")
                except Exception as dbe: print("DB save error:", repr(dbe), flush=True)
                return jsonify(success=True,data=data,source="gemini-vision")
            return jsonify(error="Gemini returned an empty vision response"), 502
        except Exception as e:
            print("Gemini /api/diagnose error:", repr(e), flush=True)
            traceback.print_exc()
            status, msg = friendly_error(e)
            return jsonify(error=msg, detail=str(e)[:300]), status
    fb=fallback_diagnosis(crop)
    try: db.save_diagnosis(client_id(), crop, fb, "smart-diagnostic-database")
    except Exception as dbe: print("DB save error:", repr(dbe), flush=True)
    return jsonify(success=True,data=fb,source="smart-diagnostic-database",
                   warning="Gemini API key is not configured; showing fallback advisory. Verify with a local agriculture extension officer.")

# ---------------- data served from the database ----------------
@app.get("/data.js")
def data_js():
    """Reference data (crops, schemes, mandi, soil, ...) from SQLite as the same window.* globals the old static files defined."""
    js = "\n".join(f"window.{k} = {json.dumps(v, ensure_ascii=False)};" for k, v in db.frontend_data().items())
    resp = Response(js, mimetype="application/javascript")
    resp.headers["Cache-Control"] = "no-cache"
    return resp

# ---------------- farmer accounts ----------------
_failed = {}   # contact -> [timestamps]  (simple brute-force throttle)

def _throttled(contact):
    now = time.time()
    _failed[contact] = [t for t in _failed.get(contact, []) if now - t < 600]
    return len(_failed[contact]) >= 8

def _split_contact(contact):
    contact = (contact or "").strip()
    if "@" in contact:
        return None, contact.lower()
    digits = re.sub(r"[\s\-()]", "", contact)
    return (digits if re.fullmatch(r"\+?\d{10,13}", digits) else None), None

def _login_session(user):
    session.clear()
    session["uid"] = user["id"]
    session.permanent = True

@app.post("/api/auth/register")
def auth_register():
    b = request.get_json(silent=True) or {}
    name = str(b.get("name", "")).strip()[:80]
    password = str(b.get("password", ""))
    phone, email = _split_contact(b.get("contact"))
    if not name:
        return jsonify(error="Naam likhna zaroori hai."), 400
    if not phone and not email:
        return jsonify(error="Sahi 10-digit phone number ya email dalein."), 400
    if len(password) < 6:
        return jsonify(error="Password kam se kam 6 akshar ka hona chahiye."), 400
    user = db.create_user(name, phone, email, generate_password_hash(password),
                          str(b.get("state", "Uttar Pradesh"))[:60], str(b.get("district", ""))[:60])
    if not user:
        return jsonify(error="Is phone/email se account pehle se hai. Sign In karein."), 409
    db.migrate_client(anon_client_id(), f"u{user['id']}")
    _login_session(user)
    return jsonify(user=user)

@app.post("/api/auth/login")
def auth_login():
    b = request.get_json(silent=True) or {}
    contact = str(b.get("contact", "")).strip()
    phone, email = _split_contact(contact)
    key = phone or email or contact.lower()
    if _throttled(key):
        return jsonify(error="Bahut zyada galat koshish. 10 minute baad try karein."), 429
    user, pw_hash = db.find_user_for_login(phone or email or contact)
    if not user or not check_password_hash(pw_hash, str(b.get("password", ""))):
        _failed.setdefault(key, []).append(time.time())
        return jsonify(error="Phone/email ya password galat hai."), 401
    db.migrate_client(anon_client_id(), f"u{user['id']}")
    _login_session(user)
    return jsonify(user=user)

@app.post("/api/auth/logout")
def auth_logout():
    session.clear()
    return jsonify(ok=True)

@app.get("/api/auth/me")
def auth_me():
    uid = current_user_id()
    user = db.get_user(uid) if uid else None
    if uid and not user:
        session.clear()
    return jsonify(user=user)

@app.put("/api/auth/me")
def auth_update():
    uid = current_user_id()
    if not uid:
        return jsonify(error="Login zaroori hai."), 401
    b = request.get_json(silent=True) or {}
    fields = {}
    for k in ("name", "state", "district", "village"):
        if isinstance(b.get(k), str):
            fields[k] = b[k].strip()[:80]
    if isinstance(b.get("landSizeAcres"), (int, float)) and 0 <= b["landSizeAcres"] <= 100000:
        fields["landSizeAcres"] = b["landSizeAcres"]
    for k in ("savedCrops", "savedMandis", "userCrops"):
        if isinstance(b.get(k), list) and len(b[k]) <= 200:
            fields[k] = b[k]
    return jsonify(user=db.update_user(uid, fields))

@app.get("/api/history")
def api_history():
    return jsonify(messages=db.get_chat(client_id()))

@app.delete("/api/history")
def api_history_clear():
    db.clear_chat(client_id())
    return jsonify(ok=True)

@app.get("/api/diagnoses")
def api_diagnoses():
    return jsonify(items=db.get_diagnoses(client_id()))

@app.delete("/api/diagnoses")
def api_diagnoses_clear():
    db.delete_diagnoses(client_id())
    return jsonify(ok=True)

_search_hits = {}   # client -> [timestamps]  (protects your Gemini quota)

@app.post("/api/search-details")
def search_details():
    """Fetch details about whatever the farmer searched for (uses Google Search grounding when available)."""
    body = request.get_json(silent=True) or {}
    q = str(body.get("query", "")).strip()[:200]
    if len(q) < 2:
        return jsonify(error="Kuch likhein (kam se kam 2 akshar)."), 400
    if not GEMINI_API_KEY:
        return jsonify(error="Gemini API key set nahi hai, isliye details fetch nahi ho sakti."), 503
    cid = client_id(); now = time.time()
    _search_hits[cid] = [t for t in _search_hits.get(cid, []) if now - t < 3600]
    if len(_search_hits[cid]) >= 30:
        return jsonify(error="Ek ghante mein bahut zyada search. Thodi der baad try karein."), 429
    _search_hits[cid].append(now)
    language = clean_language(body.get("language"))
    lang_rule = f"Write the answer in {language}." if language else "Answer in the same language the farmer used."
    system = f"""You are the search assistant of KrishiSathi, an app for Indian farmers.
{lang_rule} Use simple words and short sentences.
Search the web and give DETAILED, practical information about the topic: what it is, the key facts (benefits / eligibility / how to apply for schemes; symptoms, causes and control for crop problems; best practice for crops), latest updates with dates when relevant, and the official website if it is a government matter.
Rules: do not invent numbers, dates or rules. If reliable information is not found, say so clearly. For pesticide/chemical advice give only generic names and tell the farmer to confirm with KVK or the agriculture office.
Format with short headings (### ) and "- " bullet points."""
    try:
        text, sources = grounded_generate(f"Farmer's search: {q}", system)
    except Exception as e:
        print("search-details error:", repr(e), flush=True)
        status, msg = friendly_error(e)
        return jsonify(error=msg, detail=str(e)[:300]), status
    if not text.strip():
        return jsonify(error="Gemini ne khaali jawab diya, dobara try karein."), 502
    return jsonify(reply=text, sources=sources, grounded=bool(sources))

@app.post("/api/schemes/refresh")
def schemes_refresh():
    """Manual trigger. Disabled unless ADMIN_TOKEN is set in .env; send it as header X-Admin-Token."""
    token = os.getenv("ADMIN_TOKEN", "")
    if not token or not secrets.compare_digest(request.headers.get("X-Admin-Token", ""), token):
        return jsonify(error="Not allowed."), 403
    if not GEMINI_API_KEY:
        return jsonify(error="Gemini API key missing."), 503
    threading.Thread(target=lambda: print("[schemes] manual refresh:", schemes_updater.refresh_all(grounded_generate), flush=True), daemon=True).start()
    return jsonify(started=True), 202

@app.get("/<path:path>")
def static_or_spa(path):
    # Keep SPA routing working for direct page loads.
    return render_template("index.html")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "refresh-schemes":      # python server.py refresh-schemes
        if not GEMINI_API_KEY:
            sys.exit("GEMINI_API_KEY is not set in .env")
        print("Updating schemes (takes a minute)...")
        print("Done:", schemes_updater.refresh_all(grounded_generate))
        sys.exit(0)
    if GEMINI_API_KEY and os.getenv("SCHEMES_AUTO_UPDATE", "1") != "0":
        days = float(os.getenv("SCHEMES_REFRESH_DAYS", "7"))
        schemes_updater.start_scheduler(grounded_generate, days=days)
        print(f"Schemes auto-update ON (every {days:g} days). Turn off with SCHEMES_AUTO_UPDATE=0", flush=True)
    port=int(os.getenv("PORT","5000"))
    app.run(host="0.0.0.0",port=port,debug=os.getenv("FLASK_DEBUG","0")=="1")
