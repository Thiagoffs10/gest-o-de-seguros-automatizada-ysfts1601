import { useEffect, useState, useCallback } from 'react'
import {
  Search,
  UserPlus,
  Phone,
  Mail,
  Building2,
  User,
  X,
  Pencil,
  Trash2,
  Download,
} from 'lucide-react'
import { getClients, createClient, deleteClient } from '@/services/clients'
import { getPolicies } from '@/services/policies'
import { formatDocumentLabel } from '@/lib/document-validators'
import { Client, FilterState } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ClientFormDialog } from '@/components/ClientFormDialog'
import { DeleteClientDialog } from '@/components/DeleteClientDialog'
import { GlobalFilters } from '@/components/GlobalFilters'
import { buildFilterString } from '@/lib/constants'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'

export default function Clients() {
  const { toast } = useToast()
  const { can } = usePermissions()
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [filters, setFilters] = useState<FilterState>({})
  const [exportLoading, setExportLoading] = useState(false)

  const loadClients = useCallback(async () => {
    try {
      const filterStr = buildFilterString('', filters, 'created')
      const data = await getClients(search, filterStr)
      setClients(data)
    } catch {
      /* intentionally ignored */
    }
  }, [search, filters])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadClients()
    }, 300)
    return () => clearTimeout(timer)
  }, [loadClients])

  useRealtime('clients', () => {
    loadClients()
  })

  const handleCreate = async (formData: any) => {
    try {
      await createClient(formData)
      toast({ title: 'Cliente adicionado com sucesso!' })
      setIsModalOpen(false)
      loadClients()
    } catch (err: any) {
      toast({
        title: 'Erro ao cadastrar cliente',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleEditClick = (client: Client) => {
    setEditingClient(client)
    setIsEditModalOpen(true)
  }

  const handleEditSubmit = async (formData: any) => {
    if (!editingClient?.id) return
    try {
      const { updateClient } = await import('@/services/clients')
      await updateClient(editingClient.id, formData)
      toast({ title: 'Cliente atualizado com sucesso!' })
      setIsEditModalOpen(false)
      setEditingClient(null)
      loadClients()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar cliente',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleDeleteClick = (client: Client) => {
    setDeletingClient(client)
    setIsDeleteDialogOpen(true)
  }

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const filterStr = buildFilterString('', filters, 'created')
      const exportClients = await getClients(search, filterStr)
      let allPolicies: any[] = []
      if (exportClients.length > 0) {
        const clientIds = exportClients.map((c) => c.id)
        const policyFilter = clientIds.map((id) => `client = "${id}"`).join(' || ')
        allPolicies = await getPolicies(policyFilter)
      }
      exportClientsToCsv(exportClients, allPolicies)
      toast({ title: 'Carteira exportada com sucesso!' })
    } catch (err: any) {
      toast({
        title: 'Erro ao exportar carteira',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setExportLoading(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingClient) return
    setDeleteLoading(true)
    try {
      const policies = await getPolicies(`client = "${deletingClient.id}"`)
      if (policies.length > 0) {
        toast({
          title: 'Não é possível excluir este cliente pois existem apólices vinculadas a ele.',
          variant: 'destructive',
        })
        setIsDeleteDialogOpen(false)
        setDeletingClient(null)
        return
      }
      await deleteClient(deletingClient.id)
      toast({ title: 'Cliente excluído com sucesso!' })
      setIsDeleteDialogOpen(false)
      setDeletingClient(null)
      loadClients()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir cliente',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Clientes</h1>
          <p className="text-slate-500 text-sm">Cadastre e gerencie a base de segurados.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exportLoading}>
            <Download className="w-4 h-4 mr-2" /> Exportar para Excel
          </Button>
          {can('clients', 'create') && (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsModalOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" /> Adicionar Cliente
            </Button>
          )}
        </div>
      </div>

      <GlobalFilters filters={filters} onFilterChange={setFilters} />

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
        <Input
          placeholder="Buscar por CPF ou CNPJ..."
          className="pl-9 pr-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Limpar busca"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <Card className="shadow-sm overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3.5">Código</th>
                <th className="p-3.5">Tipo</th>
                <th className="p-3.5">Nome</th>
                <th className="p-3.5">Documento</th>
                <th className="p-3.5">E-mail</th>
                <th className="p-3.5">Telefone</th>
                <th className="p-3.5">Cidade/UF</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-6 text-slate-500">
                    Nenhum cliente encontrado{search ? ` para "${search}"` : '.'}
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-blue-600">{c.client_code || '-'}</td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {c.tipo_pessoa === 'PJ' ? (
                          <>
                            <Building2 className="w-3 h-3" /> PJ
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3" /> PF
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-900">{c.name}</td>
                    <td className="p-3.5 text-slate-600">{formatDocumentLabel(c)}</td>
                    <td className="p-3.5 text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {c.email || '-'}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {c.phone || '-'}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500">
                      {c.cidade ? `${c.cidade}/${c.estado || ''}` : '-'}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {can('clients', 'update') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => handleEditClick(c)}
                          >
                            <Pencil className="w-4 h-4" />
                            <span className="ml-1">Editar</span>
                          </Button>
                        )}
                        {can('clients', 'delete') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteClick(c)}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="ml-1">Excluir</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ClientFormDialog open={isModalOpen} onOpenChange={setIsModalOpen} onSubmit={handleCreate} />

      {editingClient && (
        <ClientFormDialog
          open={isEditModalOpen}
          onOpenChange={(open) => {
            setIsEditModalOpen(open)
            if (!open) setEditingClient(null)
          }}
          onSubmit={handleEditSubmit}
          initialData={editingClient}
          title="Editar Cliente"
        />
      )}

      <DeleteClientDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open)
          if (!open) setDeletingClient(null)
        }}
        onConfirm={handleDeleteConfirm}
        clientName={deletingClient?.name || ''}
        loading={deleteLoading}
      />
    </div>
  )
}
