"""Utilitários dos scripts que operam no banco em NUVEM (Neon).

A connection string é lida, nesta ordem, de:
  1. variável de ambiente DATABASE_URL_NUVEM
  2. arquivo backend/.env.producao (linha DATABASE_URL=...) — gitignored

`preparar_ambiente()` precisa ser chamado ANTES de importar qualquer módulo de `app`.
"""
import os
import re
import sys

from dotenv import dotenv_values

AQUI = os.path.dirname(os.path.abspath(__file__))


def url_nuvem() -> str:
    url = os.getenv("DATABASE_URL_NUVEM") or dotenv_values(os.path.join(AQUI, ".env.producao")).get("DATABASE_URL")
    if not url:
        sys.exit("Defina DATABASE_URL_NUVEM ou crie backend/.env.producao com DATABASE_URL=<connection string do Neon>.")
    if re.search(r"@(localhost|127\.0\.0\.1)[:/]", url, re.IGNORECASE):
        sys.exit("Esta connection string aponta para o banco LOCAL. Use a do Neon.")
    return url


def mascarar(url: str) -> str:
    return re.sub(r"://([^:]+):[^@]+@", r"://\1:****@", url)


def preparar_ambiente() -> str:
    """Aponta o app para o banco em nuvem (variáveis têm prioridade sobre o .env local)."""
    url = url_nuvem()
    os.environ["DATABASE_URL"] = url
    os.environ.setdefault("JWT_SECRET_KEY", "nao-usado-neste-script")
    if AQUI not in sys.path:
        sys.path.insert(0, AQUI)
    print(f"Banco: {mascarar(url)}")
    return url
