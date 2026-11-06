import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { apiCustosExtras, apiEventos, apiOpcoes, apiPrestadores, type CustoExtra, type Evento } from '../../api'
import { brl, brl0, data, erroMsg, toInputD } from '../../utils/format'
import Modal from '../Modal'
import { useToast } from '../Toast'

function Comparativo({ titulo, previsto, realizado }: { titulo: string; previsto: number; realizado: number }) {
  const max = Math.max(previsto, realizado, 1)
  const over = previsto > 0 && realizado > previsto
  const pct = previsto > 0 ? Math.round((realizado / previsto) * 100) : null
  return (
    <div className="card">
      <div className="row between">
        <span className="k">{titulo}</span>
        {pct != null && <span className={`pill ${over ? 'bad' : pct > 85 ? 'warn' : 'ok'}`}>{pct}% do previsto</span>}
      </div>
      <div className="v" style={{ fontSize: 22, color: over ? 'var(--bad)' : undefined }}>{brl0(realizado)}</div>
      <div className="cmp small" style={{ marginTop: 10 }}>
        <span className="muted">Realizado</span>
        <div className={`bar${over ? ' over' : ''}`}><span style={{ width: `${(realizado / max) * 100}%` }} /></div>
        <span className="muted">Previsto</span>
        <div className="bar"><span style={{ width: `${(previsto / max) * 100}%`, background: '#3A3A3A' }} /></div>
      </div>
      <div className="small muted num" style={{ marginTop: 6 }}>previsto {brl0(previsto)} · {over ? 'acima' : 'saldo'} {brl0(Math.abs(previsto - realizado))}</div>
    </div>
  )
}

function ExtraModal({ evento, item, onClose, onSalvo }: { evento: Evento; item?: CustoExtra; onClose: () => void; onSalvo: () => void }) {
  const { data: opcoes } = useQuery({ queryKey: ['opcoes'], queryFn: apiOpcoes, staleTime: Infinity })
  const { data: prestadores = [] } = useQuery({ queryKey: ['prestadores', 'todos'], queryFn: () => apiPrestadores.listar() })
  const [categoria, setCategoria] = useState(item?.categoria ?? 'Alimentação')
  const [descricao, setDescricao] = useState(item?.descricao ?? '')
  const [dt, setDt] = useState(item?.data ? toInputD(item.data) : toInputD(new Date()))
  const [valor, setValor] = useState(item ? String(item.valor) : '')
  const [prestador, setPrestador] = useState(item?.prestador_id ?? '')
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!descricao.trim()) return setErro('Informe a descrição.')
    const body = { categoria, descricao, data: dt || null, valor: Number(valor.replace(',', '.') || 0), prestador_id: prestador || null }
    try {
      if (item) await apiCustosExtras.editar(item.id, body)
      else await apiCustosExtras.criar(evento.id, body)
      onSalvo()
    } catch (e) {
      setErro(erroMsg(e))
    }
  }

  return (
    <Modal titulo={item ? 'Editar custo' : 'Novo custo do evento'} onClose={onClose} footer={<>
      {erro && <span className="err grow">{erro}</span>}
      <button className="btn" onClick={onClose}>Cancelar</button>
      <button className="btn pri" onClick={salvar}>Salvar</button>
    </>}>
      <div className="form">
        <label className="lbl">Categoria
          <select className="inp" value={categoria} onChange={(e) => setCategoria(e.target.value)}>{opcoes?.categorias_custo.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="lbl">Data<input className="inp" type="date" value={dt} onChange={(e) => setDt(e.target.value)} /></label>
        <label className="lbl full">Descrição<input className="inp" value={descricao} onChange={(e) => setDescricao(e.target.value)} autoFocus /></label>
        <label className="lbl">Valor (R$)<input className="inp num" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></label>
        <label className="lbl">Prestador (opcional)
          <select className="inp" value={prestador} onChange={(e) => setPrestador(e.target.value)}>
            <option value="">—</option>
            {prestadores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
      </div>
    </Modal>
  )
}

export default function CustosTab({ evento }: { evento: Evento }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ item?: CustoExtra } | null>(null)
  const { data: r } = useQuery({ queryKey: ['custos', evento.id], queryFn: () => apiEventos.custos(evento.id) })
  const { data: extras = [] } = useQuery({ queryKey: ['extras', evento.id], queryFn: () => apiCustosExtras.listar(evento.id) })

  function atualizar(msg: string) {
    setModal(null)
    qc.invalidateQueries({ queryKey: ['extras', evento.id] })
    qc.invalidateQueries({ queryKey: ['custos', evento.id] })
    qc.invalidateQueries({ queryKey: ['evento', evento.id] })
    toast(msg)
  }

  async function excluir(c: CustoExtra) {
    if (!confirm(`Excluir "${c.descricao}"?`)) return
    try {
      await apiCustosExtras.excluir(c.id)
      atualizar('Custo excluído.')
    } catch (e) {
      toast(erroMsg(e), 'error')
    }
  }

  if (!r) return <div className="spinner" />

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="g4">
        <Comparativo titulo="Total do evento" previsto={r.total_previsto} realizado={r.total_realizado} />
        <Comparativo titulo="Pessoas" previsto={r.pessoas_previsto} realizado={r.pessoas_realizado} />
        <Comparativo titulo="Materiais" previsto={r.materiais_previsto} realizado={r.materiais_realizado} />
        <Comparativo titulo="Outros custos" previsto={r.outros_previsto} realizado={r.outros_realizado} />
      </div>
      <div className="small muted">
        Pessoas: uma diária por dia trabalhado; se o prestador mudou de equipe ou de evento no mesmo dia, a diária é dividida pelas horas em cada um.
        Prestadores por hora: horas alocadas × valor. Inclui o período programado até o fim de cada alocação.
      </div>

      <div className="g2">
        <div className="card">
          <h2>Pessoas por equipe</h2>
          <table className="tbl">
            <thead><tr><th>Equipe</th><th className="r">Pessoas</th><th className="r">Custo</th></tr></thead>
            <tbody>
              {r.por_equipe.map((e) => <tr key={e.equipe}><td>{e.equipe}</td><td className="r num">{e.pessoas}</td><td className="r num">{brl(e.valor)}</td></tr>)}
              <tr className="tot"><td>Total</td><td /><td className="r num">{brl(r.pessoas_realizado)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Materiais por categoria</h2>
          {r.por_categoria_material.length === 0 ? <div className="empty">Sem materiais.</div> : (
            <table className="tbl">
              <tbody>
                {r.por_categoria_material.map((c) => <tr key={c.categoria}><td>{c.categoria}</td><td className="r num">{brl(c.valor)}</td></tr>)}
                <tr className="tot"><td>Total</td><td className="r num">{brl(r.materiais_realizado)}</td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Outros custos</h2>
          <button className="btn sm pri" onClick={() => setModal({})}><Plus size={15} />Lançar custo</button>
        </div>
        {extras.length === 0 ? <div className="empty">Alimentação, transporte, hospedagem, frete, horas extras… nada lançado ainda.</div> : (
          <div className="scroll">
            <table className="tbl">
              <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Prestador</th><th className="r">Valor</th><th /></tr></thead>
              <tbody>
                {extras.map((c) => (
                  <tr key={c.id}>
                    <td className="num small">{data(c.data)}</td>
                    <td><span className="pill">{c.categoria}</span></td>
                    <td>{c.descricao}</td>
                    <td className="small">{c.prestador_nome ?? '—'}</td>
                    <td className="r num">{brl(c.valor)}</td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn ghost icon" title="Editar" onClick={() => setModal({ item: c })}><Pencil size={14} /></button>
                      <button className="btn ghost icon" title="Excluir" onClick={() => excluir(c)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
                <tr className="tot"><td colSpan={4}>Total</td><td className="r num">{brl(r.outros_realizado)}</td><td /></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modal && <ExtraModal evento={evento} item={modal.item} onClose={() => setModal(null)} onSalvo={() => atualizar(modal.item ? 'Custo atualizado.' : 'Custo lançado.')} />}
    </div>
  )
}
