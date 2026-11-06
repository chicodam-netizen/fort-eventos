import { useState } from 'react'
import { apiAuth } from '../api'
import { erroMsg } from '../utils/format'
import Modal from './Modal'

export default function TrocarSenhaModal({ onClose, onSucesso }: { onClose: () => void; onSucesso: () => void }) {
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [conf, setConf] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setErro('')
    if (nova.length < 6) return setErro('A nova senha precisa ter pelo menos 6 caracteres.')
    if (nova !== conf) return setErro('A confirmação não confere.')
    setSalvando(true)
    try {
      await apiAuth.trocarSenha(atual, nova)
      onSucesso()
    } catch (e) {
      setErro(erroMsg(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      titulo="Trocar senha"
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={salvar} disabled={salvando}>Salvar</button>
      </>}
    >
      <label className="lbl">Senha atual<input className="inp" type="password" value={atual} onChange={(e) => setAtual(e.target.value)} autoFocus /></label>
      <label className="lbl">Nova senha<input className="inp" type="password" value={nova} onChange={(e) => setNova(e.target.value)} /></label>
      <label className="lbl">Confirmar nova senha<input className="inp" type="password" value={conf} onChange={(e) => setConf(e.target.value)} /></label>
      {erro && <div className="err">{erro}</div>}
    </Modal>
  )
}
