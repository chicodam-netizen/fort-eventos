"""Eventos, equipes do evento, alocações (com movimentação), materiais e custos."""
from collections import defaultdict
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_usuario, require_admin, require_escritorio
from app.database import get_db
from app.models import (
    Alocacao, CustoExtra, Equipe, EquipeModelo, Evento, Material, MaterialEvento, Prestador, Usuario,
)
from app.models.cadastros import FORMAS_CUSTO
from app.models.evento import CATEGORIAS_CUSTO, STATUS_EVENTO, TIPOS_EVENTO
from app.schemas import (
    AlocacaoIn, AlocacaoUpdate, CustoExtraIn, EquipeDeModeloIn, EquipeIn, EquipeOut, EventoIn, EventoOut,
    EventoStatusIn, MaterialEventoIn, MoverIn, ResumoCustosOut, RetirarIn,
)
from app.services.alocacoes import (
    alocacao_dict, carregar_evento, checar_conflito, eh_escritorio, eventos_do_lider, exigir_escritorio,
    exigir_ver_evento,
)
from app.services.custos import custo_material, custos_alocacoes, dias_material
from app.services.tempo import agora, sem_fuso

router = APIRouter(prefix="/api", tags=["Eventos"])

STATUS_ENCERRADOS = ("Concluído", "Cancelado")


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _alocacoes_evento(db: Session, evento_id: str) -> list[Alocacao]:
    return (
        db.query(Alocacao)
        .join(Alocacao.equipe)
        .options(
            joinedload(Alocacao.equipe).joinedload(Equipe.evento),
            joinedload(Alocacao.prestador).joinedload(Prestador.funcao),
            joinedload(Alocacao.funcao),
            joinedload(Alocacao.origem).joinedload(Alocacao.equipe).joinedload(Equipe.evento),
        )
        .filter(Equipe.evento_id == evento_id)
        .order_by(Alocacao.inicio)
        .all()
    )


def _custo_materiais(ev: Evento) -> float:
    return round(sum(custo_material(m) for m in ev.materiais), 2)


def _custo_extras(ev: Evento) -> float:
    return round(sum(float(c.valor or 0) for c in ev.custos_extras), 2)


def _evento_out(db: Session, ev: Evento, usuario: Usuario, alocs: Optional[list[Alocacao]] = None) -> dict:
    d = EventoOut.model_validate(ev).model_dump()
    d["responsavel_nome"] = ev.responsavel.nome if ev.responsavel else None
    alocs = alocs if alocs is not None else _alocacoes_evento(db, ev.id)
    ref = agora()
    d["qtd_equipes"] = len(ev.equipes)
    d["pessoas_agora"] = len({a.prestador_id for a in alocs if a.inicio <= ref < a.fim})
    d["pessoas_total"] = len({a.prestador_id for a in alocs})
    d["pode_editar"] = eh_escritorio(usuario)
    if eh_escritorio(usuario):
        custos = custos_alocacoes(db, alocs)
        d["custo_realizado"] = round(sum(custos.values()) + _custo_materiais(ev) + _custo_extras(ev), 2)
    else:
        for k in ("orcamento_pessoas", "orcamento_materiais", "orcamento_outros", "custo_realizado"):
            d[k] = 0
    return d


def _validar_evento(payload: EventoIn) -> None:
    if payload.status not in STATUS_EVENTO:
        raise HTTPException(status_code=400, detail="Status inválido.")
    if payload.tipo not in TIPOS_EVENTO:
        raise HTTPException(status_code=400, detail="Tipo de evento inválido.")
    if payload.fim <= payload.inicio:
        raise HTTPException(status_code=400, detail="O fim da operação precisa ser depois do início.")
    if payload.evento_inicio and payload.evento_fim and payload.evento_fim <= payload.evento_inicio:
        raise HTTPException(status_code=400, detail="O fim do evento precisa ser depois do início.")


def _normalizar(payload: EventoIn) -> dict:
    dados = payload.model_dump()
    for k in ("inicio", "fim", "evento_inicio", "evento_fim"):
        dados[k] = sem_fuso(dados[k])
    dados["numero_projeto"] = (dados.get("numero_projeto") or "").strip() or None
    return dados


def _commit(db: Session, msg: str) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=msg)


# ─── Eventos ─────────────────────────────────────────────────────────────────

@router.get("/eventos", response_model=List[EventoOut])
def listar_eventos(
    q: Optional[str] = None,
    status: Optional[List[str]] = Query(None),
    de: Optional[datetime] = None,
    ate: Optional[datetime] = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_usuario),
):
    query = db.query(Evento).options(
        joinedload(Evento.equipes), joinedload(Evento.responsavel),
        joinedload(Evento.materiais).joinedload(MaterialEvento.material), joinedload(Evento.custos_extras),
    )
    if not eh_escritorio(usuario):
        query = query.filter(Evento.id.in_(eventos_do_lider(db, usuario)))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(Evento.nome.ilike(like), Evento.cliente.ilike(like), Evento.cidade.ilike(like), Evento.numero_projeto.ilike(like)))
    if status:
        query = query.filter(Evento.status.in_(status))
    if de:
        query = query.filter(Evento.fim >= sem_fuso(de))
    if ate:
        query = query.filter(Evento.inicio <= sem_fuso(ate))
    eventos = query.order_by(Evento.inicio).all()
    return [_evento_out(db, ev, usuario) for ev in eventos]


@router.get("/eventos/{evento_id}", response_model=EventoOut)
def obter_evento(evento_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    exigir_ver_evento(db, usuario, evento_id)
    return _evento_out(db, carregar_evento(db, evento_id), usuario)


@router.post("/eventos", response_model=EventoOut, status_code=201)
def criar_evento(payload: EventoIn, db: Session = Depends(get_db), usuario: Usuario = Depends(require_escritorio)):
    _validar_evento(payload)
    ev = Evento(**_normalizar(payload))
    db.add(ev)
    _commit(db, "Já existe um evento com esse número de projeto.")
    db.refresh(ev)
    return _evento_out(db, ev, usuario)


@router.put("/eventos/{evento_id}", response_model=EventoOut)
def atualizar_evento(evento_id: str, payload: EventoIn, db: Session = Depends(get_db), usuario: Usuario = Depends(require_escritorio)):
    _validar_evento(payload)
    ev = carregar_evento(db, evento_id)
    for k, v in _normalizar(payload).items():
        setattr(ev, k, v)
    _commit(db, "Já existe um evento com esse número de projeto.")
    db.refresh(ev)
    return _evento_out(db, ev, usuario)


@router.patch("/eventos/{evento_id}/status", response_model=EventoOut)
def mudar_status(evento_id: str, payload: EventoStatusIn, db: Session = Depends(get_db), usuario: Usuario = Depends(require_escritorio)):
    if payload.status not in STATUS_EVENTO:
        raise HTTPException(status_code=400, detail="Status inválido.")
    ev = carregar_evento(db, evento_id)
    ev.status = payload.status
    db.commit()
    db.refresh(ev)
    return _evento_out(db, ev, usuario)


@router.delete("/eventos/{evento_id}", status_code=204)
def excluir_evento(evento_id: str, db: Session = Depends(get_db), _: Usuario = Depends(require_admin)):
    ev = carregar_evento(db, evento_id)
    if _alocacoes_evento(db, evento_id):
        raise HTTPException(status_code=400, detail="O evento tem alocações registradas. Use o status Cancelado em vez de excluir.")
    db.delete(ev)
    db.commit()


# ─── Equipes do evento ───────────────────────────────────────────────────────

def _equipes_out(db: Session, ev: Evento, usuario: Usuario) -> list[dict]:
    alocs = _alocacoes_evento(db, ev.id)
    mostrar = eh_escritorio(usuario)
    custos = custos_alocacoes(db, alocs) if mostrar else {}
    por_equipe: dict[str, list] = defaultdict(list)
    for a in alocs:
        por_equipe[a.equipe_id].append(alocacao_dict(a, custos.get(a.id, 0), mostrar))
    modelos = {m.id: m for m in db.query(EquipeModelo).options(joinedload(EquipeModelo.itens)).all()}
    resultado = []
    for e in ev.equipes:
        modelo = modelos.get(e.modelo_id) if e.modelo_id else None
        resultado.append({
            "id": e.id, "evento_id": e.evento_id, "nome": e.nome, "descricao": e.descricao, "cor": e.cor,
            "ordem": e.ordem, "lider_id": e.lider_id, "lider_nome": e.lider.nome if e.lider else None,
            "modelo_id": e.modelo_id,
            "composicao_modelo": [
                {"id": i.id, "funcao_id": i.funcao_id, "funcao_nome": i.funcao.nome if i.funcao else None, "quantidade": i.quantidade}
                for i in (modelo.itens if modelo else [])
            ],
            "alocacoes": por_equipe.get(e.id, []),
        })
    return resultado


@router.get("/eventos/{evento_id}/equipes", response_model=List[EquipeOut])
def listar_equipes(evento_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    exigir_ver_evento(db, usuario, evento_id)
    return _equipes_out(db, carregar_evento(db, evento_id), usuario)


@router.post("/eventos/{evento_id}/equipes", status_code=201)
def criar_equipe(evento_id: str, payload: EquipeIn, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    ev = carregar_evento(db, evento_id)
    ordem = payload.ordem if payload.ordem is not None else len(ev.equipes)
    e = Equipe(evento_id=ev.id, nome=payload.nome.strip(), descricao=payload.descricao, cor=payload.cor, lider_id=payload.lider_id, ordem=ordem)
    db.add(e)
    db.commit()
    return {"id": e.id}


@router.post("/eventos/{evento_id}/equipes/de-modelo", status_code=201)
def criar_equipe_de_modelo(evento_id: str, payload: EquipeDeModeloIn, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    ev = carregar_evento(db, evento_id)
    modelo = db.get(EquipeModelo, payload.modelo_id)
    if not modelo:
        raise HTTPException(status_code=404, detail="Equipe modelo não encontrada.")
    e = Equipe(
        evento_id=ev.id, nome=(payload.nome or modelo.nome).strip(), descricao=modelo.descricao,
        cor=modelo.cor, modelo_id=modelo.id, ordem=len(ev.equipes),
    )
    db.add(e)
    db.commit()
    return {"id": e.id}


@router.put("/equipes/{equipe_id}")
def atualizar_equipe(equipe_id: str, payload: EquipeIn, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    e = db.get(Equipe, equipe_id)
    if not e:
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")
    e.nome, e.descricao, e.cor, e.lider_id = payload.nome.strip(), payload.descricao, payload.cor, payload.lider_id
    if payload.ordem is not None:
        e.ordem = payload.ordem
    db.commit()
    return {"id": e.id}


@router.delete("/equipes/{equipe_id}", status_code=204)
def excluir_equipe(equipe_id: str, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    e = db.get(Equipe, equipe_id)
    if not e:
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")
    if e.alocacoes:
        raise HTTPException(status_code=400, detail="A equipe tem alocações. Mova ou exclua os prestadores antes.")
    db.delete(e)
    db.commit()


@router.get("/equipes-destino")
def equipes_destino(db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    """Equipes de eventos não encerrados, para onde um prestador pode ser movido."""
    query = (
        db.query(Equipe).join(Equipe.evento).options(joinedload(Equipe.evento))
        .filter(Evento.status.notin_(STATUS_ENCERRADOS))
    )
    if not eh_escritorio(usuario):
        query = query.filter(Equipe.evento_id.in_(eventos_do_lider(db, usuario)))
    return [
        {
            "id": e.id, "nome": e.nome, "evento_id": e.evento_id, "evento_nome": e.evento.nome,
            "evento_status": e.evento.status, "evento_inicio": e.evento.inicio, "evento_fim": e.evento.fim,
        }
        for e in query.order_by(Evento.inicio, Equipe.ordem).all()
    ]


# ─── Alocações ───────────────────────────────────────────────────────────────

def _carregar_equipe(db: Session, equipe_id: str) -> Equipe:
    e = db.query(Equipe).options(joinedload(Equipe.evento)).filter(Equipe.id == equipe_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Equipe não encontrada.")
    return e


def _carregar_alocacao(db: Session, alocacao_id: str) -> Alocacao:
    a = db.query(Alocacao).options(joinedload(Alocacao.equipe).joinedload(Equipe.evento)).filter(Alocacao.id == alocacao_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alocação não encontrada.")
    return a


@router.post("/equipes/{equipe_id}/alocacoes", status_code=201)
def alocar(equipe_id: str, payload: AlocacaoIn, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    equipe = _carregar_equipe(db, equipe_id)
    exigir_ver_evento(db, usuario, equipe.evento_id)
    p = db.get(Prestador, payload.prestador_id)
    if not p:
        raise HTTPException(status_code=404, detail="Prestador não encontrado.")
    if p.status != "Ativo":
        raise HTTPException(status_code=400, detail="Prestador inativo não pode ser alocado.")
    inicio, fim = sem_fuso(payload.inicio), sem_fuso(payload.fim)
    checar_conflito(db, p.id, inicio, fim, payload.forcar)

    forma = payload.forma_custo or p.forma_custo
    if forma not in FORMAS_CUSTO:
        raise HTTPException(status_code=400, detail="Forma de custo inválida.")
    # Líder não define valores: sempre usa o cadastro do prestador
    valor = payload.valor_custo if (payload.valor_custo is not None and eh_escritorio(usuario)) else float(p.valor_custo or 0)
    a = Alocacao(
        equipe_id=equipe.id, prestador_id=p.id, inicio=inicio, fim=fim,
        funcao_id=payload.funcao_id or p.funcao_id, forma_custo=forma if eh_escritorio(usuario) else p.forma_custo,
        valor_custo=valor, observacao=payload.observacao, criado_por_id=usuario.id,
    )
    db.add(a)
    db.commit()
    return {"id": a.id}


@router.put("/alocacoes/{alocacao_id}")
def editar_alocacao(alocacao_id: str, payload: AlocacaoUpdate, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    a = _carregar_alocacao(db, alocacao_id)
    exigir_ver_evento(db, usuario, a.equipe.evento_id)
    dados = payload.model_dump(exclude_unset=True)
    inicio = sem_fuso(dados.get("inicio")) or a.inicio
    fim = sem_fuso(dados.get("fim")) or a.fim
    checar_conflito(db, a.prestador_id, inicio, fim, payload.forcar, (a.id,))
    a.inicio, a.fim = inicio, fim
    if "funcao_id" in dados:
        a.funcao_id = dados["funcao_id"]
    if "observacao" in dados:
        a.observacao = dados["observacao"]
    if eh_escritorio(usuario):
        if dados.get("forma_custo"):
            if dados["forma_custo"] not in FORMAS_CUSTO:
                raise HTTPException(status_code=400, detail="Forma de custo inválida.")
            a.forma_custo = dados["forma_custo"]
        if dados.get("valor_custo") is not None:
            a.valor_custo = dados["valor_custo"]
    db.commit()
    return {"id": a.id}


@router.delete("/alocacoes/{alocacao_id}", status_code=204)
def excluir_alocacao(alocacao_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    """Apaga um lançamento feito por engano. Para tirar alguém da equipe, use /retirar (mantém histórico)."""
    a = _carregar_alocacao(db, alocacao_id)
    exigir_ver_evento(db, usuario, a.equipe.evento_id)
    if not eh_escritorio(usuario) and a.inicio <= agora():
        raise HTTPException(status_code=403, detail="Alocação já iniciada: use Retirar. Só o escritório pode excluir.")
    db.query(Alocacao).filter(Alocacao.origem_id == a.id).update({Alocacao.origem_id: None})
    db.delete(a)
    db.commit()


@router.post("/alocacoes/{alocacao_id}/mover")
def mover(alocacao_id: str, payload: MoverIn, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    """Move o prestador para outra equipe (do mesmo ou de outro evento) a partir de `momento`.

    * Se a alocação ainda não começou, ela é simplesmente transferida.
    * Se está em andamento, é encerrada em `momento` e uma nova é aberta na equipe destino.
    """
    a = _carregar_alocacao(db, alocacao_id)
    exigir_ver_evento(db, usuario, a.equipe.evento_id)
    destino = _carregar_equipe(db, payload.equipe_destino_id)
    exigir_ver_evento(db, usuario, destino.evento_id)
    if destino.id == a.equipe_id:
        raise HTTPException(status_code=400, detail="O prestador já está nessa equipe.")
    if destino.evento.status in STATUS_ENCERRADOS:
        raise HTTPException(status_code=400, detail=f"O evento destino está {destino.evento.status.lower()}.")

    momento = sem_fuso(payload.momento)
    mesmo_evento = destino.evento_id == a.equipe.evento_id
    fim_novo = sem_fuso(payload.fim) or (a.fim if mesmo_evento else destino.evento.fim)
    if momento >= a.fim:
        raise HTTPException(status_code=400, detail="Nesse momento a alocação já terminou. Crie uma nova alocação na equipe destino.")

    descricao_destino = destino.nome if mesmo_evento else f"{destino.nome} · {destino.evento.nome}"

    if momento <= a.inicio:
        # Ainda não começou: transfere a alocação inteira
        inicio_novo = a.inicio
        checar_conflito(db, a.prestador_id, inicio_novo, fim_novo, payload.forcar, (a.id,))
        a.equipe_id, a.fim = destino.id, fim_novo
        db.commit()
        return {"id": a.id, "transferida": True}

    checar_conflito(db, a.prestador_id, momento, fim_novo, payload.forcar, (a.id,))
    a.fim = momento
    a.motivo_encerramento = f"Movido para {descricao_destino}" + (f" — {payload.motivo}" if payload.motivo else "")
    nova = Alocacao(
        equipe_id=destino.id, prestador_id=a.prestador_id, inicio=momento, fim=fim_novo,
        funcao_id=a.funcao_id, forma_custo=a.forma_custo, valor_custo=a.valor_custo,
        origem_id=a.id, observacao=payload.motivo, criado_por_id=usuario.id,
    )
    db.add(nova)
    db.commit()
    return {"id": nova.id, "transferida": False}


@router.post("/alocacoes/{alocacao_id}/retirar")
def retirar(alocacao_id: str, payload: RetirarIn, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    """Encerra a alocação em `momento` (o prestador sai da equipe; o histórico fica)."""
    a = _carregar_alocacao(db, alocacao_id)
    exigir_ver_evento(db, usuario, a.equipe.evento_id)
    momento = sem_fuso(payload.momento)
    if momento <= a.inicio:
        raise HTTPException(status_code=400, detail="A alocação ainda não tinha começado nesse momento. Use Excluir para apagá-la.")
    if momento >= a.fim:
        raise HTTPException(status_code=400, detail="Nesse momento a alocação já tinha terminado.")
    a.fim = momento
    a.motivo_encerramento = "Retirado" + (f" — {payload.motivo}" if payload.motivo else "")
    db.commit()
    return {"id": a.id}


# ─── Materiais do evento ─────────────────────────────────────────────────────

def _material_evento_out(me: MaterialEvento) -> dict:
    m = me.material
    return {
        "id": me.id, "material_id": m.id, "codigo": m.codigo, "nome": m.nome, "categoria": m.categoria,
        "unidade": m.unidade, "tipo": m.tipo, "cobranca": m.cobranca, "quantidade": float(me.quantidade),
        "inicio": me.inicio, "fim": me.fim, "dias": dias_material(me), "custo_unitario": float(me.custo_unitario),
        "custo_total": custo_material(me), "observacao": me.observacao,
    }


@router.get("/eventos/{evento_id}/materiais")
def listar_materiais_evento(evento_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    exigir_ver_evento(db, usuario, evento_id)
    ev = carregar_evento(db, evento_id)
    itens = sorted(ev.materiais, key=lambda x: (x.material.categoria, x.material.nome))
    lista = [_material_evento_out(me) for me in itens]
    if not eh_escritorio(usuario):
        for d in lista:
            d["custo_unitario"] = d["custo_total"] = 0
    return lista


def _aplicar_material(me: MaterialEvento, payload: MaterialEventoIn, mat: Material) -> None:
    if payload.inicio and payload.fim and payload.fim < payload.inicio:
        raise HTTPException(status_code=400, detail="A data final precisa ser igual ou depois da inicial.")
    me.material_id, me.quantidade = mat.id, payload.quantidade
    me.inicio, me.fim, me.observacao = payload.inicio, payload.fim, payload.observacao
    me.custo_unitario = payload.custo_unitario if payload.custo_unitario is not None else mat.custo_unitario


@router.post("/eventos/{evento_id}/materiais", status_code=201)
def adicionar_material(evento_id: str, payload: MaterialEventoIn, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    carregar_evento(db, evento_id)
    mat = db.get(Material, payload.material_id)
    if not mat:
        raise HTTPException(status_code=404, detail="Material não encontrado.")
    me = MaterialEvento(evento_id=evento_id)
    _aplicar_material(me, payload, mat)
    db.add(me)
    db.commit()
    return {"id": me.id}


@router.put("/materiais-evento/{item_id}")
def editar_material_evento(item_id: str, payload: MaterialEventoIn, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    me = db.get(MaterialEvento, item_id)
    if not me:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    mat = db.get(Material, payload.material_id)
    if not mat:
        raise HTTPException(status_code=404, detail="Material não encontrado.")
    _aplicar_material(me, payload, mat)
    db.commit()
    return {"id": me.id}


@router.delete("/materiais-evento/{item_id}", status_code=204)
def remover_material_evento(item_id: str, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    me = db.get(MaterialEvento, item_id)
    if not me:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    db.delete(me)
    db.commit()


# ─── Custos extras ───────────────────────────────────────────────────────────

def _extra_out(c: CustoExtra) -> dict:
    return {
        "id": c.id, "categoria": c.categoria, "descricao": c.descricao, "data": c.data, "valor": float(c.valor),
        "prestador_id": c.prestador_id, "prestador_nome": c.prestador.nome if c.prestador else None,
    }


@router.get("/eventos/{evento_id}/custos-extras")
def listar_extras(evento_id: str, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    ev = carregar_evento(db, evento_id)
    return [_extra_out(c) for c in sorted(ev.custos_extras, key=lambda c: (c.data or datetime.min.date(), c.descricao))]


def _aplicar_extra(c: CustoExtra, payload: CustoExtraIn) -> None:
    if payload.categoria not in CATEGORIAS_CUSTO:
        raise HTTPException(status_code=400, detail="Categoria inválida.")
    c.categoria, c.descricao, c.data = payload.categoria, payload.descricao.strip(), payload.data
    c.valor, c.prestador_id = payload.valor, payload.prestador_id


@router.post("/eventos/{evento_id}/custos-extras", status_code=201)
def criar_extra(evento_id: str, payload: CustoExtraIn, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    carregar_evento(db, evento_id)
    c = CustoExtra(evento_id=evento_id)
    _aplicar_extra(c, payload)
    db.add(c)
    db.commit()
    return {"id": c.id}


@router.put("/custos-extras/{custo_id}")
def editar_extra(custo_id: str, payload: CustoExtraIn, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    c = db.get(CustoExtra, custo_id)
    if not c:
        raise HTTPException(status_code=404, detail="Custo não encontrado.")
    _aplicar_extra(c, payload)
    db.commit()
    return {"id": c.id}


@router.delete("/custos-extras/{custo_id}", status_code=204)
def excluir_extra(custo_id: str, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    c = db.get(CustoExtra, custo_id)
    if not c:
        raise HTTPException(status_code=404, detail="Custo não encontrado.")
    db.delete(c)
    db.commit()


# ─── Resumo de custos (previsto × realizado) ─────────────────────────────────

@router.get("/eventos/{evento_id}/custos", response_model=ResumoCustosOut)
def resumo_custos(evento_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    exigir_escritorio(usuario)
    ev = carregar_evento(db, evento_id)
    alocs = _alocacoes_evento(db, evento_id)
    custos = custos_alocacoes(db, alocs)

    por_equipe: dict[str, dict] = {e.id: {"equipe": e.nome, "valor": 0.0, "pessoas": set()} for e in ev.equipes}
    for a in alocs:
        g = por_equipe[a.equipe_id]
        g["valor"] += custos.get(a.id, 0)
        g["pessoas"].add(a.prestador_id)

    por_cat_mat: dict[str, float] = defaultdict(float)
    for me in ev.materiais:
        por_cat_mat[me.material.categoria] += custo_material(me)
    por_cat_extra: dict[str, float] = defaultdict(float)
    for c in ev.custos_extras:
        por_cat_extra[c.categoria] += float(c.valor or 0)

    pessoas = round(sum(custos.values()), 2)
    materiais = _custo_materiais(ev)
    outros = _custo_extras(ev)
    prev_p, prev_m, prev_o = float(ev.orcamento_pessoas), float(ev.orcamento_materiais), float(ev.orcamento_outros)
    return {
        "pessoas_previsto": prev_p, "pessoas_realizado": pessoas,
        "materiais_previsto": prev_m, "materiais_realizado": materiais,
        "outros_previsto": prev_o, "outros_realizado": outros,
        "total_previsto": round(prev_p + prev_m + prev_o, 2),
        "total_realizado": round(pessoas + materiais + outros, 2),
        "por_equipe": [
            {"equipe": g["equipe"], "valor": round(g["valor"], 2), "pessoas": len(g["pessoas"])} for g in por_equipe.values()
        ],
        "por_categoria_material": sorted(
            [{"categoria": k, "valor": round(v, 2)} for k, v in por_cat_mat.items()], key=lambda x: -x["valor"]
        ),
        "por_categoria_extra": sorted(
            [{"categoria": k, "valor": round(v, 2)} for k, v in por_cat_extra.items()], key=lambda x: -x["valor"]
        ),
    }
