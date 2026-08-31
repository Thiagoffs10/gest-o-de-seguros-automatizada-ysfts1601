import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ErrorBoundary } from '@/components/ErrorBoundary'

import { AuthProvider } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'

import Login from '@/pages/Login'
import ResetPassword from '@/pages/ResetPassword'
import Dashboard from '@/pages/Dashboard'
import Clients from '@/pages/Clients'
import ClientDetail from '@/pages/ClientDetail'
import Policies from '@/pages/Policies'
import PolicyDetail from '@/pages/PolicyDetail'
import Parceiros from '@/pages/Parceiros'
import Seguradoras from '@/pages/Seguradoras'
import PartnerReport from '@/pages/PartnerReport'
import Financial from '@/pages/Financial'
import ConciliacaoMensal from '@/pages/ConciliacaoMensal'
import CustosFixos from '@/pages/CustosFixos'
import RemindersPage from '@/pages/RemindersPage'
import Communication from '@/pages/Communication'
import EnvioEmMassa from '@/pages/EnvioEmMassa'
import Pipeline from '@/pages/Pipeline'
import Settings from '@/pages/Settings'
import Backup from '@/pages/Backup'
import ChangePassword from '@/pages/ChangePassword'
import UsersPage from '@/pages/Users'
import NotFound from '@/pages/NotFound'

const App = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/redefinir-senha" element={<ResetPassword />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/clientes" element={<Clients />} />
                <Route path="/clientes/:id" element={<ClientDetail />} />
                <Route path="/apolices" element={<Policies />} />
                <Route path="/apolices/:id" element={<PolicyDetail />} />
                <Route path="/parceiros" element={<Parceiros />} />
                <Route path="/seguradoras" element={<Seguradoras />} />
                <Route path="/relatorio-comissoes" element={<PartnerReport />} />
                <Route path="/financeiro" element={<Financial />} />
                <Route path="/conciliacao-mensal" element={<ConciliacaoMensal />} />
                <Route path="/custos-fixos" element={<CustosFixos />} />
                <Route path="/lembretes" element={<RemindersPage />} />
                <Route path="/comunicacao" element={<Communication />} />
                <Route path="/central-de-comunicacao" element={<Communication />} />
                <Route path="/envio-em-massa" element={<Communication />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/alterar-senha" element={<ChangePassword />} />
                <Route path="/usuarios" element={<UsersPage />} />
                <Route path="/configuracoes" element={<Settings />} />
                <Route path="/backup" element={<Backup />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
)

export default App
