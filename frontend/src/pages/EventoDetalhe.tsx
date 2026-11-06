import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Boxes, CalendarClock, History, MapPin, Pencil, Receipt, Users } from 'lucide-react'
import { apiEquipes, apiEventos, apiOpcoes, type Evento } from '../api'
import EventoForm from '../components/EventoForm'
import { MapaEventos } from '../components/Mapa'
import StatusPill from '../components/StatusPill'
import { useToast } from '../components/Toast'
import CustosTab from '../components/evento/CustosTab'
import EquipesTab from '../components/evento/EquipesTab'
import MateriaisTab from '../components/evento/MateriaisTab'
import { useAuth } from '../context/AuthContext'
import { brl0, dataHora, dataHoraAno, erroMsg } from '../utils/format'

type Aba = 'equipes' | 'materiais' | 'custos' | 'movimentacoes' | 'detalhes'

function Movimentacoes({ evento }: { evento: Evento }) {
  const { data: equipes = [] } = useQuery({ queryKey: ['equipes', evento.id], queryFn: () => apiEquipes.listar(evento.id) })
  const movs = equipes
    .flatMap((e) => e.alocacoes)
    .filter((a) => a.origem_id || a.motivo_encerramento)
    .map((a) => ({
      a,
      quando: a.origem_id ? a.inicio : a.fim,
      texto: a.origem_id ? `Entrou em ${a.equipe_nome}, vindo de ${a.origem_descricao ?? 'outra equipe'}` : `Saiu de ${a.equipe_nome}: ${a.motivo_encerramento}`,
    }))
    .sort((x, y) => y.quando.localeCompare(x.quando))
  if (!movs.length) return <div className="empty">Nenhuma movimentação ou retirada registrada neste evento.</div>
  return (
    <div className="card flush scroll">
      <table className="tbl">
        <thead><tr><th>Quando</th><th>Prestador</th><th>Movimentação</th></tr></thead>
        <tbody>
          {movs.map(({ a, quando, texto }) => (
            <tr key={a.id + quando}>
              <td className="num small" style={{ whiteSpace: 'nowrap' }}>{dataHoraAno(quando)}</td>
              <td style={{ fontWeight: 600 }}>{a.prestador_nome}</td>
              <td>{texto}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function EventoDetalhe() {
  const { id = '' } = useParams()
  const { isEscritorio } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [aba, setAba] = useState<Aba>('equipes')
  const [editando, setEditando] = useState(false)
  const { data: ev, isLoading, error } = useQuery({ queryKey: ['evento', id], queryFn: () => apiEventos.obter(id) })
  const { data: opcoes } = useQuery({ queryKey: ['opcoes'], queryFn: apiOpcoes, staleTime: Infinity })

  if (isLoading) return <div className="spinner" />
  if (error || !ev) return <div className="alert bad">{erroMsg(error, 'Evento não encontrado.')}</div>

  async function mudarStatus(status: string) {
    try {
      await apiEventos.status(id, status)
      qc.invalidateQueries({ queryKey: ['evento', id] })
      qc.invalidateQueries({ queryKey: ['eventos'] })
      qc.invalidateQueries({ queryKey: ['painel'] })
      toast(`Status alterado para ${status}.`)
    } catch (e) {
      toast(erroMsg(e), 'error')
    }
  }

  const previsto = ev.orcamento_pessoas + ev.orcamento_materiais + ev.orcamento_outros
  const abas: [Aba, string, typeof Users][] = [
    ['equipes', 'Equipes', Users],
    ['materiais', 'Materiais', Boxes],
    ...(isEscritorio ? [['custos', 'Custos', Receipt] as [Aba, string, typeof Users]] : []),
    ['movimentacoes', 'Movimentações', History],
    ['detalhes', 'Detalhes e local', MapPin],
  ]

  return (
    <>
      <Link to="/eventos" className="small row tight" style={{ width: 'fit-content' }}><ArrowLeft size={14} />Eventos</Link>
      <div className="card" style={{ borderTop: '4px solid var(--brand)' }}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="stack" style={{ gap: 6 }}>
            <div className="row tight">
              <StatusPill status={ev.status} />
              <span className="pill">{ev.tipo}</span>
              {ev.numero_projeto && <span className="pill mono">{ev.numero_projeto}</span>}
            </div>
            <h1>{ev.nome}</h1>
            <div className="row" style={{ gap: 18, color: 'var(--muted)' }}>
              {ev.cliente && <span>{ev.cliente}</span>}
              <span className="row tight"><CalendarClock size={15} /><span className="num">{dataHora(ev.inicio)} → {dataHoraAno(ev.fim)}</span></span>
              {ev.cidade && <span className="row tight"><MapPin size={15} />{ev.cidade}{ev.uf ? `/${ev.uf}` : ''}</span>}
            </div>
          </div>
          {isEscritorio && (
            <div className="row tight">
              <select className="inp" style={{ width: 170 }} value={ev.status} onChange={(e) => mudarStatus(e.target.value)} aria-label="Status do evento">
                {opcoes?.status_evento.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button className="btn" onClick={() => setEditando(true)}><Pencil size={15} />Editar</button>
            </div>
          )}
        </div>
        <div className="g4" style={{ marginTop: 18 }}>
          <div><div className="k">Equipes</div><div className="v" style={{ fontSize: 22 }}>{ev.qtd_equipes}</div></div>
          <div><div className="k">Em campo agora</div><div className="v" style={{ fontSize: 22 }}>{ev.pessoas_agora}</div></div>
          <div><div className="k">Pessoas no evento</div><div className="v" style={{ fontSize: 22 }}>{ev.pessoas_total}</div></div>
          {isEscritorio && (
            <div>
              <div className="k">Custo realizado / previsto</div>
              <div className="v" style={{ fontSize: 22, color: previsto && ev.custo_realizado > previsto ? 'var(--bad)' : undefined }}>{brl0(ev.custo_realizado)}</div>
              <div className="small muted num">de {brl0(previsto)}</div>
            </div>
          )}
        </div>
      </div>

      <div className="tabs" role="tablist">
        {abas.map(([k, l, Icon]) => (
          <button key={k} role="tab" aria-selected={aba === k} className={`tab${aba === k ? ' on' : ''}`} onClick={() => setAba(k)}><Icon size={16} />{l}</button>
        ))}
      </div>

      {aba === 'equipes' && <EquipesTab evento={ev} />}
      {aba === 'materiais' && <MateriaisTab evento={ev} />}
      {aba === 'custos' && isEscritorio && <CustosTab evento={ev} />}
      {aba === 'movimentacoes' && <Movimentacoes evento={ev} />}
      {aba === 'detalhes' && (
        <div className="split">
          <div className="card"><MapaEventos eventos={[{ ...ev }]} /></div>
          <div className="card">
            <dl style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px 12px', margin: 0 }}>
              <dt className="muted">Endereço</dt><dd style={{ margin: 0 }}>{ev.endereco ?? '—'}</dd>
              <dt className="muted">Cidade</dt><dd style={{ margin: 0 }}>{ev.cidade ? `${ev.cidade}${ev.uf ? '/' + ev.uf : ''}` : '—'}</dd>
              <dt className="muted">Coordenadas</dt><dd style={{ margin: 0 }} className="num">{ev.latitude != null ? `${ev.latitude.toFixed(5)}, ${ev.longitude?.toFixed(5)}` : '—'}</dd>
              <dt className="muted">Operação</dt><dd style={{ margin: 0 }} className="num">{dataHoraAno(ev.inicio)} → {dataHoraAno(ev.fim)}</dd>
              <dt className="muted">Aberto ao público</dt><dd style={{ margin: 0 }} className="num">{ev.evento_inicio ? `${dataHoraAno(ev.evento_inicio)} → ${dataHoraAno(ev.evento_fim)}` : '—'}</dd>
              {isEscritorio && (<>
                <dt className="muted">Orçamento pessoas</dt><dd style={{ margin: 0 }} className="num">{brl0(ev.orcamento_pessoas)}</dd>
                <dt className="muted">Orçamento materiais</dt><dd style={{ margin: 0 }} className="num">{brl0(ev.orcamento_materiais)}</dd>
                <dt className="muted">Orçamento outros</dt><dd style={{ margin: 0 }} className="num">{brl0(ev.orcamento_outros)}</dd>
              </>)}
              <dt className="muted">Observações</dt><dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{ev.observacoes ?? '—'}</dd>
            </dl>
            {ev.latitude != null && (
              <a className="btn sm" style={{ marginTop: 16 }} target="_blank" rel="noreferrer"
                href={`https://www.google.com/maps/dir/?api=1&destination=${ev.latitude},${ev.longitude}`}>
                <MapPin size={14} />Como chegar
              </a>
            )}
          </div>
        </div>
      )}

      {editando && (
        <EventoForm
          evento={ev}
          onClose={() => setEditando(false)}
          onSalvo={() => {
            setEditando(false)
            qc.invalidateQueries({ queryKey: ['evento', id] })
            qc.invalidateQueries({ queryKey: ['eventos'] })
            qc.invalidateQueries({ queryKey: ['painel'] })
            toast('Evento atualizado.')
          }}
        />
      )}
    </>
  )
}
