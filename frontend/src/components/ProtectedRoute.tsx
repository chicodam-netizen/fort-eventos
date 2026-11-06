import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Perfil } from '../api'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children, perfis }: { children: ReactNode; perfis?: Perfil[] }) {
  const { usuario, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="spinner" />
  if (!usuario) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (perfis && !perfis.includes(usuario.perfil)) return <Navigate to="/" replace />
  return <>{children}</>
}
