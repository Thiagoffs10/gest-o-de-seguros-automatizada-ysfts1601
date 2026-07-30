import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Shield, User as UserIcon, Pencil, Eye, EyeOff } from 'lucide-react'
import { getUsers } from '@/services/users'
import { User } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserFormDialog } from '@/components/UserFormDialog'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

const ROLE_LABELS: Record<string, string> = {
  Admin: 'Administrador',
  Administrador: 'Administrador',
  Gerente: 'Gerente',
  Operador: 'Operador',
  Visualizador: 'Visualizador',
}

const ROLE_ICONS: Record<string, typeof Shield> = {
  Admin: Shield,
  Administrador: Shield,
  Gerente: Shield,
  Operador: UserIcon,
  Visualizador: Eye,
}

export default function Users() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  useEffect(() => {
    const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Administrador'
    if (currentUser && !isAdmin) {
      navigate('/dashboard')
    }
  }, [currentUser, navigate])

  const loadUsers = useCallback(async () => {
    try {
      const data = await getUsers()
      setUsers(data)
    } catch (err) {
      toast({
        title: 'Erro ao carregar usuários',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleCreateSuccess = () => {
    loadUsers()
  }

  const handleEditClick = (user: User) => {
    setEditingUser(user)
    setIsModalOpen(true)
  }

  const handleCloseModal = (open: boolean) => {
    setIsModalOpen(open)
    if (!open) setEditingUser(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Usuários</h1>
          <p className="text-slate-500 text-sm">Cadastre e gerencie usuários do sistema.</p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => {
            setEditingUser(null)
            setIsModalOpen(true)
          }}
        >
          <UserPlus className="w-4 h-4 mr-2" /> Criar Usuário
        </Button>
      </div>

      <Card className="shadow-sm overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3.5">Nome</th>
                <th className="p-3.5">E-mail</th>
                <th className="p-3.5">Tipo</th>
                <th className="p-3.5">Criado em</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center p-6 text-slate-500">
                    Carregando usuários...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-6 text-slate-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const RoleIcon = ROLE_ICONS[u.role || ''] || UserIcon
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          {u.id === currentUser?.id && (
                            <Badge className="bg-blue-100 text-blue-700 text-[10px]">Você</Badge>
                          )}
                          {u.name || 'Sem nome'}
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-600">{u.email}</td>
                      <td className="p-3.5">
                        <Badge
                          className={
                            u.role === 'Admin'
                              ? 'bg-amber-100 text-amber-800'
                              : u.role === 'Gerente'
                                ? 'bg-purple-100 text-purple-800'
                                : u.role === 'Operador'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-700'
                          }
                        >
                          <RoleIcon className="w-3 h-3 mr-1" />
                          {ROLE_LABELS[u.role || ''] || u.role || '-'}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {u.created ? new Date(u.created).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="p-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-800"
                          onClick={() => handleEditClick(u)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <UserFormDialog
        open={isModalOpen}
        onOpenChange={handleCloseModal}
        onSuccess={handleCreateSuccess}
        editingUser={editingUser}
      />
    </div>
  )
}
