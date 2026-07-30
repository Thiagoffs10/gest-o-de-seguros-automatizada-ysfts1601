import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus, Phone, Mail, Building2, User, X } from 'lucide-react'
import { getClients, createClient } from '@/services/clients'
import { formatDocumentLabel } from '@/lib/document-validators'
import { Client, FilterState } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ClientFormDialog } from '@/components/ClientFormDialog'
import { GlobalFilters } from '@/components/GlobalFilters'
import { buildFilterString } from '@/lib/constants'
import { useToast } from '@/hooks/use-toast'

export default function Clients() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({})

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Clientes</h1>
          <p className="text-slate-500 text-sm">Cadastre e gerencie a base de segurados.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsModalOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" /> Adicionar Cliente
        </Button>
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
                <th className="p-3.5 text-right">Ação</th>
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
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    onClick={() => navigate(`/clientes/${c.id}`)}
                  >
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
                      <Button variant="ghost" size="sm" className="text-blue-600">
                        Ver Detalhes
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ClientFormDialog open={isModalOpen} onOpenChange={setIsModalOpen} onSubmit={handleCreate} />
    </div>
  )
}
