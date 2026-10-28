# KrishiSathi - Python + HTML/CSS/JavaScript + Gemini

This package keeps the converted KrishiSathi workflow and adds a robust Gemini integration.

## Windows quick start

1. Copy `.env.example` to `.env`.
2. Open `.env` and set `GEMINI_API_KEY=YOUR_KEY`.
3. Keep the key only in `.env`; do not put it in `static/app.js` or commit it.
4. Run `run_windows.bat`, or run:

```powershell
python -m pip install -r requirements.txt
python server.py
```

5. Open http://127.0.0.1:5000

## Gemini behavior

- Uses the official `google-genai` Python SDK.
- Does not force a temperature for Gemini 3.x chat requests.
- Retries temporary 503/429 failures with backoff.
- Tries `GEMINI_FALLBACK_MODEL` if the primary model remains temporarily unavailable.
- Crop Doctor continues to use Gemini vision when the key is configured.

## Security

Never publish `.env` or put your API key in browser JavaScript. If an API key is accidentally shared, revoke/rotate it in Google AI Studio and use the new key locally.

## Database

SQLite file `krishisathi.db` is created automatically on first run (no install needed).
Tables: `chat_messages` (AI chat history) and `diagnoses` (Crop Doctor history).
Each browser gets an anonymous id (stored in localStorage), so history stays after refresh.
API: `GET/DELETE /api/history`, `GET/DELETE /api/diagnoses`.
To inspect it, open the file with "DB Browser for SQLite". Delete the file to reset everything.

## Accounts and database-backed data (v3)

- Reference data (crops, schemes, mandi prices, soil, tips, calendar, weather, ...) now lives in SQLite
  tables (`crops`, `schemes`, `mandi_prices`, `reference_data`). First run seeds them from `seed_data.json`.
  The browser loads them from `/data.js`, which the server builds from the database.
  To change data: edit rows in the DB (e.g. with DB Browser for SQLite) and refresh the page.
- Farmer accounts: `/api/auth/register`, `/login`, `/logout`, `/me` (GET/PUT). Passwords are stored hashed
  (werkzeug), login uses a signed session cookie. A signing key is generated into `.secret_key` (or set SECRET_KEY in .env).
- Chat/diagnosis history is stored per user; history made before login is moved to the account on login/sign-up.
- "Quick Demo Login" is a local demo only (nothing is saved to the database).

## Live weather + languages (v4)

- Weather page now loads live data from Open-Meteo through `/api/weather` (16 districts built in, or "Use my location").
  If live data fails it falls back to the old sample data and says so. Rain / heat / frost alerts are generated from the forecast.
- AI chat and Crop Doctor can answer in: Hindi, English, Hinglish, Marathi, Gujarati, Punjabi, Bengali, Tamil, Telugu,
  Kannada, Malayalam, Odia, Urdu (pick from the dropdown; the EN/हिं button also sets Hindi/English).
- Mandi prices are still DEMO data (the page says so). Live prices need an official source (Agmarknet / data.gov.in API key).

## Smarter search + auto-updating schemes (v5)

- Search: you can type full words/sentences; results match ALL words (e.g. "wheat yellow leaves").
  Press Enter or the green button to fetch full details with Gemini + Google Search (shows sources).
  If nothing matches inside the app, details are fetched automatically.
- Government schemes update by themselves: while `python server.py` runs, every `SCHEMES_REFRESH_DAYS` (default 7)
  it asks Gemini (with Google Search) for the current details of each scheme and stores them in the database.
  Only answers with web sources and a valid https .gov.in/.nic.in website are accepted; anything else is ignored.
  New schemes found online are added with a "Auto-found - verify" tag. Each run is logged in table `scheme_updates`.
- Update right now: `python server.py refresh-schemes`.  Turn off: `SCHEMES_AUTO_UPDATE=0` in .env.
- Always verify scheme details on the official website before applying - AI can make mistakes.


## Deploy to Vercel

- Import this project folder/repository into Vercel.
- In Project Settings → Environment Variables, add `GEMINI_API_KEY` with your real Gemini API key. Never commit `.env`.
- Add `SECRET_KEY` as a long random value so login sessions remain stable across function instances.
- Redeploy after adding/changing environment variables.
- Vercel deployment uses `/tmp/krishisathi.db` because the source directory is read-only. `/tmp` is temporary and may be reset; SQLite users/chat/diagnosis changes are NOT durable across instances or redeploys. Use a hosted database before relying on persistent accounts/history.
- Scheme auto-update is disabled in the Vercel entrypoint because serverless functions are not suitable for persistent background schedulers.
