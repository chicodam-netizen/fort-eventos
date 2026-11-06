const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const moedaCurta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

export const brl = (v: number | null | undefined) => moeda.format(v ?? 0)
export const brl0 = (v: number | null | undefined) => moedaCurta.format(v ?? 0)
export const num = (v: number | null | undefined) => numero.format(v ?? 0)

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-11-06T14:00:00" → Date local (o backend trabalha em horário de Brasília, sem fuso). */
export function parse(iso: string): Date {
  return new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso)
}

export function dataHora(iso?: string | null): string {
  if (!iso) return '—'
  const d = parse(iso)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function dataHoraAno(iso?: string | null): string {
  if (!iso) return '—'
  const d = parse(iso)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function data(iso?: string | null): string {
  if (!iso) return '—'
  const d = parse(iso)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function periodo(ini: string, fim: string): string {
  const a = parse(ini), b = parse(fim)
  const mesmoAno = a.getFullYear() === b.getFullYear()
  const fa = `${pad(a.getDate())}/${pad(a.getMonth() + 1)}${mesmoAno ? '' : '/' + a.getFullYear()}`
  return `${fa} → ${pad(b.getDate())}/${pad(b.getMonth() + 1)}/${b.getFullYear()}`
}

/** Valor para <input type="datetime-local"> */
export function toInputDT(iso?: string | Date | null): string {
  if (!iso) return ''
  const d = typeof iso === 'string' ? parse(iso) : iso
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Valor para <input type="date"> */
export function toInputD(iso?: string | Date | null): string {
  if (!iso) return ''
  const d = typeof iso === 'string' ? parse(iso) : iso
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const agoraInput = () => toInputDT(new Date())

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

/** Extrai mensagem de erro do axios/FastAPI */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function erroMsg(e: any, padrao = 'Não foi possível concluir a operação.'): string {
  const d = e?.response?.data?.detail
  if (!d) return padrao
  if (typeof d === 'string') return d
  if (typeof d === 'object' && d.mensagem) return d.mensagem
  if (Array.isArray(d)) return d.map((x: { msg?: string }) => x.msg).filter(Boolean).join('; ') || padrao
  return padrao
}

export const STATUS_COR: Record<string, string> = {
  'Planejado': 'var(--st-planejado)',
  'Confirmado': 'var(--st-confirmado)',
  'Montagem': 'var(--st-montagem)',
  'Em execução': 'var(--st-execucao)',
  'Desmontagem': 'var(--st-desmontagem)',
  'Concluído': 'var(--st-concluido)',
  'Cancelado': 'var(--st-cancelado)',
}

export const STATUS_HEX: Record<string, string> = {
  'Planejado': '#8A8580',
  'Confirmado': '#2B6CB0',
  'Montagem': '#C27C0E',
  'Em execução': '#1E7F4F',
  'Desmontagem': '#6B46C1',
  'Concluído': '#3A3A3A',
  'Cancelado': '#A23A24',
}

export const STATUS_ORDEM = ['Planejado', 'Confirmado', 'Montagem', 'Em execução', 'Desmontagem', 'Concluído', 'Cancelado']
export const STATUS_EM_CAMPO = ['Montagem', 'Em execução', 'Desmontagem']

export const VINCULO_LABEL: Record<string, string> = {
  CLT: 'CLT', PJ: 'PJ', MEI: 'MEI', Diarista: 'Diarista', Terceirizado: 'Terceirizado',
}
export const FORMA_LABEL: Record<string, string> = { diaria: 'por diária', hora: 'por hora' }
export const TIPO_MAT_LABEL: Record<string, string> = { proprio: 'Próprio', locado: 'Locado', consumivel: 'Consumível' }
export const COBRANCA_LABEL: Record<string, string> = { unidade: 'por unidade', diaria: 'por diária' }
