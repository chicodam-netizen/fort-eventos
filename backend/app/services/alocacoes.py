from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models import Alocacao, Equipe, Evento, Usuario
from app.services.tempo import agora


# ─── Permissões ──────────────────────────────────────────────────────────────

def eh_escritorio(usuario: Usuario) -> bool:
    return usuario.perfil in ("Administrador", "Escritório")


def eventos_do_lider(db: Session, usuario: Usuario) -> set[str]:
    """IDs dos eventos em que o usuário (perfil Líder) lidera ao menos uma equipe."""
    if not usuario.prestador_id:
        return set()
    rows = db.query(Equipe.evento_id).filter(Equipe.lider_id == usuario.prestador_id).distinct().all()
    return {r[0] for r in rows}


def pode_ver_evento(db: Session, usuario: Usuario, evento_id: str) -> bool:
    return eh_escritorio(usuario) or evento_id in eventos_do_lider(db, usuario)


def exigir_ver_evento(db: Session, usuario: Usuario, evento_id: str) -> None:
    if not pode_ver_evento(db, usuario, evento_id):
        raise HTTPException(status_code=403, detail="Você não tem acesso a este evento.")


def exigir_escritorio(usuario: Usuario) -> None:
    if not eh_escritorio(usuario):
        raise HTTPException(status_code=403, detail="Esta ação é restrita ao escritório.")


# ─── Conflitos ───────────────────────────────────────────────────────────────

def conflitos(
    db: Session,
    prestador_id: str,
    inicio: datetime,
    fim: datetime,
    excluir_ids: tuple[str, ...] = (),
) -> list[Alocacao]:
    q = (
        db.query(Alocacao)
        .options(joinedload(Alocacao.equipe).joinedload(Equipe.evento))
        .filter(
            Alocacao.prestador_id == prestador_id,
            Alocacao.inicio < fim,
            Alocacao.fim > inicio,
        )
    )
    if excluir_ids:
        q = q.filter(Alocacao.id.notin_(excluir_ids))
    return q.order_by(Alocacao.inicio).all()


def conflito_dict(a: Alocacao) -> dict:
    return {
        "alocacao_id": a.id,
        "evento_nome": a.equipe.evento.nome,
        "equipe_nome": a.equipe.nome,
        "inicio": a.inicio.isoformat(),
        "fim": a.fim.isoformat(),
    }


def checar_conflito(
    db: Session,
    prestador_id: str,
    inicio: datetime,
    fim: datetime,
    forcar: bool,
    excluir_ids: tuple[str, ...] = (),
) -> None:
    """Levanta 409 se o prestador já estiver alocado no período (a menos que forcar=True)."""
    if fim <= inicio:
        raise HTTPException(status_code=400, detail="O fim precisa ser depois do início.")
    if forcar:
        return
    lista = conflitos(db, prestador_id, inicio, fim, excluir_ids)
    if lista:
        raise HTTPException(
            status_code=409,
            detail={
                "mensagem": "O prestador já está alocado em outra equipe nesse período.",
                "conflitos": [conflito_dict(c) for c in lista],
            },
        )


# ─── Serialização ────────────────────────────────────────────────────────────

def situacao(a: Alocacao, ref: datetime | None = None) -> str:
    ref = ref or agora()
    if a.inicio > ref:
        return "futura"
    if a.fim <= ref:
        return "encerrada"
    return "ativa"


def alocacao_dict(a: Alocacao, custo: float = 0, mostrar_valores: bool = True) -> dict:
    origem_desc = None
    if a.origem is not None:
        oe = a.origem.equipe
        origem_desc = f"{oe.nome} · {oe.evento.nome}" if oe.evento_id != a.equipe.evento_id else oe.nome
    return {
        "id": a.id,
        "equipe_id": a.equipe_id,
        "equipe_nome": a.equipe.nome,
        "evento_id": a.equipe.evento_id,
        "evento_nome": a.equipe.evento.nome,
        "prestador_id": a.prestador_id,
        "prestador_nome": a.prestador.nome,
        "prestador_vinculo": a.prestador.tipo_vinculo,
        "funcao_id": a.funcao_id,
        "funcao_nome": a.funcao.nome if a.funcao else (a.prestador.funcao.nome if a.prestador.funcao else None),
        "inicio": a.inicio,
        "fim": a.fim,
        "forma_custo": a.forma_custo,
        "valor_custo": float(a.valor_custo or 0) if mostrar_valores else 0,
        "origem_id": a.origem_id,
        "origem_descricao": origem_desc,
        "motivo_encerramento": a.motivo_encerramento,
        "observacao": a.observacao,
        "situacao": situacao(a),
        "custo": custo if mostrar_valores else 0,
    }


def carregar_evento(db: Session, evento_id: str) -> Evento:
    ev = db.query(Evento).filter(Evento.id == evento_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    return ev
