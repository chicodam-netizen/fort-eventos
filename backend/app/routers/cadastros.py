"""Cadastros: funções, prestadores, materiais e equipes modelo."""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_usuario, require_escritorio
from app.database import get_db
from app.models import Alocacao, Equipe, EquipeModelo, EquipeModeloItem, Funcao, Material, Prestador, Usuario
from app.models.cadastros import CATEGORIAS_MATERIAL, COBRANCAS_MATERIAL, FORMAS_CUSTO, TIPOS_MATERIAL, TIPOS_VINCULO
from app.schemas import (
    EquipeModeloIn, EquipeModeloOut, FuncaoIn, FuncaoOut, MaterialIn, MaterialOut, PrestadorIn, PrestadorOut,
)
from app.services.alocacoes import alocacao_dict, eh_escritorio, eventos_do_lider
from app.services.custos import custos_alocacoes
from app.services.tempo import agora, sem_fuso

router = APIRouter(prefix="/api", tags=["Cadastros"])


def _commit(db: Session, msg_duplicado: str) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=msg_duplicado)


@router.get("/opcoes")
def opcoes(_: Usuario = Depends(get_current_usuario)):
    """Listas fixas usadas nos formulários."""
    from app.models.evento import CATEGORIAS_CUSTO, STATUS_EVENTO, TIPOS_EVENTO
    return {
        "tipos_vinculo": TIPOS_VINCULO,
        "formas_custo": FORMAS_CUSTO,
        "categorias_material": CATEGORIAS_MATERIAL,
        "tipos_material": TIPOS_MATERIAL,
        "cobrancas_material": COBRANCAS_MATERIAL,
        "status_evento": STATUS_EVENTO,
        "tipos_evento": TIPOS_EVENTO,
        "categorias_custo": CATEGORIAS_CUSTO,
    }


# ─── Funções ─────────────────────────────────────────────────────────────────

@router.get("/funcoes", response_model=List[FuncaoOut])
def listar_funcoes(db: Session = Depends(get_db), _: Usuario = Depends(get_current_usuario)):
    return db.query(Funcao).order_by(Funcao.nome).all()


@router.post("/funcoes", response_model=FuncaoOut, status_code=201)
def criar_funcao(payload: FuncaoIn, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    f = Funcao(nome=payload.nome.strip(), valor_diaria_ref=payload.valor_diaria_ref)
    db.add(f)
    _commit(db, "Já existe uma função com esse nome.")
    db.refresh(f)
    return f


@router.put("/funcoes/{funcao_id}", response_model=FuncaoOut)
def atualizar_funcao(funcao_id: str, payload: FuncaoIn, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    f = db.get(Funcao, funcao_id)
    if not f:
        raise HTTPException(status_code=404, detail="Função não encontrada.")
    f.nome, f.valor_diaria_ref = payload.nome.strip(), payload.valor_diaria_ref
    _commit(db, "Já existe uma função com esse nome.")
    db.refresh(f)
    return f


@router.delete("/funcoes/{funcao_id}", status_code=204)
def excluir_funcao(funcao_id: str, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    f = db.get(Funcao, funcao_id)
    if not f:
        raise HTTPException(status_code=404, detail="Função não encontrada.")
    em_uso = (
        db.query(Prestador).filter(Prestador.funcao_id == funcao_id).count()
        + db.query(EquipeModeloItem).filter(EquipeModeloItem.funcao_id == funcao_id).count()
        + db.query(Alocacao).filter(Alocacao.funcao_id == funcao_id).count()
    )
    if em_uso:
        raise HTTPException(status_code=400, detail="Função em uso por prestadores, equipes modelo ou alocações.")
    db.delete(f)
    db.commit()


# ─── Prestadores ─────────────────────────────────────────────────────────────

def _prestador_out(p: Prestador, onde: Optional[str] = None, mostrar_valores: bool = True) -> dict:
    d = PrestadorOut.model_validate(p).model_dump()
    d["funcao_nome"] = p.funcao.nome if p.funcao else None
    d["alocado_agora"] = onde
    if not mostrar_valores:
        d["valor_custo"] = 0
    return d


def _validar_prestador(payload: PrestadorIn) -> None:
    if payload.tipo_vinculo not in TIPOS_VINCULO:
        raise HTTPException(status_code=400, detail="Tipo de vínculo inválido.")
    if payload.forma_custo not in FORMAS_CUSTO:
        raise HTTPException(status_code=400, detail="Forma de custo inválida.")


@router.get("/prestadores", response_model=List[PrestadorOut])
def listar_prestadores(
    q: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_usuario),
):
    query = db.query(Prestador).options(joinedload(Prestador.funcao))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(Prestador.nome.ilike(like), Prestador.empresa.ilike(like), Prestador.documento.ilike(like)))
    if status:
        query = query.filter(Prestador.status == status)
    prestadores = query.order_by(Prestador.nome).all()

    # Onde cada prestador está neste momento
    ref = agora()
    ativas = (
        db.query(Alocacao)
        .options(joinedload(Alocacao.equipe).joinedload(Equipe.evento))
        .filter(Alocacao.inicio <= ref, Alocacao.fim > ref)
        .all()
    )
    onde = {a.prestador_id: f"{a.equipe.evento.nome} · {a.equipe.nome}" for a in ativas}
    mostrar = eh_escritorio(usuario)
    return [_prestador_out(p, onde.get(p.id), mostrar) for p in prestadores]


@router.post("/prestadores", response_model=PrestadorOut, status_code=201)
def criar_prestador(payload: PrestadorIn, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    _validar_prestador(payload)
    p = Prestador(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _prestador_out(p)


@router.put("/prestadores/{prestador_id}", response_model=PrestadorOut)
def atualizar_prestador(prestador_id: str, payload: PrestadorIn, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    _validar_prestador(payload)
    p = db.get(Prestador, prestador_id)
    if not p:
        raise HTTPException(status_code=404, detail="Prestador não encontrado.")
    for k, v in payload.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _prestador_out(p)


@router.get("/prestadores/{prestador_id}/alocacoes")
def historico_prestador(prestador_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    """Histórico completo de alocações do prestador (todas as equipes e eventos)."""
    query = (
        db.query(Alocacao)
        .options(joinedload(Alocacao.equipe).joinedload(Equipe.evento))
        .filter(Alocacao.prestador_id == prestador_id)
    )
    if not eh_escritorio(usuario):
        query = query.join(Alocacao.equipe).filter(Equipe.evento_id.in_(eventos_do_lider(db, usuario)))
    lista = query.order_by(Alocacao.inicio.desc()).all()
    mostrar = eh_escritorio(usuario)
    custos = custos_alocacoes(db, lista) if mostrar else {}
    return [alocacao_dict(a, custos.get(a.id, 0), mostrar) for a in lista]


@router.get("/prestadores-disponibilidade")
def disponibilidade(
    inicio: datetime = Query(...),
    fim: datetime = Query(...),
    excluir_alocacao: Optional[str] = None,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_usuario),
):
    """Para cada prestador ativo com alocação sobreposta ao período, lista os conflitos."""
    inicio, fim = sem_fuso(inicio), sem_fuso(fim)
    ids = [r[0] for r in db.query(Prestador.id).filter(Prestador.status == "Ativo").all()]
    excl = (excluir_alocacao,) if excluir_alocacao else ()
    sobrepostas = (
        db.query(Alocacao)
        .options(joinedload(Alocacao.equipe).joinedload(Equipe.evento))
        .filter(Alocacao.prestador_id.in_(ids), Alocacao.inicio < fim, Alocacao.fim > inicio)
    )
    if excl:
        sobrepostas = sobrepostas.filter(Alocacao.id.notin_(excl))
    resultado: dict[str, list] = {}
    for a in sobrepostas.all():
        resultado.setdefault(a.prestador_id, []).append(
            {"evento_nome": a.equipe.evento.nome, "equipe_nome": a.equipe.nome, "inicio": a.inicio, "fim": a.fim}
        )
    return resultado


# ─── Materiais ───────────────────────────────────────────────────────────────

def _validar_material(payload: MaterialIn) -> None:
    if payload.categoria not in CATEGORIAS_MATERIAL:
        raise HTTPException(status_code=400, detail="Categoria inválida.")
    if payload.tipo not in TIPOS_MATERIAL:
        raise HTTPException(status_code=400, detail="Tipo de material inválido.")
    if payload.cobranca not in COBRANCAS_MATERIAL:
        raise HTTPException(status_code=400, detail="Forma de cobrança inválida.")


@router.get("/materiais", response_model=List[MaterialOut])
def listar_materiais(
    q: Optional[str] = None,
    categoria: Optional[str] = None,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_usuario),
):
    query = db.query(Material)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(Material.nome.ilike(like), Material.codigo.ilike(like)))
    if categoria:
        query = query.filter(Material.categoria == categoria)
    return query.order_by(Material.categoria, Material.nome).all()


@router.post("/materiais", response_model=MaterialOut, status_code=201)
def criar_material(payload: MaterialIn, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    _validar_material(payload)
    m = Material(**{**payload.model_dump(), "codigo": payload.codigo.strip().upper()})
    db.add(m)
    _commit(db, "Já existe um material com esse código.")
    db.refresh(m)
    return m


@router.put("/materiais/{material_id}", response_model=MaterialOut)
def atualizar_material(material_id: str, payload: MaterialIn, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    _validar_material(payload)
    m = db.get(Material, material_id)
    if not m:
        raise HTTPException(status_code=404, detail="Material não encontrado.")
    for k, v in payload.model_dump().items():
        setattr(m, k, v)
    m.codigo = payload.codigo.strip().upper()
    _commit(db, "Já existe um material com esse código.")
    db.refresh(m)
    return m


# ─── Equipes modelo ──────────────────────────────────────────────────────────

def _modelo_out(m: EquipeModelo) -> dict:
    return {
        "id": m.id, "nome": m.nome, "descricao": m.descricao, "cor": m.cor,
        "itens": [
            {"id": i.id, "funcao_id": i.funcao_id, "funcao_nome": i.funcao.nome if i.funcao else None, "quantidade": i.quantidade}
            for i in m.itens
        ],
    }


@router.get("/equipes-modelo", response_model=List[EquipeModeloOut])
def listar_modelos(db: Session = Depends(get_db), _: Usuario = Depends(get_current_usuario)):
    modelos = db.query(EquipeModelo).options(joinedload(EquipeModelo.itens).joinedload(EquipeModeloItem.funcao)).order_by(EquipeModelo.nome).all()
    return [_modelo_out(m) for m in modelos]


def _aplicar_itens(m: EquipeModelo, payload: EquipeModeloIn) -> None:
    m.nome, m.descricao, m.cor = payload.nome.strip(), payload.descricao, payload.cor
    m.itens.clear()
    for it in payload.itens:
        m.itens.append(EquipeModeloItem(funcao_id=it.funcao_id, quantidade=it.quantidade))


@router.post("/equipes-modelo", response_model=EquipeModeloOut, status_code=201)
def criar_modelo(payload: EquipeModeloIn, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    m = EquipeModelo()
    _aplicar_itens(m, payload)
    db.add(m)
    _commit(db, "Já existe uma equipe modelo com esse nome.")
    db.refresh(m)
    return _modelo_out(m)


@router.put("/equipes-modelo/{modelo_id}", response_model=EquipeModeloOut)
def atualizar_modelo(modelo_id: str, payload: EquipeModeloIn, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    m = db.get(EquipeModelo, modelo_id)
    if not m:
        raise HTTPException(status_code=404, detail="Equipe modelo não encontrada.")
    _aplicar_itens(m, payload)
    _commit(db, "Já existe uma equipe modelo com esse nome.")
    db.refresh(m)
    return _modelo_out(m)


@router.delete("/equipes-modelo/{modelo_id}", status_code=204)
def excluir_modelo(modelo_id: str, db: Session = Depends(get_db), _: Usuario = Depends(require_escritorio)):
    m = db.get(EquipeModelo, modelo_id)
    if not m:
        raise HTTPException(status_code=404, detail="Equipe modelo não encontrada.")
    db.delete(m)  # equipes de eventos criadas a partir dele ficam (modelo_id vira NULL)
    db.commit()

