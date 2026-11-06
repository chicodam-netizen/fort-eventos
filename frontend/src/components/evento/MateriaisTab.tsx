import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { apiMateriais, apiMateriaisEvento, type Evento, type MaterialEvento } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { brl, data, erroMsg, num, TIPO_MAT_LABEL, toInputD } from '../../utils/format'
import Modal from '../Modal'
import { useToast } from '../Toast'

function ItemModal({ evento, item, onClose, onSalvo }: { evento: Evento; item?: MaterialEvento; onClose: () => void; onSalvo: () => void }) {
  const { data: catalogo = [] } = useQuery({ queryKey: ['materiais'], queryFn: () => apiMateriais.listar() })
  const [materialId, setMaterialId] = useState(item?.material_id ?? '')
  const [busca, setBusca] = useState('')
  const [qtd, setQtd] = useState(item ? String(item.quantidade) : '1')
  const [ini, setIni] = useState(item?.inicio ? toInputD(item.inicio) : '')
  const [fim, setFim] = useState(item?.fim ? toInputD(item.fim) : '')
  const [custo, setCusto] = useState(item ? String(item.custo_unitario) : '')
  const [obs, setObs] = useState(item?.observacao ?? '')
  const [erro, setErro] = useState('')

  const ativos = catalogo.filter((m) => m.ativo || m.id === materialId)
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return ativos.filter((m) => !t || m.nome.toLowerCase().includes(t) || m.codigo.toLowerCase().includes(t) || m.categoria.toLowerCase().includes(t))
  }, [ativos, busca])
  const sel = catalogo.find((m) => m.id === materialId)
  const diaria = sel?.cobranca === 'diaria'
  // Sem datas, usa o período da operação (mesma regra do backend). 'AAAA-MM-DD' é lido como UTC nos dois lados.
  const d0 = ini || evento.inicio.slice(0, 10)
  const d1 = fim || evento.fim.slice(0, 10)
  const dias = diaria ? Math.max(Math.round((Date.parse(d1) - Date.parse(d0)) / 86400000) + 1, 1) : 0
  const unit = custo !== '' ? Number(custo.replace(',', '.')) : sel?.custo_unitario ?? 0
  const total = Number(qtd.replace(',', '.') || 0) * unit * (diaria ? dias : 1)

  async function salvar() {
    setErro('')
    if (!materialId) return setErro('Escolha um material.')
    const body = {
      material_id: materialId, quantidade: Number(qtd.replace(',', '.')),
      inicio: diaria && ini ? ini : null, fim: diaria && fim ? fim : null,
      custo_unitario: custo !== '' ? Number(custo.replace(',', '.')) : null, observacao: obs || null,
    }
    try {
      if (item) await apiMateriaisEvento.editar(item.id, body)
      else await apiMateriaisEvento.criar(evento.id, body)
      onSalvo()
    } catch (e) {
      setErro(erroMsg(e))
    }
  }

  return (
    <Modal wide titulo={item ? 'Editar material do evento' : 'Adicionar material ao evento'} onClose={onClose} footer={<>
      {erro && <span className="err grow">{erro}</span>}
      <button className="btn" onClick={onClose}>Cancelar</button>
      <button className="btn pri" onClick={salvar}>Salvar</button>
    </>}>
      {!item && (
        <>
          <input className="inp" placeholder="Buscar no cadastro de materiais" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
          <div className="card flush" style={{ maxHeight: 240, overflowY: 'auto' }}>
            <table className="tbl">
              <tbody>
                {filtrados.map((m) => (
                  <tr key={m.id} className="click" onClick={() => { setMaterialId(m.id); setCusto(String(m.custo_unitario)) }}
                    style={m.id === materialId ? { outline: '2px solid var(--brand)', outlineOffset: -2 } : undefined}>
                    <td className="mono small">{m.codigo}</td>
                    <td><div style={{ fontWeight: 600 }}>{m.nome}</div><div className="small muted">{m.categoria} · {TIPO_MAT_LABEL[m.tipo]}</div></td>
                    <td className="r num small">{brl(m.custo_unitario)} {m.cobranca === 'diaria' ? '/dia' : `/${m.unidade}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {sel && (
        <>
          <div className="alert info small"><b>{sel.codigo} · {sel.nome}</b> — {TIPO_MAT_LABEL[sel.tipo]}, cobrado {diaria ? 'por diária' : `por ${sel.unidade}`}
            {sel.qtd_propria != null && <> · {sel.qtd_propria} em estoque próprio</>}</div>
          <div className="form">
            <label className="lbl">Quantidade ({sel.unidade})<input className="inp num" inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} /></label>
            <label className="lbl">Custo unitário {diaria ? 'por dia' : ''} (R$)<input className="inp num" inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} /></label>
            {diaria && (
              <>
                <label className="lbl">De<input className="inp" type="date" value={ini} onChange={(e) => setIni(e.target.value)} /></label>
                <label className="lbl">Até<input className="inp" type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
              </>
            )}
            <label className="lbl full">Observação<input className="inp" value={obs} onChange={(e) => setObs(e.target.value)} /></label>
          </div>
          {diaria && !ini && !fim && <div className="small muted">Sem datas, considera o período inteiro da operação ({data(evento.inicio)} a {data(evento.fim)}).</div>}
          <div className="row end"><span className="muted">Total estimado:</span><b className="num" style={{ fontSize: 18 }}>{brl(total)}</b>{diaria && <span className="small muted">({dias} dias)</span>}</div>
        </>
      )}
    </Modal>
  )
}

export default function MateriaisTab({ evento }: { evento: Evento }) {
  const { isEscritorio } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ item?: MaterialEvento } | null>(null)
  const { data: itens = [], isLoading } = useQuery({ queryKey: ['materiais-evento', evento.id], queryFn: () => apiMateriaisEvento.listar(evento.id) })

  function atualizar(msg: string) {
    setModal(null)
    qc.invalidateQueries({ queryKey: ['materiais-evento', evento.id] })
    qc.invalidateQueries({ queryKey: ['custos', evento.id] })
    qc.invalidateQueries({ queryKey: ['evento', evento.id] })
    toast(msg)
  }

  async function remover(i: MaterialEvento) {
    if (!confirm(`Remover ${i.nome} do evento?`)) return
    try {
      await apiMateriaisEvento.excluir(i.id)
      atualizar('Material removido.')
    } catch (e) {
      toast(erroMsg(e), 'error')
    }
  }

  if (isLoading) return <div className="spinner" />
  const total = itens.reduce((s, i) => s + i.custo_total, 0)

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between">
        <span className="muted small">Materiais enviados ao evento. Itens locados e próprios cobrados por diária multiplicam pelos dias de uso.</span>
        {isEscritorio && <button className="btn sm pri" onClick={() => setModal({})}><Plus size={15} />Adicionar material</button>}
      </div>
      {itens.length === 0 ? <div className="empty">Nenhum material registrado neste evento.</div> : (
        <div className="card flush scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Código</th><th>Material</th><th>Tipo</th><th className="r">Qtd</th><th>Período</th>
                {isEscritorio && <><th className="r">Unitário</th><th className="r">Total</th><th /></>}
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.id}>
                  <td className="mono small">{i.codigo}</td>
                  <td><div style={{ fontWeight: 600 }}>{i.nome}</div><div className="small muted">{i.categoria}{i.observacao ? ` · ${i.observacao}` : ''}</div></td>
                  <td className="small">{TIPO_MAT_LABEL[i.tipo]}</td>
                  <td className="r num">{num(i.quantidade)} <span className="muted small">{i.unidade}</span></td>
                  <td className="small num">{i.cobranca === 'diaria' ? `${i.dias} dias${i.inicio ? ` (${data(i.inicio)}–${data(i.fim)})` : ''}` : '—'}</td>
                  {isEscritorio && (
                    <>
                      <td className="r num small">{brl(i.custo_unitario)}{i.cobranca === 'diaria' && <span className="muted">/dia</span>}</td>
                      <td className="r num">{brl(i.custo_total)}</td>
                      <td className="r" style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn ghost icon" title="Editar" onClick={() => setModal({ item: i })}><Pencil size={14} /></button>
                        <button className="btn ghost icon" title="Remover" onClick={() => remover(i)}><Trash2 size={14} /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {isEscritorio && <tr className="tot"><td colSpan={6}>Total de materiais</td><td className="r num">{brl(total)}</td><td /></tr>}
            </tbody>
          </table>
        </div>
      )}
      {modal && <ItemModal evento={evento} item={modal.item} onClose={() => setModal(null)} onSalvo={() => atualizar(modal.item ? 'Material atualizado.' : 'Material adicionado.')} />}
    </div>
  )
}
