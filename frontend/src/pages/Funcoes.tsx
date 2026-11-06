import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { apiFuncoes, type Funcao } from '../api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { brl, erroMsg } from '../utils/format'

export default function Funcoes() {
  const toast = useToast()
  const qc = useQueryClient()
  const { data: lista = [], isLoading } = useQuery({ queryKey: ['funcoes'], queryFn: apiFuncoes.listar })
  const [modal, setModal] = useState<{ f?: Funcao } | null>(null)
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState('')

  function abrir(f?: Funcao) {
    setNome(f?.nome ?? '')
    setValor(f ? String(f.valor_diaria_ref) : '')
    setErro('')
    setModal({ f })
  }

  async function salvar() {
    if (!nome.trim()) return setErro('Informe o nome.')
    const body = { nome, valor_diaria_ref: Number(valor.replace(',', '.') || 0) }
    try {
      if (modal?.f) await apiFuncoes.atualizar(modal.f.id, body)
      else await apiFuncoes.criar(body)
      setModal(null)
      qc.invalidateQueries({ queryKey: ['funcoes'] })
      toast('Função salva.')
    } catch (e) {
      setErro(erroMsg(e))
    }
  }

  async function excluir(f: Funcao) {
    if (!confirm(`Excluir a função "${f.nome}"?`)) return
    try {
      await apiFuncoes.excluir(f.id)
      qc.invalidateQueries({ queryKey: ['funcoes'] })
      toast('Função excluída.')
    } catch (e) {
      toast(erroMsg(e), 'error')
    }
  }

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Funções</h1>
          <p className="sub">O que cada prestador faz em campo. A diária de referência é sugerida ao cadastrar o prestador.</p>
        </div>
        <button className="btn pri" onClick={() => abrir()}><Plus size={16} />Nova função</button>
      </div>
      {isLoading ? <div className="spinner" /> : (
        <div className="card flush" style={{ maxWidth: 720 }}>
          <table className="tbl">
            <thead><tr><th>Função</th><th className="r">Diária de referência</th><th /></tr></thead>
            <tbody>
              {lista.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600 }}>{f.nome}</td>
                  <td className="r num">{brl(f.valor_diaria_ref)}</td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost icon" title="Editar" onClick={() => abrir(f)}><Pencil size={14} /></button>
                    <button className="btn ghost icon" title="Excluir" onClick={() => excluir(f)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <Modal titulo={modal.f ? 'Editar função' : 'Nova função'} onClose={() => setModal(null)} footer={<>
          {erro && <span className="err grow">{erro}</span>}
          <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
          <button className="btn pri" onClick={salvar}>Salvar</button>
        </>}>
          <label className="lbl">Nome<input className="inp" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></label>
          <label className="lbl">Diária de referência (R$)<input className="inp num" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></label>
        </Modal>
      )}
    </>
  )
}
