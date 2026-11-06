import uuid
from sqlalchemy import Column, String, Text, Integer, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

TIPOS_VINCULO = ("CLT", "PJ", "MEI", "Diarista", "Terceirizado")
FORMAS_CUSTO = ("diaria", "hora")
# Frentes alinhadas aos códigos do CRM comercial (ELE/HID/BAN/PAS) + demais frentes de infraestrutura
CATEGORIAS_MATERIAL = (
    "Elétrica", "Hidráulica", "Banheiros", "Passa-cabos", "Palco e estruturas",
    "Iluminação e som", "Geradores", "Climatização", "Ferramentas", "EPI", "Consumíveis", "Outros",
)
TIPOS_MATERIAL = ("proprio", "locado", "consumivel")
COBRANCAS_MATERIAL = ("unidade", "diaria")


def _uuid() -> str:
    return str(uuid.uuid4())


class Funcao(Base):
    """Função exercida no evento (eletricista, montador, segurança...)."""
    __tablename__ = "funcoes"

    id = Column(String(36), primary_key=True, default=_uuid)
    nome = Column(String(120), nullable=False, unique=True)
    valor_diaria_ref = Column(Numeric(12, 2), nullable=False, default=0)  # sugestão ao cadastrar prestador

    prestadores = relationship("Prestador", back_populates="funcao")


class Prestador(Base):
    __tablename__ = "prestadores"

    id = Column(String(36), primary_key=True, default=_uuid)
    nome = Column(String(255), nullable=False)
    documento = Column(String(20), nullable=True)          # CPF ou CNPJ, só dígitos
    tipo_vinculo = Column(String(20), nullable=False, default="Diarista")
    empresa = Column(String(255), nullable=True)           # para terceirizados: empresa fornecedora
    funcao_id = Column(String(36), ForeignKey("funcoes.id"), nullable=True)
    telefone = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)
    cidade = Column(String(120), nullable=True)
    uf = Column(String(2), nullable=True)
    forma_custo = Column(String(10), nullable=False, default="diaria")  # diaria | hora
    valor_custo = Column(Numeric(12, 2), nullable=False, default=0)
    status = Column(String(10), nullable=False, default="Ativo")        # Ativo | Inativo
    observacoes = Column(Text, nullable=True)

    funcao = relationship("Funcao", back_populates="prestadores")
    alocacoes = relationship("Alocacao", back_populates="prestador")


class Material(Base):
    __tablename__ = "materiais"

    id = Column(String(36), primary_key=True, default=_uuid)
    codigo = Column(String(40), nullable=False, unique=True)
    nome = Column(String(255), nullable=False)
    categoria = Column(String(40), nullable=False, default="Outros")
    unidade = Column(String(10), nullable=False, default="un")
    tipo = Column(String(12), nullable=False, default="proprio")       # proprio | locado | consumivel
    cobranca = Column(String(10), nullable=False, default="unidade")   # unidade | diaria
    custo_unitario = Column(Numeric(12, 2), nullable=False, default=0)
    # Quantidade própria em estoque. Hoje só informativa; será usada no controle de
    # disponibilidade entre eventos simultâneos (fase futura).
    qtd_propria = Column(Integer, nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)
    observacoes = Column(Text, nullable=True)


class EquipeModelo(Base):
    """Composição padrão reutilizável (ex.: 'Equipe Elétrica padrão')."""
    __tablename__ = "equipes_modelo"

    id = Column(String(36), primary_key=True, default=_uuid)
    nome = Column(String(120), nullable=False, unique=True)
    descricao = Column(Text, nullable=True)
    cor = Column(String(20), nullable=True)

    itens = relationship("EquipeModeloItem", back_populates="modelo", cascade="all, delete-orphan")


class EquipeModeloItem(Base):
    __tablename__ = "equipes_modelo_itens"

    id = Column(String(36), primary_key=True, default=_uuid)
    modelo_id = Column(String(36), ForeignKey("equipes_modelo.id", ondelete="CASCADE"), nullable=False)
    funcao_id = Column(String(36), ForeignKey("funcoes.id"), nullable=False)
    quantidade = Column(Integer, nullable=False, default=1)

    modelo = relationship("EquipeModelo", back_populates="itens")
    funcao = relationship("Funcao")
