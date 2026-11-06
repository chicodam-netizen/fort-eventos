import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

# Perfis:
#   Administrador — tudo, inclusive usuários
#   Escritório    — opera eventos, cadastros e custos
#   Líder         — vê os eventos em que lidera uma equipe e movimenta prestadores neles
PERFIS = ("Administrador", "Escritório", "Líder")


def _uuid() -> str:
    return str(uuid.uuid4())


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(String(36), primary_key=True, default=_uuid)
    nome = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    senha_hash = Column(String(255), nullable=False)
    perfil = Column(String(20), nullable=False, default="Escritório")
    # Para o perfil Líder: o prestador que esse usuário representa em campo
    prestador_id = Column(String(36), ForeignKey("prestadores.id"), nullable=True)
    ativo = Column(Boolean, default=True, nullable=False)
    criado_em = Column(DateTime, default=datetime.utcnow)

    prestador = relationship("Prestador")


class LogAcesso(Base):
    __tablename__ = "logs_acesso"

    id = Column(String(36), primary_key=True, default=_uuid)
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    data_hora = Column(DateTime, default=datetime.utcnow, nullable=False)

    usuario = relationship("Usuario")
