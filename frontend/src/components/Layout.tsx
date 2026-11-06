import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Boxes, CalendarRange, HardHat, KeyRound, LayoutDashboard, Lock, LogOut, Map, Menu, Users, UsersRound, Wrench,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import TrocarSenhaModal from './TrocarSenhaModal'
import { useToast } from './Toast'

const principal = [
  { to: '/', icon: LayoutDashboard, label: 'Painel', escritorio: false },
  { to: '/eventos', icon: CalendarRange, label: 'Eventos', escritorio: false },
  { to: '/mapa', icon: Map, label: 'Mapa', escritorio: false },
]

const cadastros = [
  { to: '/prestadores', icon: HardHat, label: 'Prestadores' },
  { to: '/funcoes', icon: Wrench, label: 'Funções' },
  { to: '/equipes-modelo', icon: UsersRound, label: 'Equipes modelo' },
  { to: '/materiais', icon: Boxes, label: 'Materiais' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { usuario, isAdmin, isEscritorio, logout } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [senha, setSenha] = useState(false)
  const toast = useToast()
  const { pathname } = useLocation()
  const [ultimo, setUltimo] = useState(pathname)
  if (ultimo !== pathname) {
    setUltimo(pathname)
    setAberto(false)
  }

  const link = (to: string, Icon: typeof Users, label: string) => (
    <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>
      <Icon size={17} />{label}
    </NavLink>
  )

  return (
    <div className="app">
      <div className="mobilebar">
        <button onClick={() => setAberto(true)} aria-label="Abrir menu"><Menu size={22} /></button>
        <img src="/logo-gf.png" alt="Grupo Forte" />
      </div>
      {aberto && <div className="scrim" onClick={() => setAberto(false)} />}

      <aside className={`side${aberto ? ' open' : ''}`}>
        <div className="brand">
          <img src="/logo-gf.png" alt="Grupo Forte" />
          <small>Gestão de Eventos</small>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {principal.map((l) => link(l.to, l.icon, l.label))}
          {isEscritorio && (
            <>
              <div className="navsec">Cadastros</div>
              {cadastros.map((l) => link(l.to, l.icon, l.label))}
            </>
          )}
          {!isEscritorio && link('/prestadores', HardHat, 'Prestadores')}
          {isAdmin && (
            <>
              <div className="navsec">Administração</div>
              {link('/usuarios', KeyRound, 'Usuários')}
            </>
          )}
        </nav>
        <div className="side-foot">
          {usuario && (
            <div className="side-user">
              {usuario.nome}
              <small>{usuario.perfil} · {usuario.email}</small>
            </div>
          )}
          <button className="nav" onClick={() => setSenha(true)}><Lock size={17} />Trocar senha</button>
          <button className="nav" onClick={logout}><LogOut size={17} />Sair</button>
          <div className="side-ver">Grupo Forte © {new Date().getFullYear()} · v{__APP_VERSION__}</div>
        </div>
      </aside>

      <main className="main">
        <div className="content">{children}</div>
      </main>

      {senha && (
        <TrocarSenhaModal
          onClose={() => setSenha(false)}
          onSucesso={() => { setSenha(false); toast('Senha alterada com sucesso') }}
        />
      )}
    </div>
  )
}
