import axios from 'axios'

const TOKEN_KEY = 'gf_eventos_token'

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
}

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 65000,
  // FastAPI espera parâmetros repetidos (status=a&status=b), não status[]=a
  paramsSerializer: { indexes: null },
})

api.interceptors.request.use((config) => {
  const token = authStorage.getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let onUnauthorized: (() => void) | null = null
export function setOnUnauthorized(fn: () => void) {
  onUnauthorized = fn
}

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      authStorage.clearToken()
      onUnauthorized?.()
    }
    return Promise.reject(error)
  },
)

export default api

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type Perfil = 'Administrador' | 'Escritório' | 'Líder'

export interface Usuario {
  id: string
  nome: string
  email: string
  perfil: Perfil
  prestador_id?: string | null
  ativo: boolean
}

export interface Opcoes {
  tipos_vinculo: string[]
  formas_custo: string[]
  categorias_material: string[]
  tipos_material: string[]
  cobrancas_material: string[]
  status_evento: string[]
  tipos_evento: string[]
  categorias_custo: string[]
}

export interface Funcao {
  id: string
  nome: string
  valor_diaria_ref: number
}

export interface Prestador {
  id: string
  nome: string
  documento?: string | null
  tipo_vinculo: string
  empresa?: string | null
  funcao_id?: string | null
  funcao_nome?: string | null
  telefone?: string | null
  email?: string | null
  cidade?: string | null
  uf?: string | null
  forma_custo: string
  valor_custo: number
  status: string
  observacoes?: string | null
  alocado_agora?: string | null
}

export interface Material {
  id: string
  codigo: string
  nome: string
  categoria: string
  unidade: string
  tipo: string
  cobranca: string
  custo_unitario: number
  qtd_propria?: number | null
  ativo: boolean
  observacoes?: string | null
}

export interface ModeloItem {
  id?: string
  funcao_id: string
  funcao_nome?: string | null
  quantidade: number
}

export interface EquipeModelo {
  id: string
  nome: string
  descricao?: string | null
  cor?: string | null
  itens: ModeloItem[]
}

export interface Evento {
  id: string
  numero_projeto?: string | null
  nome: string
  cliente?: string | null
  tipo: string
  status: string
  inicio: string
  fim: string
  evento_inicio?: string | null
  evento_fim?: string | null
  endereco?: string | null
  cidade?: string | null
  uf?: string | null
  latitude?: number | null
  longitude?: number | null
  orcamento_pessoas: number
  orcamento_materiais: number
  orcamento_outros: number
  responsavel_id?: string | null
  responsavel_nome?: string | null
  observacoes?: string | null
  qtd_equipes: number
  pessoas_agora: number
  pessoas_total: number
  custo_realizado: number
  pode_editar: boolean
}

export type EventoIn = Omit<Evento, 'id' | 'qtd_equipes' | 'pessoas_agora' | 'pessoas_total' | 'custo_realizado' | 'pode_editar' | 'responsavel_nome'>

export interface Alocacao {
  id: string
  equipe_id: string
  equipe_nome: string
  evento_id: string
  evento_nome: string
  prestador_id: string
  prestador_nome: string
  prestador_vinculo?: string | null
  funcao_id?: string | null
  funcao_nome?: string | null
  inicio: string
  fim: string
  forma_custo: string
  valor_custo: number
  origem_id?: string | null
  origem_descricao?: string | null
  motivo_encerramento?: string | null
  observacao?: string | null
  situacao: 'futura' | 'ativa' | 'encerrada'
  custo: number
}

export interface Equipe {
  id: string
  evento_id: string
  nome: string
  descricao?: string | null
  cor?: string | null
  ordem: number
  lider_id?: string | null
  lider_nome?: string | null
  modelo_id?: string | null
  composicao_modelo: ModeloItem[]
  alocacoes: Alocacao[]
}

export interface EquipeDestino {
  id: string
  nome: string
  evento_id: string
  evento_nome: string
  evento_status: string
  evento_inicio: string
  evento_fim: string
}

export interface Conflito {
  alocacao_id?: string
  evento_nome: string
  equipe_nome: string
  inicio: string
  fim: string
}

export interface MaterialEvento {
  id: string
  material_id: string
  codigo: string
  nome: string
  categoria: string
  unidade: string
  tipo: string
  cobranca: string
  quantidade: number
  inicio?: string | null
  fim?: string | null
  dias: number
  custo_unitario: number
  custo_total: number
  observacao?: string | null
}

export interface CustoExtra {
  id: string
  categoria: string
  descricao: string
  data?: string | null
  valor: number
  prestador_id?: string | null
  prestador_nome?: string | null
}

export interface ResumoCustos {
  pessoas_previsto: number
  pessoas_realizado: number
  materiais_previsto: number
  materiais_realizado: number
  outros_previsto: number
  outros_realizado: number
  total_previsto: number
  total_realizado: number
  por_equipe: { equipe: string; valor: number; pessoas: number }[]
  por_categoria_material: { categoria: string; valor: number }[]
  por_categoria_extra: { categoria: string; valor: number }[]
}

export interface PainelEvento {
  id: string
  nome: string
  cliente?: string | null
  status: string
  tipo: string
  inicio: string
  fim: string
  cidade?: string | null
  uf?: string | null
  latitude?: number | null
  longitude?: number | null
  pessoas_agora: number
  custo_realizado: number
  custo_previsto: number
}

export interface Painel {
  agora: string
  por_status: Record<string, number>
  em_andamento: PainelEvento[]
  proximos: PainelEvento[]
  pessoas_alocadas_agora: number
  custo_realizado_total: number
  custo_previsto_total: number
  eventos: PainelEvento[]
}

export interface GeoResultado {
  descricao: string
  latitude: number
  longitude: number
  cidade?: string | null
  uf?: string | null
}

// ─── Chamadas ────────────────────────────────────────────────────────────────

const d = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data)

export const apiAuth = {
  login: (email: string, senha: string) => d(api.post<{ access_token: string; usuario: Usuario }>('/auth/login', { email, senha })),
  me: () => d(api.get<Usuario>('/auth/me')),
  trocarSenha: (senha_atual: string, senha_nova: string) => api.patch('/auth/senha', { senha_atual, senha_nova }),
}

export const apiUsuarios = {
  listar: () => d(api.get<Usuario[]>('/usuarios')),
  criar: (u: Partial<Usuario> & { senha: string }) => d(api.post<Usuario>('/usuarios', u)),
  atualizar: (id: string, u: Partial<Usuario> & { senha?: string }) => d(api.put<Usuario>(`/usuarios/${id}`, u)),
}

export const apiOpcoes = () => d(api.get<Opcoes>('/opcoes'))

export const apiFuncoes = {
  listar: () => d(api.get<Funcao[]>('/funcoes')),
  criar: (f: Omit<Funcao, 'id'>) => d(api.post<Funcao>('/funcoes', f)),
  atualizar: (id: string, f: Omit<Funcao, 'id'>) => d(api.put<Funcao>(`/funcoes/${id}`, f)),
  excluir: (id: string) => api.delete(`/funcoes/${id}`),
}

export const apiPrestadores = {
  listar: (params?: { q?: string; status?: string }) => d(api.get<Prestador[]>('/prestadores', { params })),
  criar: (p: Partial<Prestador>) => d(api.post<Prestador>('/prestadores', p)),
  atualizar: (id: string, p: Partial<Prestador>) => d(api.put<Prestador>(`/prestadores/${id}`, p)),
  historico: (id: string) => d(api.get<Alocacao[]>(`/prestadores/${id}/alocacoes`)),
  disponibilidade: (inicio: string, fim: string, excluir_alocacao?: string) =>
    d(api.get<Record<string, Conflito[]>>('/prestadores-disponibilidade', { params: { inicio, fim, excluir_alocacao } })),
}

export const apiMateriais = {
  listar: (params?: { q?: string; categoria?: string }) => d(api.get<Material[]>('/materiais', { params })),
  criar: (m: Partial<Material>) => d(api.post<Material>('/materiais', m)),
  atualizar: (id: string, m: Partial<Material>) => d(api.put<Material>(`/materiais/${id}`, m)),
}

export const apiModelos = {
  listar: () => d(api.get<EquipeModelo[]>('/equipes-modelo')),
  criar: (m: Omit<EquipeModelo, 'id'>) => d(api.post<EquipeModelo>('/equipes-modelo', m)),
  atualizar: (id: string, m: Omit<EquipeModelo, 'id'>) => d(api.put<EquipeModelo>(`/equipes-modelo/${id}`, m)),
  excluir: (id: string) => api.delete(`/equipes-modelo/${id}`),
}

export const apiEventos = {
  listar: (params?: { q?: string; status?: string[] }) => d(api.get<Evento[]>('/eventos', { params })),
  obter: (id: string) => d(api.get<Evento>(`/eventos/${id}`)),
  criar: (e: Partial<EventoIn>) => d(api.post<Evento>('/eventos', e)),
  atualizar: (id: string, e: Partial<EventoIn>) => d(api.put<Evento>(`/eventos/${id}`, e)),
  status: (id: string, status: string) => d(api.patch<Evento>(`/eventos/${id}/status`, { status })),
  excluir: (id: string) => api.delete(`/eventos/${id}`),
  custos: (id: string) => d(api.get<ResumoCustos>(`/eventos/${id}/custos`)),
}

export const apiEquipes = {
  listar: (eventoId: string) => d(api.get<Equipe[]>(`/eventos/${eventoId}/equipes`)),
  criar: (eventoId: string, e: { nome: string; descricao?: string | null; cor?: string | null; lider_id?: string | null }) =>
    d(api.post(`/eventos/${eventoId}/equipes`, e)),
  deModelo: (eventoId: string, modelo_id: string, nome?: string) => d(api.post(`/eventos/${eventoId}/equipes/de-modelo`, { modelo_id, nome })),
  atualizar: (id: string, e: { nome: string; descricao?: string | null; cor?: string | null; lider_id?: string | null }) =>
    d(api.put(`/equipes/${id}`, e)),
  excluir: (id: string) => api.delete(`/equipes/${id}`),
  destinos: () => d(api.get<EquipeDestino[]>('/equipes-destino')),
}

export interface AlocacaoPayload {
  prestador_id: string
  inicio: string
  fim: string
  funcao_id?: string | null
  forma_custo?: string
  valor_custo?: number
  observacao?: string | null
  forcar?: boolean
}

export const apiAlocacoes = {
  criar: (equipeId: string, a: AlocacaoPayload) => d(api.post(`/equipes/${equipeId}/alocacoes`, a)),
  editar: (id: string, a: Partial<AlocacaoPayload>) => d(api.put(`/alocacoes/${id}`, a)),
  excluir: (id: string) => api.delete(`/alocacoes/${id}`),
  mover: (id: string, p: { equipe_destino_id: string; momento: string; fim?: string | null; motivo?: string | null; forcar?: boolean }) =>
    d(api.post<{ id: string; transferida: boolean }>(`/alocacoes/${id}/mover`, p)),
  retirar: (id: string, p: { momento: string; motivo?: string | null }) => d(api.post(`/alocacoes/${id}/retirar`, p)),
}

export const apiMateriaisEvento = {
  listar: (eventoId: string) => d(api.get<MaterialEvento[]>(`/eventos/${eventoId}/materiais`)),
  criar: (eventoId: string, m: Record<string, unknown>) => d(api.post(`/eventos/${eventoId}/materiais`, m)),
  editar: (id: string, m: Record<string, unknown>) => d(api.put(`/materiais-evento/${id}`, m)),
  excluir: (id: string) => api.delete(`/materiais-evento/${id}`),
}

export const apiCustosExtras = {
  listar: (eventoId: string) => d(api.get<CustoExtra[]>(`/eventos/${eventoId}/custos-extras`)),
  criar: (eventoId: string, c: Partial<CustoExtra>) => d(api.post(`/eventos/${eventoId}/custos-extras`, c)),
  editar: (id: string, c: Partial<CustoExtra>) => d(api.put(`/custos-extras/${id}`, c)),
  excluir: (id: string) => api.delete(`/custos-extras/${id}`),
}

export const apiPainel = () => d(api.get<Painel>('/painel'))
export const apiGeo = (q: string) => d(api.get<GeoResultado[]>('/geo/buscar', { params: { q } }))
