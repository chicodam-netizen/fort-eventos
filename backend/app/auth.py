from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.usuario import Usuario

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def hash_senha(senha: str) -> str:
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_senha(senha: str, senha_hash: str) -> bool:
    return bcrypt.checkpw(senha.encode("utf-8"), senha_hash.encode("utf-8"))


def criar_token(usuario_id: str) -> str:
    expira_em = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS)
    payload = {"sub": usuario_id, "exp": expira_em}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _erro_credenciais() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessão inválida ou expirada. Faça login novamente.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_usuario(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    if not token:
        raise _erro_credenciais()
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        usuario_id = payload.get("sub")
        if not usuario_id:
            raise _erro_credenciais()
    except JWTError:
        raise _erro_credenciais()

    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario or not usuario.ativo:
        raise _erro_credenciais()
    return usuario


def require_perfis(*perfis: str):
    """Libera o endpoint apenas para os perfis informados."""
    def _checker(usuario: Usuario = Depends(get_current_usuario)) -> Usuario:
        if usuario.perfil not in perfis:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Esta ação requer um dos perfis: {', '.join(perfis)}.",
            )
        return usuario
    return _checker


require_admin = require_perfis("Administrador")
# Escritório e Administrador: operação completa (cadastros, eventos, custos)
require_escritorio = require_perfis("Administrador", "Escritório")
