import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { apiFuncoes, apiModelos, type EquipeModelo, type ModeloItem } from '../api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { brl, erroMsg } from '../utils/format'

const CORES = ['#FF4700', '#2B6CB0', '#1E7F4F', '#6B46C1', '#C27C0E', '#3A3A3A', '#A23A24', '#0F766E']

function ModeloModal({ modelo, onClose, onSalvo }: { modelo?: EquipeModelo; onClose: () => void; onSalvo: () => void }) {
  const { data: funcoes = [] } = useQuery({ queryKey: ['funcoes'], queryFn: apiFuncoes.listar })
  const [nome, setNome] = useState(modelo?.nome ?? '')
  const [descricao, setDescricao] = useState(modelo?.descricao ?? '')
  const [cor, setCor] = useState(modelo?.cor ?? CORES[0])
  const [itens, setItens] = useState<ModeloItem[]>(modelo?.itens.map((i) => ({ funcao_id: i.funcao_id, quantidade: i.quantidade })) ?? [])
  const [erro, setErro] = useState('')

  const usadas = new Set(itens.map((i) => i.funcao_id))
  const custoDia = itens.reduce((s, i) => s + i.quantidade * (funcoes.find((f) => f.id === i.funcao_id)?.valor_diaria_ref ?? 0), 0)

  async function salvar() {
    if (!nome.trim()) return setErro('Informe o nome.')
    const body = { nome, descricao: descricao || null, cor, itens: itens.filter((i) => i.funcao_id && i.quantidade > 0) }
    try {
      if (modelo) await apiModelos.atualizar(modelo.id, body)
      else await apiModelos.criar(body)
      onSalvo()
    } catch (e) {
      setErro(erroMsg(e))
    }
  }

  return (
    <Modal titulo={modelo ? 'Editar equipe modelo' : 'Nova equipe modelo'} onClose={onClose} footer={<>
      {erro && <span className="err grow">{erro}</span>}
      <button className="btn" onClick={onClose}>Cancelar</button>
      <button className="btn pri" onClick={salvar}>Salvar</button>
    </>}>
      <label className="lbl">Nome<input className="inp" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Elétrica padrão" /></label>
      <label className="lbl">Descrição<input className="inp" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>
      <div className="lbl">Cor
        <div className="row tight">
          {CORES.map((c) => (
            <button key={c} onClick={() => setCor(c)} aria-label={c}
              style={{ width: 28, height: 28, borderRadius: 6, background: c, border: cor === c ? '3px solid var(--ink)' : '1px solid var(--line)', cursor: 'pointer' }} />
          ))}
        </div>
      </div>
      <h3>Composição</h3>
      {itens.map((it, idx) => (
        <div key={idx} className="row tight" style={{ flexWrap: 'nowrap' }}>
          <input className="inp num" style={{ width: 80 }} type="number" min={1} value={it.quantidade}
            onChange={(e) => setItens((l) => l.map((x, i) => (i === idx ? { ...x, quantidade: Number(e.target.value) } : x)))} />
          <select className="inp" value={it.funcao_id} onChange={(e) => setItens((l) => l.map((x, i) => (i === idx ? { ...x, funcao_id: e.target.value } : x)))}>
            <option value="">Função…</option>
            {funcoes.filter((f) => f.id === it.funcao_id || !usadas.has(f.id)).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <button className="btn ghost icon" onClick={() => setItens((l) => l.filter((_, i) => i !== idx))} aria-label="Remover"><X size={15} /></button>
        </div>
      ))}
      <div className="row between">
        <button className="btn sm" onClick={() => setItens((l) => [...l, { funcao_id: '', quantidade: 1 }])}><Plus size={14} />Adicionar função</button>
        <span className="small muted">Custo de referência: <b className="num">{brl(custoDia)}</b>/dia</span>
      </div>
    </Modal>
  )
}

export default function EquipesModelo() {
  const toast = useToast()
  const qc = useQueryClient()
  const { data: lista = [], isLoading } = useQuery({ queryKey: ['modelos'], queryFn: apiModelos.listar })
  const [modal, setModal] = useState<{ m?: EquipeModelo } | null>(null)

  async function excluir(m: EquipeModelo) {
    if (!confirm(`Excluir a equipe modelo "${m.nome}"? Equipes já criadas nos eventos não são afetadas.`)) return
    try {
      await apiModelos.excluir(m.id)
      qc.invalidateQueries({ queryKey: ['modelos'] })
      toast('Equipe modelo excluída.')
    } catch (e) {
      toast(erroMsg(e), 'error')
    }
  }

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Equipes modelo</h1>
          <p className="sub">Composições padrão para criar equipes nos eventos com um clique e depois personalizar.</p>
        </div>
        <button className="btn pri" onClick={() => setModal({})}><Plus size={16} />Nova equipe modelo</button>
      </div>
      {isLoading ? <div className="spinner" /> : lista.length === 0 ? <div className="empty">Nenhuma equipe modelo cadastrada.</div> : (
        <div className="g3">
          {lista.map((m) => (
            <div key={m.id} className="card" style={{ borderTop: `4px solid ${m.cor ?? 'var(--line)'}` }}>
              <div className="row between" style={{ flexWrap: 'nowrap' }}>
                <h3>{m.nome}</h3>
                <div className="row tight" style={{ flexWrap: 'nowrap' }}>
                  <button className="btn ghost icon" title="Editar" onClick={() => setModal({ m })}><Pencil size={14} /></button>
                  <button className="btn ghost icon" title="Excluir" onClick={() => excluir(m)}><Trash2 size={14} /></button>
                </div>
              </div>
              {m.descricao && <p className="small muted" style={{ margin: '6px 0 0' }}>{m.descricao}</p>}
              <div className="composicao" style={{ marginTop: 12 }}>
                {m.itens.map((i) => <span key={i.funcao_id} className="pill">{i.quantidade}× {i.funcao_nome}</span>)}
              </div>
              <div className="small muted" style={{ marginTop: 10 }}>{m.itens.reduce((s, i) => s + i.quantidade, 0)} pessoas</div>
            </div>
          ))}
        </div>
      )}
      {modal && <ModeloModal modelo={modal.m} onClose={() => setModal(null)} onSalvo={() => {
        setModal(null)
        qc.invalidateQueries({ queryKey: ['modelos'] })
        toast('Equipe modelo salva.')
      }} />}
    </>
  )
}
