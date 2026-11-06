import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { apiMateriais, apiOpcoes, type Material } from '../api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { brl, COBRANCA_LABEL, erroMsg, TIPO_MAT_LABEL } from '../utils/format'

const VAZIO: Partial<Material> = { codigo: '', nome: '', categoria: 'Elétrica', unidade: 'un', tipo: 'proprio', cobranca: 'diaria', custo_unitario: 0, ativo: true }

function MaterialModal({ material, onClose, onSalvo }: { material?: Material; onClose: () => void; onSalvo: () => void }) {
  const { data: opcoes } = useQuery({ queryKey: ['opcoes'], queryFn: apiOpcoes, staleTime: Infinity })
  const [f, setF] = useState<Partial<Material>>(material ?? VAZIO)
  const [custo, setCusto] = useState(String(material?.custo_unitario ?? ''))
  const [qtd, setQtd] = useState(material?.qtd_propria != null ? String(material.qtd_propria) : '')
  const [erro, setErro] = useState('')
  const set = (k: keyof Material) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  async function salvar() {
    if (!f.codigo?.trim() || !f.nome?.trim()) return setErro('Informe código e nome.')
    const body = { ...f, custo_unitario: Number(custo.replace(',', '.') || 0), qtd_propria: qtd === '' ? null : Number(qtd) }
    delete body.id
    try {
      if (material) await apiMateriais.atualizar(material.id, body)
      else await apiMateriais.criar(body)
      onSalvo()
    } catch (e) {
      setErro(erroMsg(e))
    }
  }

  return (
    <Modal wide titulo={material ? `Editar · ${material.codigo}` : 'Novo material'} onClose={onClose} footer={<>
      {erro && <span className="err grow">{erro}</span>}
      <button className="btn" onClick={onClose}>Cancelar</button>
      <button className="btn pri" onClick={salvar}>Salvar</button>
    </>}>
      <div className="form">
        <label className="lbl">Código *<input className="inp mono" value={f.codigo ?? ''} onChange={set('codigo')} autoFocus placeholder="ELE-001" /></label>
        <label className="lbl" style={{ gridColumn: 'span 2' }}>Nome *<input className="inp" value={f.nome ?? ''} onChange={set('nome')} /></label>
        <label className="lbl">Categoria / frente
          <select className="inp" value={f.categoria} onChange={set('categoria')}>{opcoes?.categorias_material.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="lbl">Tipo
          <select className="inp" value={f.tipo} onChange={set('tipo')}>{opcoes?.tipos_material.map((c) => <option key={c} value={c}>{TIPO_MAT_LABEL[c]}</option>)}</select>
        </label>
        <label className="lbl">Unidade<input className="inp" value={f.unidade ?? ''} onChange={set('unidade')} placeholder="un, m, kit, L" /></label>
        <label className="lbl">Cobrança
          <select className="inp" value={f.cobranca} onChange={set('cobranca')}>{opcoes?.cobrancas_material.map((c) => <option key={c} value={c}>{COBRANCA_LABEL[c]}</option>)}</select>
        </label>
        <label className="lbl">Custo unitário {f.cobranca === 'diaria' ? 'por dia' : ''} (R$)<input className="inp num" inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} /></label>
        {f.tipo === 'proprio' && (
          <label className="lbl">Quantidade em estoque próprio<input className="inp num" type="number" min={0} value={qtd} onChange={(e) => setQtd(e.target.value)} />
            <span className="small muted">Servirá ao controle de disponibilidade entre eventos simultâneos.</span>
          </label>
        )}
        <label className="lbl">Situação
          <select className="inp" value={f.ativo ? '1' : '0'} onChange={(e) => setF((x) => ({ ...x, ativo: e.target.value === '1' }))}>
            <option value="1">Ativo</option><option value="0">Inativo</option>
          </select>
        </label>
        <label className="lbl full">Observações<textarea className="inp" value={f.observacoes ?? ''} onChange={set('observacoes')} /></label>
      </div>
    </Modal>
  )
}

export default function Materiais() {
  const toast = useToast()
  const qc = useQueryClient()
  const { data: opcoes } = useQuery({ queryKey: ['opcoes'], queryFn: apiOpcoes, staleTime: Infinity })
  const { data: lista = [], isLoading } = useQuery({ queryKey: ['materiais'], queryFn: () => apiMateriais.listar() })
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [modal, setModal] = useState<{ m?: Material } | null>(null)

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    return lista.filter((m) => (!cat || m.categoria === cat) && (!t || m.nome.toLowerCase().includes(t) || m.codigo.toLowerCase().includes(t)))
  }, [lista, q, cat])

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Materiais</h1>
          <p className="sub">Cadastro de equipamentos e insumos: próprios, locados de terceiros e consumíveis.</p>
        </div>
        <button className="btn pri" onClick={() => setModal({})}><Plus size={16} />Novo material</button>
      </div>
      <div className="card row">
        <input className="inp grow" style={{ flex: '1 1 260px' }} placeholder="Buscar por código ou nome" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="inp" style={{ width: 200 }} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas as categorias</option>
          {opcoes?.categorias_material.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {isLoading ? <div className="spinner" /> : (
        <div className="card flush scroll">
          <table className="tbl">
            <thead><tr><th>Código</th><th>Material</th><th>Categoria</th><th>Tipo</th><th className="r">Custo</th><th className="r">Estoque próprio</th><th /></tr></thead>
            <tbody>
              {filtrados.map((m) => (
                <tr key={m.id} className={m.ativo ? '' : 'off'}>
                  <td className="mono small">{m.codigo}</td>
                  <td style={{ fontWeight: 600 }}>{m.nome}</td>
                  <td className="small">{m.categoria}</td>
                  <td className="small">{TIPO_MAT_LABEL[m.tipo]}</td>
                  <td className="r num small">{brl(m.custo_unitario)} <span className="muted">{m.cobranca === 'diaria' ? '/dia' : `/${m.unidade}`}</span></td>
                  <td className="r num">{m.qtd_propria ?? <span className="muted">—</span>}</td>
                  <td className="r"><button className="btn ghost icon" title="Editar" onClick={() => setModal({ m })}><Pencil size={14} /></button></td>
                </tr>
              ))}
              {filtrados.length === 0 && <tr><td colSpan={7} className="muted" style={{ padding: 20 }}>Nenhum material encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {modal && <MaterialModal material={modal.m} onClose={() => setModal(null)} onSalvo={() => {
        setModal(null)
        qc.invalidateQueries({ queryKey: ['materiais'] })
        toast('Material salvo.')
      }} />}
    </>
  )
}
