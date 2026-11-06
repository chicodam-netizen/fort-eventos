"""Geocodificação de endereços via OpenStreetMap (Nominatim).

Política de uso do Nominatim: identificar a aplicação no User-Agent e no máximo
1 requisição por segundo. As chamadas acontecem só por ação do usuário (botão de
busca ou ao salvar um evento sem coordenadas), então o volume é baixo.
"""
import json
import time
import urllib.parse
import urllib.request
from typing import Optional

from app.config import settings

_ultima_chamada = 0.0


def nominatim(caminho: str, params: dict) -> list | dict:
    """Chama o Nominatim respeitando ~1 req/s. Lança exceção se o serviço falhar."""
    global _ultima_chamada
    espera = 1.05 - (time.monotonic() - _ultima_chamada)
    if espera > 0:
        time.sleep(espera)
    url = f"https://nominatim.openstreetmap.org/{caminho}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": settings.GEOCODER_USER_AGENT, "Accept-Language": "pt-BR"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode("utf-8"))
    finally:
        _ultima_chamada = time.monotonic()


def buscar(q: str, limite: int = 5) -> list[dict]:
    dados = nominatim("search", {"q": q, "format": "jsonv2", "addressdetails": 1, "limit": limite, "countrycodes": "br"})
    resultado = []
    for d in dados:
        end = d.get("address", {})
        uf = (end.get("ISO3166-2-lvl4") or "").replace("BR-", "") or None
        resultado.append({
            "descricao": d.get("display_name"),
            "latitude": float(d["lat"]), "longitude": float(d["lon"]),
            "cidade": end.get("city") or end.get("town") or end.get("village") or end.get("municipality"),
            "uf": uf,
        })
    return resultado


def localizar(endereco: Optional[str], cidade: Optional[str], uf: Optional[str]) -> Optional[tuple[float, float]]:
    """Coordenadas aproximadas a partir do endereço; se não achar, usa o centro da cidade.

    Nunca lança exceção: devolve None se nada for encontrado ou o serviço estiver fora.
    """
    tentativas = []
    completo = ", ".join(x.strip() for x in (endereco, cidade, uf) if x and x.strip())
    if completo:
        tentativas.append(completo)
    so_cidade = ", ".join(x.strip() for x in (cidade, uf) if x and x.strip())
    if cidade and so_cidade not in tentativas:
        tentativas.append(so_cidade)
    for q in tentativas:
        if len(q) < 3:
            continue
        try:
            r = buscar(q, limite=1)
        except Exception:
            return None
        if r:
            return r[0]["latitude"], r[0]["longitude"]
    return None
