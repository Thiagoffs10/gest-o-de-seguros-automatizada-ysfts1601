import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, UserCheck, Search, UserPlus, X, Download, User } from 'lucide-react'
import { getClients } from '@/services/clients'
import { getPolicies } from '@/services/policies'
import { Client, Policy, FilterState } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ClientCard } from '@/components/ClientCard'
import { ClientFormDialog } from '@/components/ClientFormDialog'
import { DeleteClientDialog } from '@/components/DeleteClientDialog'
import { GlobalFilters } from '@/components/GlobalFilters'
import { buildFilterString } from '@/lib/constants'
import { usePermissions } from '@/hooks/use-permissions'
import { useRealtime } from '@/hooks/use-realtime'
import { downloadXlsx } from '@/lib/excel-export'
import { useToast } from '@/hooks/use-toast'
import { createClient, updateClient, deleteClient } from '@/services/clients'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'

const ITEMS_PER_PAGE = 10

export default function Clients() {
  const { toast } = useToast()
  const { can } = usePermissions()
  const [clients, setClients] = useState<Client[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [search, setSearch] = useState('')
  const [nameSearch, setNameSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<FilterState>({})

  const loadClients = useCallback(async () => {
    try {
      const [data, pols] = await Promise.all([
        getClients(search, undefined, nameSearch),
        getPolicies(),
      ])
      setClients(data)
      setPolicies(pols)
    } catch {
      /* intentionally ignored */
    }
    setLoading(false)
  }, [search, nameSearch])

  useEffect(() => {
    setPage(1)
    setLoading(true)
    const timer = setTimeout(() => loadClients(), 300)
    return () => clearTimeout(timer)
  }, [loadClients])

  useRealtime('clients', () => loadClients())
  useRealtime('policies', () => loadClients())

  const totalPages = Math.max(1, Math.ceil(clients.length / ITEMS_PER_PAGE))
  const paginatedClients = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE
    return clients.slice(start, start + ITEMS_PER_PAGE)
  }, [clients, page])

  const totalClients = clients.length
  const activeClients = useMemo(() => {
    const clientsWithActivePolicies = new Set(
      policies.filter((p) => p.status === 'Ativa').map((p) => p.client),
    )
    return clients.filter((c) => clientsWithActivePolicies.has(c.id)).length
  }, [clients, policies])

  const exportAllClients = async () => {
    try {
      const exportClients = await getClients(search, undefined, nameSearch)
      const exportPols = await getPolicies()
      const polsByClient: Record<string, Policy[]> = {}
      for (const p of exportPols) {
        if (!polsByClient[p.client]) polsByClient[p.client] = []
        polsByClient[p.client].push(p)
      }
      const columns = [
        { header: 'Nome', type: 'text' as const },
        { header: 'Tipo', type: 'text' as const },
        { header: 'CPF/CNPJ', type: 'text' as const },
        { header: 'E-mail', type: 'text' as const },
        { header: 'Telefone', type: 'text' as const },
        { header: 'Cidade', type: 'text' as const },
        { header: 'UF', type: 'text' as const },
        { header: 'Total Apólices', type: 'number' as const },
        { header: 'Apólices Ativas', type: 'number' as const },
        { header: 'Data Cadastro', type: 'text' as const },
      ]
      const rows = exportClients.map((c) => {
        const cpols = polsByClient[c.id] || []
        const activeCount = cpols.filter((p) => p.status === 'Ativa').length
        return [
          c.name,
          c.tipo_pessoa === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física',
          c.cpf || c.cnpj || '',
          c.email || '',
          c.phone || '',
          c.cidade || '',
          c.estado || '',
          cpols.length,
          activeCount,
          c.created ? new Date(c.created).toLocaleDateString('pt-BR') : '',
        ]
      })
      const now = new Date()
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      downloadXlsx(`clientes_${dateStr}.xlsx`, 'Clientes', columns, rows)
      toast({
        title: 'Exportação concluída!',
        description: `${exportClients.length} cliente(s) exportado(s).`,
      })
    } catch {
      toast({
        title: 'Erro na exportação',
        description: 'Não foi possível gerar a planilha de clientes.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Carteira de Clientes</h1>
          <p className="text-slate-500 text-sm">
            Gerencie os segurados e visualize suas apólices ativas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportAllClients} disabled={clients.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Exportar Lista
          </Button>
          {can('clients', 'create') && (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setEditingClient(null)
                setIsModalOpen(true)
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Novo Cliente
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Total de Clientes</div>
            <div className="text-2xl font-bold text-slate-900">{totalClients}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Clientes Ativos</div>
            <div className="text-2xl font-bold text-slate-900">{activeClients}</div>
          </div>
        </div>
      </div>

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
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedClients.map((client) => {
              const clientPolicies = policies.filter((p) => p.client === client.id)
              const activeCount = clientPolicies.filter((p) => p.status === 'Ativa').length
              return (
                <ClientCard
                  key={client.id}
                  client={client}
                  activePoliciesCount={activeCount}
                  onEdit={(c) => {
                    setEditingClient(c)
                    setIsModalOpen(true)
                  }}
                  onDelete={(c) => setDeleteTarget(c)}
                />
              )
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <span className="text-sm text-slate-500">
              Página {page} de {totalPages} ({clients.length} cliente
              {clients.length !== 1 ? 's' : ''})
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}

      <ClientFormDialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open)
          if (!open) setEditingClient(null)
        }}
        initialData={editingClient || undefined}
        title={editingClient ? 'Editar Cliente' : 'Adicionar Novo Cliente'}
        onSubmit={async (formData) => {
          try {
            if (editingClient) {
              await updateClient(editingClient.id, formData)
              toast({ title: 'Cliente atualizado com sucesso!' })
            } else {
              await createClient(formData)
              toast({ title: 'Cliente cadastrado com sucesso!' })
            }
            setIsModalOpen(false)
            setEditingClient(null)
            loadClients()
          } catch (err) {
            toast({
              title: 'Erro ao salvar cliente',
              description: getErrorMessage(err),
              variant: 'destructive',
            })
            throw err
          }
        }}
      />

      <DeleteClientDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        clientName={deleteTarget?.name || ''}
        loading={deleteLoading}
        onConfirm={async () => {
          if (!deleteTarget) return
          setDeleteLoading(true)
          try {
            await deleteClient(deleteTarget.id)
            toast({ title: 'Cliente excluído com sucesso!' })
            setDeleteTarget(null)
            loadClients()
          } catch (err) {
            toast({
              title: 'Erro ao excluir cliente',
              description: getErrorMessage(err),
              variant: 'destructive',
            })
          } finally {
            setDeleteLoading(false)
          }
        }}
      />
    </div>
  )
}
