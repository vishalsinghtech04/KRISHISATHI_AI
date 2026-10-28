"""Vercel Python entrypoint for the KrishiSathi Flask app."""
import os

os.environ.setdefault("SCHEMES_AUTO_UPDATE", "0")
from server import app  # noqa: E402
