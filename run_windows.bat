@echo off
cd /d "%~dp0"
if not exist ".env" (
  echo .env file not found.
  echo Copy .env.example to .env and add your Gemini API key.
  pause
  exit /b 1
)
python -m pip install -r requirements.txt
python server.py
pause
