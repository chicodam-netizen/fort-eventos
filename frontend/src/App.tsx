import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import { ProtectedRoute } from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Painel from './pages/Painel'
import Eventos from './pages/Eventos'
import EventoDetalhe from './pages/EventoDetalhe'
import MapaPage from './pages/MapaPage'
import Prestadores from './pages/Prestadores'
import Funcoes from './pages/Funcoes'
import EquipesModelo from './pages/EquipesModelo'
import Materiais from './pages/Materiais'
import Usuarios from './pages/Usuarios'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 20_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/*" element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Painel />} />
                      <Route path="/eventos" element={<Eventos />} />
                      <Route path="/eventos/:id" element={<EventoDetalhe />} />
                      <Route path="/mapa" element={<MapaPage />} />
                      <Route path="/prestadores" element={<Prestadores />} />
                      <Route path="/funcoes" element={<ProtectedRoute perfis={['Administrador', 'Escritório']}><Funcoes /></ProtectedRoute>} />
                      <Route path="/equipes-modelo" element={<ProtectedRoute perfis={['Administrador', 'Escritório']}><EquipesModelo /></ProtectedRoute>} />
                      <Route path="/materiais" element={<ProtectedRoute perfis={['Administrador', 'Escritório']}><Materiais /></ProtectedRoute>} />
                      <Route path="/usuarios" element={<ProtectedRoute perfis={['Administrador']}><Usuarios /></ProtectedRoute>} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              } />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
