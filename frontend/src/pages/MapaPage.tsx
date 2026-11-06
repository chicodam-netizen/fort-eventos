import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiPainel } from '../api'
import { MapaEventos } from '../components/Mapa'
import { STATUS_HEX, STATUS_ORDEM } from '../utils/format'

const PADRAO = ['Planejado', 'Confirmado', 'Montagem', 'Em execução', 'Desmontagem']

export default function MapaPage() {
  const { data, isLoading } = useQuery({ queryKey: ['painel'], queryFn: apiPainel, refetchInterval: 60_000 })
  const [filtro, setFiltro] = useState<string[]>(PADRAO)

  const toggle = (s: string) => setFiltro((f) => (f.includes(s) ? f.filter((x) => x !== s) : [...f, s]))
  const eventos = (data?.eventos ?? []).filter((e) => filtro.includes(e.status))

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Mapa de eventos</h1>
          <p className="sub">Localização e status de cada operação. Clique num ponto para abrir o evento.</p>
        </div>
      </div>
      <div className="row tight">
        {STATUS_ORDEM.map((s) => (
          <label key={s} className="check btn sm" style={filtro.includes(s) ? { borderColor: STATUS_HEX[s] } : { opacity: .6 }}>
            <input type="checkbox" checked={filtro.includes(s)} onChange={() => toggle(s)} style={{ accentColor: STATUS_HEX[s] }} />
            {s} <span className="muted num">{data?.por_status[s] ?? 0}</span>
          </label>
        ))}
      </div>
      <div className="card">
        {isLoading ? <div className="spinner" /> : <MapaEventos eventos={eventos} className="map tall" />}
      </div>
    </>
  )
}
