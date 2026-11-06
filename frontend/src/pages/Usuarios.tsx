import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { apiPrestadores, apiUsuarios, type Perfil, type Usuario } from '../api'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { erroMsg } from '../utils/format'

const PERFIS: { v: Perfil; d: string }[] = [
  { v: 'Administrador', d: 'Tudo, inclusive usuários' },
  { v: 'Escritório', d: 'Eventos, cadastros e custos' },
  { v: 'Líder', d: 'Só os eventos onde lidera uma equipe; movimenta prestadores; não vê valores' },
]

function UsuarioModal({ usuario, onClose, onSalvo }: { usuario?: Usuario; onClose: () => void; onSalvo: () => void }) {
  const { data: prestadores = [] } = useQuery({ queryKey: ['prestadores', 'todos'], queryFn: () => apiPrestadores.listar() })
  const [nome, setNome] = useState(usuario?.nome ?? '')
  const [email, setEmail] = useState(usuario?.email ?? '')
  const [perfil, setPerfil] = useState<Perfil>(usuario?.perfil ?? 'Escritório')
  const [prestador, setPrestador] = useState(usuario?.prestador_id ?? '')
  const [senha, setSenha] = useState('')
  const [ativo, setAtivo] = useState(usuario?.ativo ?? true)
  const [erro, setErro] = useState('')

  async function salvar() {
    setErro('')
    if (!nome.trim() || !email.trim()) return setErro('Informe nome e e-mail.')
    if (!usuario && senha.length < 6) return setErro('A senha inicial precisa ter pelo menos 6 caracteres.')
    const body = { nome, email, perfil, prestador_id: prestador || null, ativo, ...(senha ? { senha } : {}) }
    try {
      if (usuario) await apiUsuarios.atualizar(usuario.id, body)
      else await apiUsuarios.criar({ ...body, senha })
      onSalvo()
    } catch (e) {
      setErro(erroMsg(e))
    }
  }

  return (
    <Modal titulo={usuario ? 'Editar usuário' : 'Novo usuário'} onClose={onClose} footer={<>
      {erro && <span className="err grow">{erro}</span>}
      <button className="btn" onClick={onClose}>Cancelar</button>
      <button className="btn pri" onClick={salvar}>Salvar</button>
    </>}>
      <label className="lbl">Nome<input className="inp" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></label>
      <label className="lbl">E-mail<input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="lbl">Perfil
        <select className="inp" value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
          {PERFIS.map((p) => <option key={p.v} value={p.v}>{p.v} — {p.d}</option>)}
        </select>
      </label>
      {perfil === 'Líder' && (
        <label className="lbl">Prestador vinculado *
          <select className="inp" value={prestador} onChange={(e) => setPrestador(e.target.value)}>
            <option value="">Escolha…</option>
            {prestadores.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.funcao_nome ? ` · ${p.funcao_nome}` : ''}</option>)}
          </select>
          <span className="small muted">O líder vê os eventos em que esse prestador é líder de alguma equipe.</span>
        </label>
      )}
      <label className="lbl">{usuario ? 'Nova senha (deixe vazio para manter)' : 'Senha inicial'}<input className="inp" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />Usuário ativo</label>
    </Modal>
  )
}

export default function Usuarios() {
  const toast = useToast()
  const qc = useQueryClient()
  const { data: lista = [], isLoading } = useQuery({ queryKey: ['usuarios'], queryFn: apiUsuarios.listar })
  const { data: prestadores = [] } = useQuery({ queryKey: ['prestadores', 'todos'], queryFn: () => apiPrestadores.listar() })
  const [modal, setModal] = useState<{ u?: Usuario } | null>(null)
  const nomePrest = (id?: string | null) => prestadores.find((p) => p.id === id)?.nome

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Usuários</h1>
          <p className="sub">Acesso do escritório e dos líderes de equipe.</p>
        </div>
        <button className="btn pri" onClick={() => setModal({})}><Plus size={16} />Novo usuário</button>
      </div>
      {isLoading ? <div className="spinner" /> : (
        <div className="card flush scroll">
          <table className="tbl">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id} className={u.ativo ? '' : 'off'}>
                  <td style={{ fontWeight: 600 }}>{u.nome}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`pill ${u.perfil === 'Administrador' ? 'brand' : u.perfil === 'Líder' ? 'blue' : ''}`}>{u.perfil}</span>
                    {u.perfil === 'Líder' && <span className="small muted"> · {nomePrest(u.prestador_id) ?? '—'}</span>}
                  </td>
                  <td>{u.ativo ? <span className="pill ok">Ativo</span> : <span className="pill">Inativo</span>}</td>
                  <td className="r"><button className="btn ghost icon" title="Editar" onClick={() => setModal({ u })}><Pencil size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <UsuarioModal usuario={modal.u} onClose={() => setModal(null)} onSalvo={() => {
        setModal(null)
        qc.invalidateQueries({ queryKey: ['usuarios'] })
        toast('Usuário salvo.')
      }} />}
    </>
  )
}
