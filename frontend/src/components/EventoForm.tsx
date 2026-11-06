import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Search } from 'lucide-react'
import { apiEventos, apiGeo, apiOpcoes, type Evento, type EventoIn, type GeoResultado } from '../api'
import { erroMsg, toInputDT } from '../utils/format'
import { MapaSeletor } from './Mapa'
import Modal from './Modal'

type Form = Record<keyof EventoIn, string>

function inicial(ev?: Evento | null): Form {
  const s = (v: unknown) => (v == null ? '' : String(v))
  return {
    numero_projeto: s(ev?.numero_projeto), nome: s(ev?.nome), cliente: s(ev?.cliente),
    tipo: ev?.tipo ?? 'Show', status: ev?.status ?? 'Planejado',
    inicio: toInputDT(ev?.inicio), fim: toInputDT(ev?.fim),
    evento_inicio: toInputDT(ev?.evento_inicio), evento_fim: toInputDT(ev?.evento_fim),
    endereco: s(ev?.endereco), cidade: s(ev?.cidade), uf: s(ev?.uf),
    latitude: s(ev?.latitude), longitude: s(ev?.longitude),
    orcamento_pessoas: s(ev?.orcamento_pessoas ?? 0), orcamento_materiais: s(ev?.orcamento_materiais ?? 0),
    orcamento_outros: s(ev?.orcamento_outros ?? 0),
    responsavel_id: s(ev?.responsavel_id), observacoes: s(ev?.observacoes),
  }
}

export default function EventoForm({ evento, onClose, onSalvo }: { evento?: Evento | null; onClose: () => void; onSalvo: (e: Evento) => void }) {
  const { data: opcoes } = useQuery({ queryKey: ['opcoes'], queryFn: apiOpcoes, staleTime: Infinity })
  const [f, setF] = useState<Form>(() => inicial(evento))
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<GeoResultado[] | null>(null)
  const [buscando, setBuscando] = useState(false)

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  async function buscar() {
    const q = busca.trim() || [f.endereco, f.cidade, f.uf].filter(Boolean).join(', ')
    if (q.length < 3) return setErro('Digite um endereço ou local para buscar.')
    setErro('')
    setBuscando(true)
    try {
      const r = await apiGeo(q)
      // Um único resultado: já marca no mapa; com vários, o usuário escolhe na lista.
      if (r.length === 1) escolher(r[0])
      else setResultados(r)
    } catch (e) {
      setErro(erroMsg(e))
    } finally {
      setBuscando(false)
    }
  }

  function escolher(r: GeoResultado) {
    setF((x) => ({
      ...x,
      latitude: r.latitude.toFixed(6), longitude: r.longitude.toFixed(6),
      cidade: x.cidade || r.cidade || '', uf: x.uf || r.uf || '',
      endereco: x.endereco || r.descricao.split(',').slice(0, 2).join(',').trim(),
    }))
    setResultados(null)
  }

  async function salvar() {
    setErro('')
    if (!f.nome.trim()) return setErro('Informe o nome do evento.')
    if (!f.inicio || !f.fim) return setErro('Informe o início e o fim da operação.')
    const nOuNull = (v: string) => (v === '' ? null : Number(v.replace(',', '.')))
    const payload: Partial<EventoIn> = {
      numero_projeto: f.numero_projeto || null, nome: f.nome.trim(), cliente: f.cliente || null,
      tipo: f.tipo, status: f.status, inicio: f.inicio, fim: f.fim,
      evento_inicio: f.evento_inicio || null, evento_fim: f.evento_fim || null,
      endereco: f.endereco || null, cidade: f.cidade || null, uf: f.uf ? f.uf.toUpperCase().slice(0, 2) : null,
      latitude: nOuNull(f.latitude), longitude: nOuNull(f.longitude),
      orcamento_pessoas: nOuNull(f.orcamento_pessoas) ?? 0, orcamento_materiais: nOuNull(f.orcamento_materiais) ?? 0,
      orcamento_outros: nOuNull(f.orcamento_outros) ?? 0,
      responsavel_id: f.responsavel_id || null, observacoes: f.observacoes || null,
    }
    setSalvando(true)
    try {
      const salvo = evento ? await apiEventos.atualizar(evento.id, payload) : await apiEventos.criar(payload)
      onSalvo(salvo)
    } catch (e) {
      setErro(erroMsg(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      wide
      titulo={evento ? `Editar · ${evento.nome}` : 'Novo evento'}
      onClose={onClose}
      footer={<>
        {erro && <span className="err grow">{erro}</span>}
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </>}
    >
      <div className="form">
        <label className="lbl full">Nome do evento *<input className="inp" value={f.nome} onChange={set('nome')} autoFocus /></label>
        <label className="lbl">Cliente<input className="inp" value={f.cliente} onChange={set('cliente')} /></label>
        <label className="lbl">Nº do projeto (CRM)<input className="inp" value={f.numero_projeto} onChange={set('numero_projeto')} placeholder="GF-2026-0000" /></label>
        <label className="lbl">Tipo
          <select className="inp" value={f.tipo} onChange={set('tipo')}>{opcoes?.tipos_evento.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label className="lbl">Status
          <select className="inp" value={f.status} onChange={set('status')}>{opcoes?.status_evento.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
      </div>

      <h3>Datas</h3>
      <div className="form">
        <label className="lbl">Início da operação (montagem) *<input className="inp" type="datetime-local" value={f.inicio} onChange={set('inicio')} /></label>
        <label className="lbl">Fim da operação (desmontagem) *<input className="inp" type="datetime-local" value={f.fim} onChange={set('fim')} /></label>
        <label className="lbl">Abertura ao público<input className="inp" type="datetime-local" value={f.evento_inicio} onChange={set('evento_inicio')} /></label>
        <label className="lbl">Encerramento ao público<input className="inp" type="datetime-local" value={f.evento_fim} onChange={set('evento_fim')} /></label>
      </div>

      <h3>Localização</h3>
      <div className="form">
        <label className="lbl full">Endereço / local<input className="inp" value={f.endereco} onChange={set('endereco')} /></label>
        <label className="lbl">Cidade<input className="inp" value={f.cidade} onChange={set('cidade')} /></label>
        <label className="lbl">UF<input className="inp" value={f.uf} maxLength={2} onChange={set('uf')} /></label>
      </div>
      <div className="row tight">
        <input
          className="inp grow" style={{ flex: '1 1 240px' }} value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar no mapa (ex.: Allianz Parque, São Paulo) — vazio usa o endereço acima"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscar() } }}
        />
        <button className="btn" onClick={buscar} disabled={buscando}><Search size={16} />{buscando ? 'Buscando…' : 'Buscar'}</button>
      </div>
      {resultados && (
        <div className="card" style={{ padding: 8 }}>
          {resultados.length === 0 && <div className="muted small" style={{ padding: 8 }}>Nada encontrado. Tente outro termo ou clique no mapa.</div>}
          {resultados.length > 1 && <div className="small" style={{ padding: '4px 8px', fontWeight: 600 }}>Clique no local correto para marcar no mapa:</div>}
          {resultados.map((r, i) => (
            <button key={i} className="btn ghost" style={{ width: '100%', justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left', fontWeight: 500, minHeight: 40 }} onClick={() => escolher(r)}>
              <MapPin size={15} style={{ flexShrink: 0 }} />{r.descricao}
            </button>
          ))}
        </div>
      )}
      <MapaSeletor
        latitude={f.latitude ? Number(f.latitude) : null}
        longitude={f.longitude ? Number(f.longitude) : null}
        status={f.status}
        onChange={(lat, lng) => setF((x) => ({ ...x, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))}
      />
      <div className="small muted">
        Clique no mapa ou arraste o marcador para ajustar o ponto exato (útil em áreas sem endereço formal).
        {f.latitude
          ? <span className="num"> · {f.latitude}, {f.longitude}</span>
          : <span style={{ color: '#C43600', fontWeight: 600 }}> · Ponto ainda não marcado: ao salvar, o sistema localiza pelo endereço/cidade.</span>}
      </div>

      <h3>Orçamento previsto</h3>
      <div className="form">
        <label className="lbl">Pessoas (R$)<input className="inp num" inputMode="decimal" value={f.orcamento_pessoas} onChange={set('orcamento_pessoas')} /></label>
        <label className="lbl">Materiais (R$)<input className="inp num" inputMode="decimal" value={f.orcamento_materiais} onChange={set('orcamento_materiais')} /></label>
        <label className="lbl">Outros custos (R$)<input className="inp num" inputMode="decimal" value={f.orcamento_outros} onChange={set('orcamento_outros')} /></label>
        <label className="lbl full">Observações<textarea className="inp" value={f.observacoes} onChange={set('observacoes')} /></label>
      </div>
    </Modal>
  )
}
