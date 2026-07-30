import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  FileText,
  Wallet,
  Bell,
  Send,
  Settings,
  LogOut,
  Menu,
  X,
  Handshake,
  Building2,
  UserCog,
  LayoutGrid,
  Mail,
  Receipt,
} from 'lucide-react'
import logoImg from '@/assets/cred10mixlogooficialfundobranco4k-12574.jpg'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'
import { canAccessMassSend } from '@/lib/permissions'
import { getReminders, updateReminder } from '@/services/reminders'
import { Reminder } from '@/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { FloatingActions } from '@/components/FloatingActions'

export default function Layout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const { can } = usePermissions()

  const fetchPendingReminders = async () => {
    try {
      const data = await getReminders('sent = false')
      setReminders(data)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    fetchPendingReminders()
  }, [])

  useRealtime('reminders', () => {
    fetchPendingReminders()
  })

  const handleMarkAsSent = async (id: string) => {
    await updateReminder(id, { sent: true })
    fetchPendingReminders()
  }

  const isAdmin = user?.role === 'Admin' || user?.role === 'Administrador'
  const canMassSend = canAccessMassSend(user?.role)

  const navItems = [
    { title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { title: 'Clientes', path: '/clientes', icon: Users },
    { title: 'Apólices', path: '/apolices', icon: FileText },
    { title: 'Pipeline', path: '/pipeline', icon: LayoutGrid },
    { title: 'Parceiros', path: '/parceiros', icon: Handshake },
    { title: 'Seguradoras', path: '/seguradoras', icon: Building2 },
    { title: 'Financeiro', path: '/financeiro', icon: Wallet },
    ...(can('custos_fixos', 'read')
      ? [{ title: 'Custos Fixos', path: '/custos-fixos', icon: Receipt }]
      : []),
    { title: 'Lembretes', path: '/lembretes', icon: Bell, badge: reminders.length },
    { title: 'Comunicação', path: '/comunicacao', icon: Send },
    ...(canMassSend ? [{ title: 'Envio em Massa', path: '/envio-em-massa', icon: Mail }] : []),
    ...(isAdmin ? [{ title: 'Usuários', path: '/usuarios', icon: UserCog }] : []),
    { title: 'Configurações', path: '/configuracoes', icon: Settings },
  ]

  const currentNav = navItems.find((item) => location.pathname.startsWith(item.path)) || navItems[0]

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-[260px] flex-col bg-[#1e293b] text-white p-4 shadow-lg shrink-0">
        <div className="flex items-center gap-3 px-3 py-4 border-b border-slate-700/60 mb-6">
          <div className="p-1 bg-white rounded-lg flex items-center justify-center border border-slate-200 shrink-0 shadow-sm">
            <img
              src={logoImg}
              alt="CRED10MIX CORRETORA DE SEGUROS"
              className="h-10 w-auto object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-xs tracking-wider text-amber-400 leading-tight truncate">
              CRED10MIX
            </h1>
            <p className="text-[10px] font-semibold text-slate-300 tracking-tight leading-snug">
              CORRETORA DE SEGUROS
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#1d4ed8] text-white shadow'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span>{item.title}</span>
                </div>
                {item.badge ? (
                  <Badge className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 text-xs">
                    {item.badge}
                  </Badge>
                ) : null}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-slate-700/60 pt-4 mt-auto">
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 bg-blue-600 text-white font-bold">
                <AvatarFallback>
                  {user?.name ? user.name.substring(0, 2).toUpperCase() : 'CO'}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{user?.name || 'Corretor'}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white"
              onClick={signOut}
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-[64px] bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-700"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </Button>
            <h2 className="text-xl font-bold text-slate-800">{currentNav.title}</h2>
          </div>

          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                  <Bell className="w-5 h-5 text-slate-600" />
                  {reminders.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                      {reminders.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h4 className="font-semibold text-sm">Lembretes Pendentes</h4>
                  <Badge variant="secondary">{reminders.length}</Badge>
                </div>
                <div className="max-h-64 overflow-y-auto p-2 space-y-2">
                  {reminders.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">
                      Nenhum lembrete pendente.
                    </p>
                  ) : (
                    reminders.map((rem) => (
                      <div
                        key={rem.id}
                        className="p-2.5 bg-slate-50 rounded border text-xs flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between font-medium">
                          <span className="text-blue-600">{rem.type}</span>
                          <span className="text-slate-400">
                            {new Date(rem.date).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-slate-700">{rem.message}</p>
                        {can('reminders', 'update') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] text-blue-600 hover:text-blue-800 self-end p-0"
                            onClick={() => handleMarkAsSent(rem.id)}
                          >
                            Marcar como concluído
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t text-center">
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs text-blue-600 h-auto p-0"
                    onClick={() => navigate('/lembretes')}
                  >
                    Ver todos em Lembretes
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Avatar
              className="h-9 w-9 bg-blue-600 text-white font-bold cursor-pointer"
              onClick={() => navigate('/configuracoes')}
            >
              <AvatarFallback>
                {user?.name ? user.name.substring(0, 2).toUpperCase() : 'CO'}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsMobileOpen(false)}
            />
            <div className="relative flex w-[260px] flex-col bg-[#1e293b] text-white p-4 z-10">
              <div className="flex items-center justify-between pb-4 border-b border-slate-700/60 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1 bg-white rounded-lg flex items-center justify-center border border-slate-200 shrink-0 shadow-sm">
                    <img src={logoImg} alt="CRED10MIX Logo" className="h-8 w-auto object-contain" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-xs tracking-wider text-amber-400">
                      CRED10MIX
                    </span>
                    <span className="text-[9px] font-semibold text-slate-300">
                      CORRETORA DE SEGUROS
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-400"
                  onClick={() => setIsMobileOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <nav className="flex-1 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname.startsWith(item.path)
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                        isActive ? 'bg-[#1d4ed8] text-white' : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </div>
                      {item.badge ? (
                        <Badge className="bg-amber-500 text-slate-950 font-bold">
                          {item.badge}
                        </Badge>
                      ) : null}
                    </Link>
                  )
                })}
              </nav>

              <div className="border-t border-slate-700/60 pt-4 mt-auto">
                <Button
                  variant="destructive"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={signOut}
                >
                  <LogOut className="w-4 h-4" />
                  Sair do Sistema
                </Button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>

        <footer className="py-4 text-center text-xs text-slate-500 border-t bg-white">
          © {new Date().getFullYear()} CRED10MIX CORRETORA DE SEGUROS – Todos os direitos
          reservados.
        </footer>
      </div>

      <FloatingActions />
    </div>
  )
}
