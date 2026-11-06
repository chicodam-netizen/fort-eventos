import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Numeric, Date, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

STATUS_EVENTO = ("Planejado", "Confirmado", "Montagem", "Em execução", "Desmontagem", "Concluído", "Cancelado")
TIPOS_EVENTO = ("Show", "Festival", "Feira", "Corporativo", "Esportivo", "Religioso", "Outro")
CATEGORIAS_CUSTO = ("Alimentação", "Transporte", "Hospedagem", "Hora extra", "Frete", "Subcontratação", "Outros")


def _uuid() -> str:
    return str(uuid.uuid4())


class Evento(Base):
    __tablename__ = "eventos"

    id = Column(String(36), primary_key=True, default=_uuid)
    numero_projeto = Column(String(40), nullable=True, unique=True)  # mesmo número do fechamento no CRM
    nome = Column(String(255), nullable=False)
    cliente = Column(String(255), nullable=True)
    tipo = Column(String(20), nullable=False, default="Show")
    status = Column(String(20), nullable=False, default="Planejado")

    # Período total da operação (montagem → desmontagem)
    inicio = Column(DateTime, nullable=False)
    fim = Column(DateTime, nullable=False)
    # Período do evento em si (aberto ao público), opcional
    evento_inicio = Column(DateTime, nullable=True)
    evento_fim = Column(DateTime, nullable=True)

    endereco = Column(String(255), nullable=True)
    cidade = Column(String(120), nullable=True)
    uf = Column(String(2), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    orcamento_pessoas = Column(Numeric(14, 2), nullable=False, default=0)
    orcamento_materiais = Column(Numeric(14, 2), nullable=False, default=0)
    orcamento_outros = Column(Numeric(14, 2), nullable=False, default=0)

    responsavel_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    observacoes = Column(Text, nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow)

    responsavel = relationship("Usuario")
    equipes = relationship("Equipe", back_populates="evento", cascade="all, delete-orphan", order_by="Equipe.ordem")
    materiais = relationship("MaterialEvento", back_populates="evento", cascade="all, delete-orphan")
    custos_extras = relationship("CustoExtra", back_populates="evento", cascade="all, delete-orphan")


class Equipe(Base):
    """Equipe de um evento. Pode nascer de uma equipe modelo e depois ser personalizada."""
    __tablename__ = "equipes"

    id = Column(String(36), primary_key=True, default=_uuid)
    evento_id = Column(String(36), ForeignKey("eventos.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = Column(String(120), nullable=False)
    descricao = Column(Text, nullable=True)
    cor = Column(String(20), nullable=True)
    ordem = Column(Integer, nullable=False, default=0)
    lider_id = Column(String(36), ForeignKey("prestadores.id"), nullable=True)
    modelo_id = Column(String(36), ForeignKey("equipes_modelo.id", ondelete="SET NULL"), nullable=True)

    evento = relationship("Evento", back_populates="equipes")
    lider = relationship("Prestador")
    alocacoes = relationship("Alocacao", back_populates="equipe", cascade="all, delete-orphan")


class Alocacao(Base):
    """Período (data e hora) em que um prestador esteve numa equipe.

    Mover um prestador = encerrar a alocação atual no momento da troca e abrir
    outra na equipe de destino (do mesmo ou de outro evento), apontando para a
    de origem. O histórico nunca é sobrescrito.
    """
    __tablename__ = "alocacoes"

    id = Column(String(36), primary_key=True, default=_uuid)
    equipe_id = Column(String(36), ForeignKey("equipes.id", ondelete="CASCADE"), nullable=False, index=True)
    prestador_id = Column(String(36), ForeignKey("prestadores.id"), nullable=False, index=True)
    inicio = Column(DateTime, nullable=False)
    fim = Column(DateTime, nullable=False)
    funcao_id = Column(String(36), ForeignKey("funcoes.id"), nullable=True)  # função neste evento
    forma_custo = Column(String(10), nullable=False, default="diaria")
    valor_custo = Column(Numeric(12, 2), nullable=False, default=0)          # copiado do prestador, editável
    origem_id = Column(String(36), ForeignKey("alocacoes.id", ondelete="SET NULL"), nullable=True)
    motivo_encerramento = Column(String(255), nullable=True)                  # "Movido para ...", "Retirado: ..."
    observacao = Column(Text, nullable=True)
    criado_por_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow)

    equipe = relationship("Equipe", back_populates="alocacoes")
    prestador = relationship("Prestador", back_populates="alocacoes")
    funcao = relationship("Funcao")
    origem = relationship("Alocacao", remote_side=[id])
    criado_por = relationship("Usuario")


class MaterialEvento(Base):
    __tablename__ = "materiais_evento"

    id = Column(String(36), primary_key=True, default=_uuid)
    evento_id = Column(String(36), ForeignKey("eventos.id", ondelete="CASCADE"), nullable=False, index=True)
    material_id = Column(String(36), ForeignKey("materiais.id"), nullable=False)
    quantidade = Column(Numeric(12, 2), nullable=False, default=1)
    inicio = Column(Date, nullable=True)    # usado quando a cobrança é por diária
    fim = Column(Date, nullable=True)
    custo_unitario = Column(Numeric(12, 2), nullable=False, default=0)  # copiado do cadastro, editável
    observacao = Column(Text, nullable=True)

    evento = relationship("Evento", back_populates="materiais")
    material = relationship("Material")


class CustoExtra(Base):
    """Despesas avulsas do evento (alimentação, transporte, hospedagem...)."""
    __tablename__ = "custos_extras"

    id = Column(String(36), primary_key=True, default=_uuid)
    evento_id = Column(String(36), ForeignKey("eventos.id", ondelete="CASCADE"), nullable=False, index=True)
    categoria = Column(String(30), nullable=False, default="Outros")
    descricao = Column(String(255), nullable=False)
    data = Column(Date, nullable=True)
    valor = Column(Numeric(14, 2), nullable=False, default=0)
    prestador_id = Column(String(36), ForeignKey("prestadores.id"), nullable=True)

    evento = relationship("Evento", back_populates="custos_extras")
    prestador = relationship("Prestador")
