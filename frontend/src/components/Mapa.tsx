import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { Link } from 'react-router-dom'
import type { EquipeResumo } from '../api'
import { STATUS_EM_CAMPO, STATUS_HEX, STATUS_ORDEM, periodo } from '../utils/format'

const BRASIL: [number, number] = [-15.8, -50.5]
const TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

function pin(status: string) {
  const cor = STATUS_HEX[status] ?? '#888'
  const pulse = status === 'Em execução' ? ' pulse' : ''
  return L.divIcon({
    className: '',
    html: `<div class="pin${pulse}" style="background:${cor}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  })
}

export interface PontoEvento {
  id: string
  nome: string
  status: string
  inicio: string
  fim: string
  cidade?: string | null
  uf?: string | null
  cliente?: string | null
  latitude?: number | null
  longitude?: number | null
  pessoas_agora?: number
  equipes_resumo?: EquipeResumo[]
}

function Enquadrar({ pontos }: { pontos: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (pontos.length === 1) map.setView(pontos[0], 11)
    else if (pontos.length > 1) map.fitBounds(L.latLngBounds(pontos), { padding: [40, 40], maxZoom: 11 })
  }, [map, pontos])
  return null
}

export function MapaEventos({ eventos, className = 'map' }: { eventos: PontoEvento[]; className?: string }) {
  const comLocal = eventos.filter((e) => e.latitude != null && e.longitude != null)
  const pontos = useMemo<[number, number][]>(
    () => comLocal.map((e) => [e.latitude!, e.longitude!]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comLocal.map((e) => e.id).join()],
  )
  return (
    <div className="stack" style={{ gap: 8 }}>
      <MapContainer center={BRASIL} zoom={4} className={className} scrollWheelZoom>
        <TileLayer url={TILE} attribution={ATTR} />
        <Enquadrar pontos={pontos} />
        {comLocal.map((e) => (
          <Marker key={e.id} position={[e.latitude!, e.longitude!]} icon={pin(e.status)}>
            <Popup>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
                <Link to={`/eventos/${e.id}`} style={{ fontWeight: 700, fontSize: 14 }}>{e.nome}</Link>
                <span>{e.status} · {periodo(e.inicio, e.fim)}</span>
                {e.cidade && <span>{e.cidade}{e.uf ? `/${e.uf}` : ''}</span>}
                {e.cliente && <span style={{ color: '#5E5E5E' }}>{e.cliente}</span>}
                {STATUS_EM_CAMPO.includes(e.status) && e.pessoas_agora != null && (
                  <span><b>{e.pessoas_agora}</b> pessoas em campo agora</span>
                )}
              </div>
            </Popup>
            <Tooltip direction="top" offset={[0, -10]} opacity={1} className="map-tip">
              <div className="tip-nome">{e.nome}</div>
              <div className="tip-sub">
                {e.status} · {periodo(e.inicio, e.fim)}
                {e.cidade && <> · {e.cidade}{e.uf ? `/${e.uf}` : ''}</>}
              </div>
              {e.equipes_resumo && e.equipes_resumo.length > 0 ? (
                <ul className="tip-equipes">
                  {e.equipes_resumo.map((q, i) => (
                    <li key={i}>
                      <span className="dot" style={{ background: q.cor || '#888' }} />
                      <b>{q.nome}</b>
                      <span className="tip-qtd">
                        {STATUS_EM_CAMPO.includes(e.status) ? `${q.pessoas_agora} agora` : `${q.pessoas_total} pessoas`}
                      </span>
                      {q.lider_nome && <div className="tip-lider">Líder: {q.lider_nome}</div>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="tip-sub">Nenhuma equipe montada</div>
              )}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
      <div className="legend">
        {STATUS_ORDEM.map((s) => (
          <span key={s}><span className="dot" style={{ background: STATUS_HEX[s] }} />{s}</span>
        ))}
        {eventos.length > comLocal.length && <span>· {eventos.length - comLocal.length} sem localização</span>}
      </div>
    </div>
  )
}

function CliqueParaMarcar({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

function Centralizar({ pos }: { pos: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (pos) map.setView(pos, Math.max(map.getZoom(), 14))
  }, [map, pos])
  return null
}

/** Mapa para escolher a localização: clique no mapa ou arraste o marcador. */
export function MapaSeletor({
  latitude, longitude, status, onChange,
}: { latitude?: number | null; longitude?: number | null; status: string; onChange: (lat: number, lng: number) => void }) {
  const pos: [number, number] | null = latitude != null && longitude != null ? [latitude, longitude] : null
  const posKey = pos ? `${pos[0].toFixed(5)},${pos[1].toFixed(5)}` : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const centro = useMemo(() => pos, [posKey])
  return (
    <MapContainer center={pos ?? BRASIL} zoom={pos ? 14 : 4} className="map short" scrollWheelZoom>
      <TileLayer url={TILE} attribution={ATTR} />
      <CliqueParaMarcar onPick={onChange} />
      <Centralizar pos={centro} />
      {pos && (
        <Marker
          position={pos}
          icon={pin(status)}
          draggable
          eventHandlers={{ dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); onChange(ll.lat, ll.lng) } }}
        />
      )}
    </MapContainer>
  )
}
