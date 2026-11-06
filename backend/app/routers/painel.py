"""Painel inicial e geocodificação de endereços."""
import json
import urllib.parse
import urllib.request
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_usuario
from app.config import settings
from app.database import get_db
from app.models import Alocacao, Equipe, Evento, MaterialEvento, Usuario
from app.services.alocacoes import eh_escritorio, eventos_do_lider, resumo_equipes
from app.services.custos import custo_material, custos_alocacoes
from app.services.tempo import agora

router = APIRouter(prefix="/api", tags=["Painel"])

STATUS_ATIVOS = ("Montagem", "Em execução", "Desmontagem")


@router.get("/painel")
def painel(db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    ref = agora()
    escritorio = eh_escritorio(usuario)
    q = db.query(Evento).options(
        joinedload(Evento.equipes).joinedload(Equipe.lider),
        joinedload(Evento.materiais).joinedload(MaterialEvento.material), joinedload(Evento.custos_extras),
    )
    if not escritorio:
        q = q.filter(Evento.id.in_(eventos_do_lider(db, usuario)))
    eventos = q.order_by(Evento.inicio).all()
    ids = [e.id for e in eventos]

    alocs = (
        db.query(Alocacao).join(Alocacao.equipe)
        .options(joinedload(Alocacao.equipe))
        .filter(Equipe.evento_id.in_(ids))
        .all()
    ) if ids else []
    custos = custos_alocacoes(db, alocs) if escritorio else {}

    pessoas_agora: dict[str, set] = {}
    custo_pessoas: dict[str, float] = {}
    for a in alocs:
        ev_id = a.equipe.evento_id
        custo_pessoas[ev_id] = custo_pessoas.get(ev_id, 0) + custos.get(a.id, 0)
        if a.inicio <= ref < a.fim:
            pessoas_agora.setdefault(ev_id, set()).add(a.prestador_id)

    por_status: dict[str, int] = {}
    lista = []
    for e in eventos:
        por_status[e.status] = por_status.get(e.status, 0) + 1
        realizado = custo_pessoas.get(e.id, 0) + sum(custo_material(m) for m in e.materiais) + sum(float(c.valor) for c in e.custos_extras)
        previsto = float(e.orcamento_pessoas) + float(e.orcamento_materiais) + float(e.orcamento_outros)
        lista.append({
            "id": e.id, "nome": e.nome, "cliente": e.cliente, "status": e.status, "tipo": e.tipo,
            "inicio": e.inicio, "fim": e.fim, "cidade": e.cidade, "uf": e.uf,
            "latitude": e.latitude, "longitude": e.longitude,
            "pessoas_agora": len(pessoas_agora.get(e.id, set())),
            "equipes_resumo": resumo_equipes(e.equipes, [a for a in alocs if a.equipe.evento_id == e.id], ref),
            "custo_realizado": round(realizado, 2) if escritorio else 0,
            "custo_previsto": round(previsto, 2) if escritorio else 0,
        })

    em_andamento = [x for x in lista if x["status"] in STATUS_ATIVOS]
    proximos = [x for x in lista if x["status"] in ("Planejado", "Confirmado") and ref <= x["inicio"] <= ref + timedelta(days=30)]
    ativos_custo = [x for x in lista if x["status"] not in ("Cancelado",)]
    return {
        "agora": ref,
        "por_status": por_status,
        "em_andamento": em_andamento,
        "proximos": proximos,
        "pessoas_alocadas_agora": len({p for s in pessoas_agora.values() for p in s}),
        "custo_realizado_total": round(sum(x["custo_realizado"] for x in ativos_custo), 2) if escritorio else 0,
        "custo_previsto_total": round(sum(x["custo_previsto"] for x in ativos_custo), 2) if escritorio else 0,
        "eventos": lista,
    }


# ─── Geocodificação (OpenStreetMap / Nominatim) ──────────────────────────────
# Política de uso do Nominatim: identificar a aplicação no User-Agent e no máximo
# 1 requisição por segundo. A busca é disparada manualmente pelo usuário (botão),
# então o volume é baixo.

def _nominatim(caminho: str, params: dict) -> list | dict:
    url = f"https://nominatim.openstreetmap.org/{caminho}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": settings.GEOCODER_USER_AGENT, "Accept-Language": "pt-BR"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=502, detail="Serviço de mapas indisponível no momento. Marque o ponto no mapa manualmente.")


@router.get("/geo/buscar")
def geo_buscar(q: str = Query(..., min_length=3), _: Usuario = Depends(get_current_usuario)):
    dados = _nominatim("search", {"q": q, "format": "jsonv2", "addressdetails": 1, "limit": 5, "countrycodes": "br"})
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
