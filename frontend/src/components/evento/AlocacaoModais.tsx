import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import {
  apiAlocacoes, apiEquipes, apiFuncoes, apiPrestadores,
  type Alocacao, type Conflito, type Equipe, type Evento,
} from '../../api'
import { useAuth } from '../../context/AuthContext'
import { agoraInput, brl, dataHora, erroMsg, FORMA_LABEL, parse, toInputDT } from '../../utils/format'
import Modal from '../Modal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function conflitosDoErro(e: any): Conflito[] | null {
  const d = e?.response?.data?.detail
  return e?.response?.status === 409 && d?.conflitos ? d.conflitos : null
}

function AvisoConflito({ conflitos }: { conflitos: Conflito[] }) {
  return (
    <div className="alert warn">
      <div className="row tight" style={{ fontWeight: 700, marginBottom: 6 }}><AlertTriangle size={16} />O prestador já está alocado nesse período:</div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {conflitos.map((c, i) => (
          <li key={i}>{c.evento_nome} · {c.equipe_nome} — <span className="num">{dataHora(c.inicio)} → {dataHora(c.fim)}</span></li>
        ))}
      </ul>
      <div style={{ marginTop: 6 }}>Ajuste o período, mova-o de lá primeiro, ou confirme para manter as duas alocações.</div>
    </div>
  )
}

/** Sugere início = agora (se o evento já começou) ou início do evento. */
function inicioSugerido(ev: Evento): string {
  const agora = new Date()
  const ini = parse(ev.inicio), fim = parse(ev.fim)
  if (agora > ini && agora < fim) return agoraInput()
  return toInputDT(ev.inicio)
}

// ─── Adicionar prestador ─────────────────────────────────────────────────────

export function AlocarModal({ evento, equipe, onClose, onSalvo }: { evento: Evento; equipe: Equipe; onClose: () => void; onSalvo: () => void }) {
  const { isEscritorio } = useAuth()
  const [inicio, setInicio] = useState(inicioSugerido(evento))
  const [fim, setFim] = useState(toInputDT(evento.fim))
  const [busca, setBusca] = useState('')
  const [prestadorId, setPrestadorId] = useState('')
  const [funcaoId, setFuncaoId] = useState('')
  const [valor, setValor] = useState('')
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [conflitos, setConflitos] = useState<Conflito[] | null>(null)
  const [salvando, setSalvando] = useState(false)

  const { data: prestadores = [] } = useQuery({ queryKey: ['prestadores', 'Ativo'], queryFn: () => apiPrestadores.listar({ status: 'Ativo' }) })
  const { data: funcoes = [] } = useQuery({ queryKey: ['funcoes'], queryFn: apiFuncoes.listar })
  const periodoOk = inicio && fim && inicio < fim
  const { data: ocupados = {} } = useQuery({
    queryKey: ['disponibilidade', inicio, fim],
    queryFn: () => apiPrestadores.disponibilidade(inicio, fim),
    enabled: !!periodoOk,
  })

  const jaNaEquipe = new Set(equipe.alocacoes.filter((a) => a.situacao !== 'encerrada').map((a) => a.prestador_id))
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return prestadores
      .filter((p) => !t || p.nome.toLowerCase().includes(t) || (p.funcao_nome ?? '').toLowerCase().includes(t) || (p.empresa ?? '').toLowerCase().includes(t))
      .sort((a, b) => Number(!!ocupados[a.id]) - Number(!!ocupados[b.id]) || a.nome.localeCompare(b.nome))
  }, [prestadores, busca, ocupados])
  const sel = prestadores.find((p) => p.id === prestadorId)

  function escolher(id: string) {
    const p = prestadores.find((x) => x.id === id)
    setPrestadorId(id)
    setFuncaoId(p?.funcao_id ?? '')
    setValor(p ? String(p.valor_custo) : '')
    setConflitos(null)
  }

  async function salvar(forcar = false) {
    setErro('')
    if (!prestadorId) return setErro('Escolha um prestador.')
    if (!periodoOk) return setErro('O fim precisa ser depois do início.')
    setSalvando(true)
    try {
      await apiAlocacoes.criar(equipe.id, {
        prestador_id: prestadorId, inicio, fim, funcao_id: funcaoId || null, observacao: obs || null, forcar,
        ...(isEscritorio && valor !== '' ? { valor_custo: Number(valor.replace(',', '.')) } : {}),
      })
      onSalvo()
    } catch (e) {
      const c = conflitosDoErro(e)
      if (c) setConflitos(c)
      else setErro(erroMsg(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      wide
      titulo={`Adicionar prestador · ${equipe.nome}`}
      onClose={onClose}
      footer={<>
        {erro && <span className="err grow">{erro}</span>}
        <button className="btn" onClick={onClose}>Cancelar</button>
        {conflitos
          ? <button className="btn pri" onClick={() => salvar(true)} disabled={salvando}>Alocar mesmo assim</button>
          : <button className="btn pri" onClick={() => salvar()} disabled={salvando}>Alocar</button>}
      </>}
    >
      <div className="form">
        <label className="lbl">Entra em<input className="inp" type="datetime-local" value={inicio} onChange={(e) => { setInicio(e.target.value); setConflitos(null) }} /></label>
        <label className="lbl">Sai em<input className="inp" type="datetime-local" value={fim} onChange={(e) => { setFim(e.target.value); setConflitos(null) }} /></label>
      </div>
      <input className="inp" placeholder="Buscar prestador por nome, função ou empresa" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
      <div className="card flush" style={{ maxHeight: 280, overflowY: 'auto' }}>
        <table className="tbl">
          <tbody>
            {lista.map((p) => {
              const oc = ocupados[p.id]
              const na = jaNaEquipe.has(p.id)
              return (
                <tr key={p.id} className="click" onClick={() => escolher(p.id)} style={p.id === prestadorId ? { outline: '2px solid var(--brand)', outlineOffset: -2 } : undefined}>
                  <td style={{ width: 28 }}><input type="radio" checked={p.id === prestadorId} readOnly /></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.nome}</div>
                    <div className="small muted">{p.funcao_nome ?? 'Sem função'} · {p.tipo_vinculo}{p.empresa ? ` · ${p.empresa}` : ''}</div>
                  </td>
                  <td className="r">
                    {na ? <span className="pill brand">Já nesta equipe</span>
                      : oc ? <span className="pill warn" title={oc.map((c) => `${c.evento_nome} · ${c.equipe_nome}`).join('\n')}>Ocupado: {oc[0].evento_nome}{oc.length > 1 ? ` +${oc.length - 1}` : ''}</span>
                        : periodoOk ? <span className="pill ok">Disponível</span> : null}
                  </td>
                </tr>
              )
            })}
            {lista.length === 0 && <tr><td className="muted" style={{ padding: 16 }}>Nenhum prestador ativo encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
      {sel && (
        <div className="form">
          <label className="lbl">Função neste evento
            <select className="inp" value={funcaoId} onChange={(e) => setFuncaoId(e.target.value)}>
              <option value="">—</option>
              {funcoes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </label>
          {isEscritorio && (
            <label className="lbl">Valor {FORMA_LABEL[sel.forma_custo]} (R$)
              <input className="inp num" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            </label>
          )}
          <label className="lbl full">Observação<input className="inp" value={obs} onChange={(e) => setObs(e.target.value)} /></label>
        </div>
      )}
      {conflitos && <AvisoConflito conflitos={conflitos} />}
    </Modal>
  )
}

// ─── Mover ───────────────────────────────────────────────────────────────────

export function MoverModal({ alocacao, destinoInicial, onClose, onSalvo }: {
  alocacao: Alocacao; destinoInicial?: string; onClose: () => void; onSalvo: (msg: string) => void
}) {
  const { data: destinos = [] } = useQuery({ queryKey: ['equipes-destino'], queryFn: apiEquipes.destinos })
  const [destino, setDestino] = useState(destinoInicial ?? '')
  const naoComecou = parse(alocacao.inicio) > new Date()
  const [momento, setMomento] = useState(naoComecou ? toInputDT(alocacao.inicio) : agoraInput())
  const [fim, setFim] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [conflitos, setConflitos] = useState<Conflito[] | null>(null)
  const [salvando, setSalvando] = useState(false)

  const grupos = useMemo(() => {
    const g = new Map<string, typeof destinos>()
    destinos.filter((d) => d.id !== alocacao.equipe_id).forEach((d) => {
      g.set(d.evento_id, [...(g.get(d.evento_id) ?? []), d])
    })
    return [...g.values()]
  }, [destinos, alocacao.equipe_id])
  const dest = destinos.find((d) => d.id === destino)
  const outroEvento = dest && dest.evento_id !== alocacao.evento_id
  const fimPadrao = dest ? (outroEvento ? dest.evento_fim : alocacao.fim) : null

  async function salvar(forcar = false) {
    setErro('')
    if (!destino) return setErro('Escolha a equipe de destino.')
    setSalvando(true)
    try {
      const r = await apiAlocacoes.mover(alocacao.id, { equipe_destino_id: destino, momento, fim: fim || null, motivo: motivo || null, forcar })
      onSalvo(r.transferida
        ? `${alocacao.prestador_nome} transferido para ${dest?.nome}.`
        : `${alocacao.prestador_nome} movido para ${dest?.nome} a partir de ${dataHora(momento)}.`)
    } catch (e) {
      const c = conflitosDoErro(e)
      if (c) setConflitos(c)
      else setErro(erroMsg(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      titulo={`Mover ${alocacao.prestador_nome}`}
      onClose={onClose}
      footer={<>
        {erro && <span className="err grow">{erro}</span>}
        <button className="btn" onClick={onClose}>Cancelar</button>
        {conflitos
          ? <button className="btn pri" onClick={() => salvar(true)} disabled={salvando}>Mover mesmo assim</button>
          : <button className="btn pri" onClick={() => salvar()} disabled={salvando}>Mover</button>}
      </>}
    >
      <div className="alert info small">
        Hoje em <b>{alocacao.equipe_nome}</b> ({alocacao.evento_nome}), de <span className="num">{dataHora(alocacao.inicio)}</span> a <span className="num">{dataHora(alocacao.fim)}</span>.
        {' '}O período até o momento da troca fica registrado na equipe atual; o custo é dividido entre as duas.
      </div>
      <label className="lbl">Equipe de destino
        <select className="inp" value={destino} onChange={(e) => { setDestino(e.target.value); setConflitos(null) }} autoFocus>
          <option value="">Escolha…</option>
          {grupos.map((g) => (
            <optgroup key={g[0].evento_id} label={`${g[0].evento_nome}${g[0].evento_id === alocacao.evento_id ? ' (este evento)' : ` · ${g[0].evento_status}`}`}>
              {g.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <div className="form">
        <label className="lbl">A partir de
          <input className="inp" type="datetime-local" value={momento} onChange={(e) => { setMomento(e.target.value); setConflitos(null) }} />
        </label>
        <label className="lbl">Fica na nova equipe até
          <input className="inp" type="datetime-local" value={fim} onChange={(e) => { setFim(e.target.value); setConflitos(null) }} />
          <span className="small muted">Vazio = {fimPadrao ? dataHora(fimPadrao) : '—'} {outroEvento ? '(fim do evento destino)' : '(mesmo fim de hoje)'}</span>
        </label>
      </div>
      <label className="lbl">Motivo<input className="inp" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: reforço na montagem da iluminação" /></label>
      {conflitos && <AvisoConflito conflitos={conflitos} />}
    </Modal>
  )
}

// ─── Retirar ─────────────────────────────────────────────────────────────────

export function RetirarModal({ alocacao, onClose, onSalvo }: { alocacao: Alocacao; onClose: () => void; onSalvo: () => void }) {
  const [momento, setMomento] = useState(agoraInput())
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setErro('')
    setSalvando(true)
    try {
      await apiAlocacoes.retirar(alocacao.id, { momento, motivo: motivo || null })
      onSalvo()
    } catch (e) {
      setErro(erroMsg(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      titulo={`Retirar ${alocacao.prestador_nome}`}
      onClose={onClose}
      footer={<>
        {erro && <span className="err grow">{erro}</span>}
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn no" onClick={salvar} disabled={salvando}>Retirar da equipe</button>
      </>}
    >
      <p className="muted" style={{ margin: 0 }}>
        Encerra a participação em <b>{alocacao.equipe_nome}</b> no momento informado. O período já trabalhado continua registrado (e no custo).
        Para enviá-lo a outra equipe ou evento, use <b>Mover</b>.
      </p>
      <label className="lbl">Sai em<input className="inp" type="datetime-local" value={momento} onChange={(e) => setMomento(e.target.value)} autoFocus /></label>
      <label className="lbl">Motivo<input className="inp" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: dispensado após a montagem" /></label>
    </Modal>
  )
}

// ─── Editar ──────────────────────────────────────────────────────────────────

export function EditarAlocacaoModal({ alocacao, onClose, onSalvo }: { alocacao: Alocacao; onClose: () => void; onSalvo: () => void }) {
  const { isEscritorio } = useAuth()
  const { data: funcoes = [] } = useQuery({ queryKey: ['funcoes'], queryFn: apiFuncoes.listar })
  const [inicio, setInicio] = useState(toInputDT(alocacao.inicio))
  const [fim, setFim] = useState(toInputDT(alocacao.fim))
  const [funcaoId, setFuncaoId] = useState(alocacao.funcao_id ?? '')
  const [forma, setForma] = useState(alocacao.forma_custo)
  const [valor, setValor] = useState(String(alocacao.valor_custo))
  const [obs, setObs] = useState(alocacao.observacao ?? '')
  const [erro, setErro] = useState('')
  const [conflitos, setConflitos] = useState<Conflito[] | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(forcar = false) {
    setErro('')
    setSalvando(true)
    try {
      await apiAlocacoes.editar(alocacao.id, {
        inicio, fim, funcao_id: funcaoId || null, observacao: obs || null, forcar,
        ...(isEscritorio ? { forma_custo: forma, valor_custo: Number(valor.replace(',', '.')) } : {}),
      })
      onSalvo()
    } catch (e) {
      const c = conflitosDoErro(e)
      if (c) setConflitos(c)
      else setErro(erroMsg(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      titulo={`Editar alocação · ${alocacao.prestador_nome}`}
      onClose={onClose}
      footer={<>
        {erro && <span className="err grow">{erro}</span>}
        <button className="btn" onClick={onClose}>Cancelar</button>
        {conflitos
          ? <button className="btn pri" onClick={() => salvar(true)} disabled={salvando}>Salvar mesmo assim</button>
          : <button className="btn pri" onClick={() => salvar()} disabled={salvando}>Salvar</button>}
      </>}
    >
      <div className="form">
        <label className="lbl">Entrada<input className="inp" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
        <label className="lbl">Saída<input className="inp" type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
        <label className="lbl">Função
          <select className="inp" value={funcaoId} onChange={(e) => setFuncaoId(e.target.value)}>
            <option value="">—</option>
            {funcoes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </label>
        {isEscritorio && (
          <>
            <label className="lbl">Forma de custo
              <select className="inp" value={forma} onChange={(e) => setForma(e.target.value)}>
                <option value="diaria">Por diária</option>
                <option value="hora">Por hora</option>
              </select>
            </label>
            <label className="lbl">Valor (R$)<input className="inp num" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></label>
            <div className="lbl"><span>Custo apurado</span><span className="num" style={{ fontWeight: 600, paddingTop: 8 }}>{brl(alocacao.custo)}</span></div>
          </>
        )}
        <label className="lbl full">Observação<input className="inp" value={obs} onChange={(e) => setObs(e.target.value)} /></label>
      </div>
      {conflitos && <AvisoConflito conflitos={conflitos} />}
    </Modal>
  )
}
