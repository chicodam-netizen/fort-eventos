from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Auth / Usuários ─────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    senha: str


class TrocarSenhaRequest(BaseModel):
    senha_atual: str
    senha_nova: str


class UsuarioOut(ORM):
    id: str
    nome: str
    email: str
    perfil: str
    prestador_id: Optional[str] = None
    ativo: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut


class UsuarioCreate(BaseModel):
    nome: str
    email: str
    senha: str = Field(min_length=6)
    perfil: str = "Escritório"
    prestador_id: Optional[str] = None
    ativo: bool = True


class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None
    senha: Optional[str] = None
    perfil: Optional[str] = None
    prestador_id: Optional[str] = None
    ativo: Optional[bool] = None


# ─── Funções ─────────────────────────────────────────────────────────────────

class FuncaoIn(BaseModel):
    nome: str
    valor_diaria_ref: float = 0


class FuncaoOut(ORM):
    id: str
    nome: str
    valor_diaria_ref: float


# ─── Prestadores ─────────────────────────────────────────────────────────────

class PrestadorIn(BaseModel):
    nome: str
    documento: Optional[str] = None
    tipo_vinculo: str = "Diarista"
    empresa: Optional[str] = None
    funcao_id: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    forma_custo: str = "diaria"
    valor_custo: float = 0
    status: str = "Ativo"
    observacoes: Optional[str] = None

    @field_validator("documento")
    @classmethod
    def _so_digitos(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        d = "".join(c for c in v if c.isdigit())
        return d or None


class PrestadorOut(ORM):
    id: str
    nome: str
    documento: Optional[str] = None
    tipo_vinculo: str
    empresa: Optional[str] = None
    funcao_id: Optional[str] = None
    funcao_nome: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    forma_custo: str
    valor_custo: float
    status: str
    observacoes: Optional[str] = None
    # Onde está agora (se alocado neste momento)
    alocado_agora: Optional[str] = None


# ─── Materiais ───────────────────────────────────────────────────────────────

class MaterialIn(BaseModel):
    codigo: str
    nome: str
    categoria: str = "Outros"
    unidade: str = "un"
    tipo: str = "proprio"
    cobranca: str = "unidade"
    custo_unitario: float = 0
    qtd_propria: Optional[int] = None
    ativo: bool = True
    observacoes: Optional[str] = None


class MaterialOut(ORM):
    id: str
    codigo: str
    nome: str
    categoria: str
    unidade: str
    tipo: str
    cobranca: str
    custo_unitario: float
    qtd_propria: Optional[int] = None
    ativo: bool
    observacoes: Optional[str] = None


# ─── Equipes modelo ──────────────────────────────────────────────────────────

class ModeloItemIn(BaseModel):
    funcao_id: str
    quantidade: int = Field(default=1, ge=1)


class ModeloItemOut(ORM):
    id: str
    funcao_id: str
    funcao_nome: Optional[str] = None
    quantidade: int


class EquipeModeloIn(BaseModel):
    nome: str
    descricao: Optional[str] = None
    cor: Optional[str] = None
    itens: List[ModeloItemIn] = []


class EquipeModeloOut(ORM):
    id: str
    nome: str
    descricao: Optional[str] = None
    cor: Optional[str] = None
    itens: List[ModeloItemOut] = []


# ─── Eventos ─────────────────────────────────────────────────────────────────

class EventoIn(BaseModel):
    numero_projeto: Optional[str] = None
    nome: str
    cliente: Optional[str] = None
    tipo: str = "Show"
    status: str = "Planejado"
    inicio: datetime
    fim: datetime
    evento_inicio: Optional[datetime] = None
    evento_fim: Optional[datetime] = None
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    orcamento_pessoas: float = 0
    orcamento_materiais: float = 0
    orcamento_outros: float = 0
    responsavel_id: Optional[str] = None
    observacoes: Optional[str] = None


class EventoStatusIn(BaseModel):
    status: str


class EquipeResumoOut(BaseModel):
    nome: str
    cor: Optional[str] = None
    lider_nome: Optional[str] = None
    pessoas_agora: int = 0
    pessoas_total: int = 0


class EventoOut(ORM):
    id: str
    numero_projeto: Optional[str] = None
    nome: str
    cliente: Optional[str] = None
    tipo: str
    status: str
    inicio: datetime
    fim: datetime
    evento_inicio: Optional[datetime] = None
    evento_fim: Optional[datetime] = None
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    orcamento_pessoas: float
    orcamento_materiais: float
    orcamento_outros: float
    responsavel_id: Optional[str] = None
    responsavel_nome: Optional[str] = None
    observacoes: Optional[str] = None
    # Resumo calculado
    qtd_equipes: int = 0
    pessoas_agora: int = 0
    pessoas_total: int = 0
    custo_realizado: float = 0
    pode_editar: bool = False
    equipes_resumo: List[EquipeResumoOut] = []


# ─── Equipes do evento / Alocações ───────────────────────────────────────────

class EquipeIn(BaseModel):
    nome: str
    descricao: Optional[str] = None
    cor: Optional[str] = None
    lider_id: Optional[str] = None
    ordem: Optional[int] = None


class EquipeDeModeloIn(BaseModel):
    modelo_id: str
    nome: Optional[str] = None


class AlocacaoIn(BaseModel):
    prestador_id: str
    inicio: datetime
    fim: datetime
    funcao_id: Optional[str] = None
    forma_custo: Optional[str] = None
    valor_custo: Optional[float] = None
    observacao: Optional[str] = None
    forcar: bool = False  # ignora alerta de conflito com outra alocação


class AlocacaoUpdate(BaseModel):
    inicio: Optional[datetime] = None
    fim: Optional[datetime] = None
    funcao_id: Optional[str] = None
    forma_custo: Optional[str] = None
    valor_custo: Optional[float] = None
    observacao: Optional[str] = None
    forcar: bool = False


class MoverIn(BaseModel):
    equipe_destino_id: str
    momento: datetime                 # quando sai da equipe atual e entra na nova
    fim: Optional[datetime] = None    # até quando fica na nova (padrão: fim original ou fim do evento destino)
    motivo: Optional[str] = None
    forcar: bool = False


class RetirarIn(BaseModel):
    momento: datetime
    motivo: Optional[str] = None


class AlocacaoOut(BaseModel):
    id: str
    equipe_id: str
    equipe_nome: str
    evento_id: str
    evento_nome: str
    prestador_id: str
    prestador_nome: str
    prestador_vinculo: Optional[str] = None
    funcao_id: Optional[str] = None
    funcao_nome: Optional[str] = None
    inicio: datetime
    fim: datetime
    forma_custo: str
    valor_custo: float
    origem_id: Optional[str] = None
    origem_descricao: Optional[str] = None
    motivo_encerramento: Optional[str] = None
    observacao: Optional[str] = None
    situacao: str            # futura | ativa | encerrada
    custo: float = 0         # custo apurado desta alocação


class EquipeOut(BaseModel):
    id: str
    evento_id: str
    nome: str
    descricao: Optional[str] = None
    cor: Optional[str] = None
    ordem: int
    lider_id: Optional[str] = None
    lider_nome: Optional[str] = None
    modelo_id: Optional[str] = None
    composicao_modelo: List[ModeloItemOut] = []
    alocacoes: List[AlocacaoOut] = []


class ConflitoOut(BaseModel):
    alocacao_id: str
    evento_nome: str
    equipe_nome: str
    inicio: datetime
    fim: datetime


# ─── Materiais do evento / Custos extras ─────────────────────────────────────

class MaterialEventoIn(BaseModel):
    material_id: str
    quantidade: float = Field(default=1, gt=0)
    inicio: Optional[date] = None
    fim: Optional[date] = None
    custo_unitario: Optional[float] = None
    observacao: Optional[str] = None


class MaterialEventoOut(BaseModel):
    id: str
    material_id: str
    codigo: str
    nome: str
    categoria: str
    unidade: str
    tipo: str
    cobranca: str
    quantidade: float
    inicio: Optional[date] = None
    fim: Optional[date] = None
    dias: int
    custo_unitario: float
    custo_total: float
    observacao: Optional[str] = None


class CustoExtraIn(BaseModel):
    categoria: str = "Outros"
    descricao: str
    data: Optional[date] = None
    valor: float = 0
    prestador_id: Optional[str] = None


class CustoExtraOut(BaseModel):
    id: str
    categoria: str
    descricao: str
    data: Optional[date] = None
    valor: float
    prestador_id: Optional[str] = None
    prestador_nome: Optional[str] = None


class ResumoCustosOut(BaseModel):
    pessoas_previsto: float
    pessoas_realizado: float
    materiais_previsto: float
    materiais_realizado: float
    outros_previsto: float
    outros_realizado: float
    total_previsto: float
    total_realizado: float
    por_equipe: List[dict]
    por_categoria_material: List[dict]
    por_categoria_extra: List[dict]
