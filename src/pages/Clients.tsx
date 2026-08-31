import { useEffect, useState, useCallback, useMemo } from 'react'
import { Search, UserPlus, X, Download, User } from 'lucide-react'
import { getClients, createClient, deleteClient, updateClient } from '@/services/clients'
import { getPolicies } from '@/services/policies'
import { Client, Policy, FilterState } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ClientCard } from '@/components/ClientCard'
import { ClientFormDialog } from '@/components/ClientFormDialog'
import { DeleteClientDialog } from '@/components/DeleteClientDialog'
import { GlobalFilters } from '@/components/GlobalFilters'
import { buildFilterString } from '@/lib/constants'
import { exportClientsToCsv } from '@/lib/export-utils'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'

export default function Clients() {
  const { toast } = useToast()
  const { can } = usePermissions()
  const [clients, setClients] = useState<Client[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [nameSearch, setNameSearch] = useState('')
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [filters, setFilters] = useState<FilterState>({})
  const [exportLoading, setExportLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const loadClients = useCallback(async () => {
    try {
      const filterStr = buildFilterString('', filters, 'created')
      const [data, pols] = await Promise.all([
        getClients(search, filterStr, nameSearch),
        getPolicies(),
      ])
      setClients(data)
      setPolicies(pols)
    } catch {
      /* intentionally ignored */
    }
    setLoading(false)
  }, [search, nameSearch, filters])

  useEffect(() => {
    setPage(1)
    setLoading(true)
    const timer = setTimeout(() => loadClients(), 300)
    return () => clearTimeout(timer)
  }, [loadClients])

  useRealtime('clients', () => loadClients())

  const activePolicyCounts = useMemo(() => {
    const map: Record<string, number> = {}
    policies.forEach((p) => {
      if (p.status === 'Ativa' && p.client) map[p.client] = (map[p.client] || 0) + 1
    })
    return map
  }, [policies])

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

  const handleEditSubmit = async (formData: any) => {
    if (!editingClient?.id) return
    try {
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

  const handleDeleteConfirm = async () => {
    if (!deletingClient) return
    setDeleteLoading(true)
    try {
      const pols = await getPolicies(`client = "${deletingClient.id}"`)
      if (pols.length > 0) {
        toast({
          title: 'Não é possível excluir: existem apólices vinculadas.',
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
      toast({ title: 'Erro ao excluir cliente', description: err.message, variant: 'destructive' })
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const filterStr = buildFilterString('', filters, 'created')
      const exportClients = await getClients(search, filterStr, nameSearch)
      let allPolicies: any[] = []
      if (exportClients.length > 0) {
        const clientIds = exportClients.map((c) => c.id)
        const policyFilter = clientIds.map((id) => `client = "${id}"`).join(' || ')
        allPolicies = await getPolicies(policyFilter)
      }
      exportClientsToCsv(exportClients, allPolicies)
      toast({ title: 'Carteira exportada com sucesso!' })
    } catch (err: any) {
      toast({ title: 'Erro ao exportar', description: err.message, variant: 'destructive' })
    } finally {
      setExportLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(clients.length / PAGE_SIZE))
  const paginatedClients = useMemo(
    () => clients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [clients, page],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Clientes</h1>
          <p className="text-slate-500 text-sm">Cadastre e gerencie a base de segurados.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exportLoading}>
            <Download className="w-4 h-4 mr-2" /> Exportar
          </Button>
          {can('clients', 'create') && (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsModalOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" /> Adicionar Cliente
            </Button>
          )}
        </div>
      </div>

      <GlobalFilters filters={filters} onFilterChange={setFilters} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
        <div className="relative">
          <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Pesquisar por Nome do Cliente..."
            className="pl-9 pr-9"
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
          />
          {nameSearch && (
            <button
              type="button"
              onClick={() => setNameSearch('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              aria-label="Limpar busca por nome"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative">
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
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              aria-label="Limpar busca por CPF/CNPJ"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Carregando informações...</div>
      ) : clients.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          Nenhum cliente encontrado
          {nameSearch ? ` para "${nameSearch}"` : search ? ` para "${search}"` : '.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedClients.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              activePoliciesCount={activePolicyCounts[c.id] || 0}
              onEdit={(client) => {
                setEditingClient(client)
                setIsEditModalOpen(true)
              }}
              onDelete={(client) => {
                setDeletingClient(client)
                setIsDeleteDialogOpen(true)
              }}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-600">
          <span>
            Exibindo {clients.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} a{' '}
            {Math.min(page * PAGE_SIZE, clients.length)} de {clients.length} clientes
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="font-semibold px-1">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

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
