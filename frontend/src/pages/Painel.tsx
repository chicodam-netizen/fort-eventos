import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { apiPainel, type PainelEvento } from '../api'
import { MapaEventos } from '../components/Mapa'
import StatusPill from '../components/StatusPill'
import { useAuth } from '../context/AuthContext'
import { brl0, periodo, STATUS_HEX, STATUS_ORDEM } from '../utils/format'

function Tabela({ eventos, vazio, mostrarCusto }: { eventos: PainelEvento[]; vazio: string; mostrarCusto: boolean }) {
  const navigate = useNavigate()
  if (!eventos.length) return <div className="empty">{vazio}</div>
  return (
    <div className="scroll">
      <table className="tbl">
        <thead>
          <tr>
            <th>Evento</th><th>Status</th><th>Período</th><th className="r">Em campo</th>
            {mostrarCusto && <th className="r">Realizado / previsto</th>}
          </tr>
        </thead>
        <tbody>
          {eventos.map((e) => (
            <tr key={e.id} className="click" onClick={() => navigate(`/eventos/${e.id}`)}>
              <td>
                <div style={{ fontWeight: 600 }}>{e.nome}</div>
                <div className="small muted">{e.cidade}{e.uf ? `/${e.uf}` : ''}</div>
              </td>
              <td><StatusPill status={e.status} /></td>
              <td className="num small">{periodo(e.inicio, e.fim)}</td>
              <td className="r num">{e.pessoas_agora}</td>
              {mostrarCusto && (
                <td className="r num small">
                  <span style={{ color: e.custo_previsto && e.custo_realizado > e.custo_previsto ? 'var(--bad)' : undefined }}>
                    {brl0(e.custo_realizado)}
                  </span>
                  <span className="muted"> / {brl0(e.custo_previsto)}</span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Painel() {
  const { usuario, isEscritorio } = useAuth()
  const { data, isLoading } = useQuery({ queryKey: ['painel'], queryFn: apiPainel, refetchInterval: 60_000 })

  if (isLoading || !data) return <div className="spinner" />

  const ativos = data.eventos.filter((e) => e.status !== 'Cancelado' && e.status !== 'Concluído')
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Olá, {usuario?.nome.split(' ')[0]}</h1>
          <p className="sub">{isEscritorio ? 'Visão geral das operações.' : 'Eventos em que você lidera uma equipe.'}</p>
        </div>
        {isEscritorio && <Link className="btn pri" to="/eventos?novo=1">Novo evento</Link>}
      </div>

      <div className="g4">
        <div className="card kpi">
          <div className="k">Eventos em campo agora</div>
          <div className="v">{data.em_andamento.length}</div>
        </div>
        <div className="card kpi">
          <div className="k">Pessoas em campo agora</div>
          <div className="v">{data.pessoas_alocadas_agora}</div>
        </div>
        <div className="card kpi">
          <div className="k">Começam nos próximos 30 dias</div>
          <div className="v">{data.proximos.length}</div>
        </div>
        {isEscritorio && (
          <div className="card kpi">
            <div className="k">Custo realizado (não cancelados)</div>
            <div className="v" style={{ fontSize: 22 }}>{brl0(data.custo_realizado_total)}</div>
            <div className="small muted num" style={{ marginTop: 4 }}>previsto {brl0(data.custo_previsto_total)}</div>
          </div>
        )}
      </div>

      <div className="split">
        <div className="card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Onde estamos</h2>
            <Link to="/mapa" className="small">Abrir mapa completo</Link>
          </div>
          <MapaEventos eventos={ativos} />
        </div>
        <div className="card">
          <h2>Eventos por status</h2>
          <div className="stack" style={{ gap: 10 }}>
            {STATUS_ORDEM.map((s) => {
              const n = data.por_status[s] ?? 0
              const max = Math.max(...Object.values(data.por_status), 1)
              return (
                <Link key={s} to={`/eventos?status=${encodeURIComponent(s)}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <div className="row between small" style={{ marginBottom: 4 }}>
                    <span className="row tight"><span className="dot" style={{ background: STATUS_HEX[s] }} />{s}</span>
                    <b className="num">{n}</b>
                  </div>
                  <div className="bar"><span style={{ width: `${(n / max) * 100}%`, background: STATUS_HEX[s] }} /></div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Em campo agora</h2>
        <Tabela eventos={data.em_andamento} vazio="Nenhum evento em montagem, execução ou desmontagem." mostrarCusto={isEscritorio} />
      </div>
      <div className="card">
        <h2>Próximos 30 dias</h2>
        <Tabela eventos={data.proximos} vazio="Nenhum evento planejado ou confirmado para os próximos 30 dias." mostrarCusto={isEscritorio} />
      </div>
    </>
  )
}
