from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import criar_token, get_current_usuario, hash_senha, require_admin, verificar_senha
from app.database import get_db
from app.models import LogAcesso, Prestador, Usuario
from app.models.usuario import PERFIS
from app.schemas import LoginRequest, TokenResponse, TrocarSenhaRequest, UsuarioCreate, UsuarioOut, UsuarioUpdate

router = APIRouter(prefix="/api", tags=["Autenticação e usuários"])


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == payload.email.strip().lower()).first()
    if not usuario or not usuario.ativo or not verificar_senha(payload.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos.")
    db.add(LogAcesso(usuario_id=usuario.id))
    db.commit()
    return TokenResponse(access_token=criar_token(usuario.id), usuario=usuario)


@router.get("/auth/me", response_model=UsuarioOut)
def me(usuario: Usuario = Depends(get_current_usuario)):
    return usuario


@router.patch("/auth/senha", status_code=204)
def trocar_senha(payload: TrocarSenhaRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(get_current_usuario)):
    if not verificar_senha(payload.senha_atual, usuario.senha_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta.")
    if len(payload.senha_nova) < 6:
        raise HTTPException(status_code=400, detail="A nova senha precisa ter pelo menos 6 caracteres.")
    usuario.senha_hash = hash_senha(payload.senha_nova)
    db.commit()


# ─── Usuários (Administrador) ────────────────────────────────────────────────

def _validar(db: Session, perfil: str | None, prestador_id: str | None) -> None:
    if perfil is not None and perfil not in PERFIS:
        raise HTTPException(status_code=400, detail=f"Perfil inválido. Use: {', '.join(PERFIS)}.")
    if perfil == "Líder" and not prestador_id:
        raise HTTPException(status_code=400, detail="Usuário Líder precisa estar vinculado a um prestador.")
    if prestador_id and not db.get(Prestador, prestador_id):
        raise HTTPException(status_code=400, detail="Prestador não encontrado.")


@router.get("/usuarios", response_model=List[UsuarioOut])
def listar_usuarios(db: Session = Depends(get_db), _: Usuario = Depends(require_admin)):
    return db.query(Usuario).order_by(Usuario.nome).all()


@router.post("/usuarios", response_model=UsuarioOut, status_code=201)
def criar_usuario(payload: UsuarioCreate, db: Session = Depends(get_db), _: Usuario = Depends(require_admin)):
    email = payload.email.strip().lower()
    if db.query(Usuario).filter(Usuario.email == email).first():
        raise HTTPException(status_code=400, detail="Já existe um usuário com esse e-mail.")
    _validar(db, payload.perfil, payload.prestador_id)
    u = Usuario(
        nome=payload.nome.strip(), email=email, senha_hash=hash_senha(payload.senha),
        perfil=payload.perfil, prestador_id=payload.prestador_id, ativo=payload.ativo,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.put("/usuarios/{usuario_id}", response_model=UsuarioOut)
def atualizar_usuario(usuario_id: str, payload: UsuarioUpdate, db: Session = Depends(get_db), admin: Usuario = Depends(require_admin)):
    u = db.get(Usuario, usuario_id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    dados = payload.model_dump(exclude_unset=True)
    senha = dados.pop("senha", None)
    if "email" in dados:
        dados["email"] = dados["email"].strip().lower()
        if db.query(Usuario).filter(Usuario.email == dados["email"], Usuario.id != usuario_id).first():
            raise HTTPException(status_code=400, detail="Já existe um usuário com esse e-mail.")
    _validar(db, dados.get("perfil", u.perfil), dados.get("prestador_id", u.prestador_id))
    if u.id == admin.id and (dados.get("ativo") is False or dados.get("perfil", "Administrador") != "Administrador"):
        raise HTTPException(status_code=400, detail="Você não pode desativar nem rebaixar o próprio usuário.")
    for k, v in dados.items():
        setattr(u, k, v)
    if senha:
        if len(senha) < 6:
            raise HTTPException(status_code=400, detail="A senha precisa ter pelo menos 6 caracteres.")
        u.senha_hash = hash_senha(senha)
    db.commit()
    db.refresh(u)
    return u
