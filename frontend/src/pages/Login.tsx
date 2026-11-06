import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { erroMsg } from '../utils/format'

export default function Login() {
  const { usuario, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)

  const destino = (location.state as { from?: string } | null)?.from ?? '/'
  if (usuario) return <Navigate to={destino} replace />

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEntrando(true)
    try {
      await login(email, senha)
      navigate(destino, { replace: true })
    } catch (err) {
      setErro(erroMsg(err, 'Não foi possível entrar.'))
    } finally {
      setEntrando(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-art">
        <img src="/logo-gf.png" alt="Grupo Forte" />
        <div>
          <h1>Equipes, materiais e custos <b>de cada evento</b>, em um só lugar.</h1>
          <p style={{ marginTop: 14, maxWidth: 440, lineHeight: 1.6 }}>
            Monte equipes, mova prestadores entre frentes e eventos em andamento e acompanhe o custo realizado em tempo real.
          </p>
        </div>
        <small style={{ color: '#8F8F8F' }}>Grupo Forte · Infraestrutura para eventos</small>
      </div>
      <div className="login-form">
        <form onSubmit={entrar}>
          <div>
            <h1>Entrar</h1>
            <p className="sub">Use seu e-mail e senha de acesso.</p>
          </div>
          <label className="lbl">E-mail
            <input className="inp" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <label className="lbl">Senha
            <input className="inp" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          </label>
          {erro && <div className="alert bad">{erro}</div>}
          <button className="btn pri" type="submit" disabled={entrando} style={{ minHeight: 42 }}>
            {entrando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
