"""Ponto de entrada da API na Vercel (função Python).

A Vercel encaminha /api/* para esta função (ver vercel.json); o FastAPI vive em backend/app.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from app.main import app  # noqa: E402,F401
