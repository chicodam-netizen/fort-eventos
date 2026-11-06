import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiAuth, authStorage, setOnUnauthorized, type Usuario } from '../api'

interface AuthContextValue {
  usuario: Usuario | null
  loading: boolean
  isAdmin: boolean
  isEscritorio: boolean
  login: (email: string, senha: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  function logout() {
    authStorage.clearToken()
    setUsuario(null)
  }

  useEffect(() => {
    setOnUnauthorized(() => setUsuario(null))
    if (!authStorage.getToken()) {
      setLoading(false)
      return
    }
    apiAuth.me()
      .then(setUsuario)
      .catch(() => authStorage.clearToken())
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, senha: string) {
    const r = await apiAuth.login(email, senha)
    authStorage.setToken(r.access_token)
    setUsuario(r.usuario)
  }

  const isAdmin = usuario?.perfil === 'Administrador'
  const isEscritorio = isAdmin || usuario?.perfil === 'Escritório'

  return (
    <AuthContext.Provider value={{ usuario, loading, isAdmin, isEscritorio, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  return ctx
}
