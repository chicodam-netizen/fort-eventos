"""Apuração de custos de pessoas e materiais.

Pessoas
-------
* forma_custo = "hora":   horas alocadas × valor/hora.
* forma_custo = "diaria": o prestador recebe uma diária por dia de calendário em
  que trabalhou. Se no mesmo dia ele passou por mais de uma alocação (foi movido
  de equipe ou de evento), a diária daquele dia é rateada entre as alocações na
  proporção das horas de cada uma. Assim a movimentação não duplica diária e o
  custo fica no evento/equipe onde ele de fato trabalhou.

Materiais
---------
* cobranca = "unidade": quantidade × custo unitário.
* cobranca = "diaria":  quantidade × custo unitário × dias (inclusivo). Sem datas
  informadas, usa o período total do evento.
"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from typing import Iterable

from sqlalchemy.orm import Session

from app.models import Alocacao, MaterialEvento


def _horas(inicio: datetime, fim: datetime) -> float:
    return max((fim - inicio).total_seconds(), 0) / 3600


def _dias(inicio: datetime, fim: datetime) -> Iterable[date]:
    d = inicio.date()
    while datetime.combine(d, time.min) < fim:
        yield d
        d += timedelta(days=1)


def _horas_no_dia(a_inicio: datetime, a_fim: datetime, d: date) -> float:
    ini = max(a_inicio, datetime.combine(d, time.min))
    fim = min(a_fim, datetime.combine(d + timedelta(days=1), time.min))
    return _horas(ini, fim)


def custos_alocacoes(db: Session, alocacoes: list[Alocacao]) -> dict[str, float]:
    """Custo apurado de cada alocação (id → valor)."""
    if not alocacoes:
        return {}
    resultado: dict[str, float] = {}

    diarias = [a for a in alocacoes if a.forma_custo == "diaria"]
    for a in alocacoes:
        if a.forma_custo != "diaria":
            resultado[a.id] = round(_horas(a.inicio, a.fim) * float(a.valor_custo or 0), 2)

    if diarias:
        # Todas as alocações (de qualquer evento) dos prestadores envolvidos, no intervalo total,
        # para fazer o rateio diário corretamente.
        prestadores = {a.prestador_id for a in diarias}
        ini = min(a.inicio for a in diarias)
        fim = max(a.fim for a in diarias)
        todas = (
            db.query(Alocacao)
            .filter(
                Alocacao.prestador_id.in_(prestadores),
                Alocacao.inicio < fim,
                Alocacao.fim > ini,
            )
            .all()
        )
        horas_dia: dict[tuple[str, date], float] = defaultdict(float)
        for t in todas:
            for d in _dias(t.inicio, t.fim):
                horas_dia[(t.prestador_id, d)] += _horas_no_dia(t.inicio, t.fim, d)

        for a in diarias:
            fracao = 0.0
            for d in _dias(a.inicio, a.fim):
                h = _horas_no_dia(a.inicio, a.fim, d)
                total = horas_dia.get((a.prestador_id, d), 0)
                if h > 0 and total > 0:
                    fracao += h / total
            resultado[a.id] = round(fracao * float(a.valor_custo or 0), 2)

    return resultado


def dias_material(me: MaterialEvento) -> int:
    if me.material and me.material.cobranca != "diaria":
        return 0
    ini = me.inicio or me.evento.inicio.date()
    fim = me.fim or me.evento.fim.date()
    return max((fim - ini).days + 1, 1)


def custo_material(me: MaterialEvento) -> float:
    base = float(me.quantidade or 0) * float(me.custo_unitario or 0)
    if me.material and me.material.cobranca == "diaria":
        base *= dias_material(me)
    return round(base, 2)
