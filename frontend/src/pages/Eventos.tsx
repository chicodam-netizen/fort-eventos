import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { List, Map, Plus } from 'lucide-react'
import { apiEventos } from '../api'
import EventoForm from '../components/EventoForm'
import { MapaEventos } from '../components/Mapa'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../context/AuthContext'
import { brl0, periodo, STATUS_HEX, STATUS_ORDEM } from '../utils/format'

export default function Eventos() {
  const { isEscritorio } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [modo, setModo] = useState<'lista' | 'mapa'>('lista')
  const status = params.getAll('status')
  const novo = params.get('novo') === '1'

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ['eventos', status, q],
    queryFn: () => apiEventos.listar({ status: status.length ? status : undefined, q: q || undefined }),
  })

  function toggleStatus(s: string) {
    const prox = new URLSearchParams(params)
    prox.delete('status')
    const lista = status.includes(s) ? status.filter((x) => x !== s) : [...status, s]
    lista.forEach((x) => prox.append('status', x))
    setParams(prox, { replace: true })
  }

  function fecharNovo() {
    const prox = new URLSearchParams(params)
    prox.delete('novo')
    setParams(prox, { replace: true })
  }

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Eventos</h1>
          <p className="sub">Shows, feiras e demais projetos com datas, local, equipes e custos.</p>
        </div>
        <div className="row tight">
          <button className={`btn${modo === 'lista' ? ' pri' : ''}`} onClick={() => setModo('lista')}><List size={16} />Lista</button>
          <button className={`btn${modo === 'mapa' ? ' pri' : ''}`} onClick={() => setModo('mapa')}><Map size={16} />Mapa</button>
          {isEscritorio && (
            <button className="btn pri" onClick={() => setParams({ novo: '1' })}><Plus size={16} />Novo evento</button>
          )}
        </div>
      </div>

      <div className="card stack">
        <input className="inp" placeholder="Buscar por nome, cliente, cidade ou nº do projeto" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="row tight">
          {STATUS_ORDEM.map((s) => (
            <button
              key={s}
              className="btn sm"
              onClick={() => toggleStatus(s)}
              style={status.includes(s) ? { borderColor: STATUS_HEX[s], background: STATUS_HEX[s], color: '#fff' } : undefined}
            >
              <span className="dot" style={{ background: status.includes(s) ? '#fff' : STATUS_HEX[s] }} />{s}
            </button>
          ))}
          {status.length > 0 && <button className="btn sm ghost" onClick={() => setParams({}, { replace: true })}>Limpar filtros</button>}
        </div>
      </div>

      {isLoading ? <div className="spinner" /> : modo === 'mapa' ? (
        <div className="card"><MapaEventos eventos={eventos} className="map tall" /></div>
      ) : eventos.length === 0 ? (
        <div className="empty">Nenhum evento encontrado.</div>
      ) : (
        <div className="card flush scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Evento</th><th>Status</th><th>Operação</th><th>Local</th>
                <th className="r">Equipes</th><th className="r">Em campo</th><th className="r">Pessoas</th>
                {isEscritorio && <th className="r">Custo realizado</th>}
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => {
                const previsto = e.orcamento_pessoas + e.orcamento_materiais + e.orcamento_outros
                return (
                  <tr key={e.id} className={`click${e.status === 'Cancelado' ? ' off' : ''}`} onClick={() => navigate(`/eventos/${e.id}`)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{e.nome}</div>
                      <div className="small muted">{[e.numero_projeto, e.cliente].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td><StatusPill status={e.status} /></td>
                    <td className="num small">{periodo(e.inicio, e.fim)}</td>
                    <td className="small">{e.cidade ? `${e.cidade}${e.uf ? '/' + e.uf : ''}` : <span className="muted">—</span>}</td>
                    <td className="r num">{e.qtd_equipes}</td>
                    <td className="r num">{e.pessoas_agora || <span className="muted">0</span>}</td>
                    <td className="r num">{e.pessoas_total}</td>
                    {isEscritorio && (
                      <td className="r num small">
                        <span style={{ color: previsto && e.custo_realizado > previsto ? 'var(--bad)' : undefined }}>{brl0(e.custo_realizado)}</span>
                        {previsto > 0 && <div className="muted">de {brl0(previsto)}</div>}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {novo && isEscritorio && (
        <EventoForm onClose={fecharNovo} onSalvo={(ev) => navigate(`/eventos/${ev.id}`)} />
      )}
    </>
  )
}
