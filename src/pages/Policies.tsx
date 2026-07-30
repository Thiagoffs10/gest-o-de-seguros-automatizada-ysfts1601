import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Download, Car } from 'lucide-react'
import { getPolicies, createPolicy } from '@/services/policies'
import { getClients } from '@/services/clients'
import { getSeguradoras } from '@/services/seguradoras'
import { getParceiros } from '@/services/parceiros'
import { Policy, Client, Seguradora, Parceiro, FilterState } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PolicyFormDialog } from '@/components/PolicyFormDialog'
import { GlobalFilters } from '@/components/GlobalFilters'
import { buildFilterString } from '@/lib/constants'
import { exportPoliciesToCsv } from '@/lib/export-utils'
import { useToast } from '@/hooks/use-toast'

export default function Policies() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([])
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [search, setSearch] = useState('')
  const [placaSearch, setPlacaSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({})

  const loadData = useCallback(async () => {
    try {
      const [cls, segs, pars] = await Promise.all([getClients(), getSeguradoras(), getParceiros()])
      setClients(cls)
      setSeguradoras(segs)
      setParceiros(pars)
      let filter = buildFilterString('', filters, 'start_date')
      if (statusFilter !== 'ALL')
        filter = filter ? `${filter} && status = "${statusFilter}"` : `status = "${statusFilter}"`
      if (search) {
        const q = `policy_number ~ "${search}" || insurance_company ~ "${search}"`
        filter = filter ? `${filter} && (${q})` : q
      }
      if (placaSearch) {
        const q = `placa ~ "${placaSearch}"`
        filter = filter ? `${filter} && (${q})` : q
      }
      const data = await getPolicies(filter)
      setPolicies(data)
    } catch {
      /* intentionally ignored */
    }
  }, [search, placaSearch, statusFilter, filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreate = async (formData: any) => {
    try {
      await createPolicy(formData)
      toast({ title: 'Apólice cadastrada!' })
      setIsModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao cadastrar', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Apólices</h1>
          <p className="text-slate-500 text-sm">Registro de apólices e coberturas ativas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportPoliciesToCsv(policies)}>
            <Download className="w-4 h-4 mr-2" /> Exportar Carteira (Excel)
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova Apólice
          </Button>
        </div>
      </div>

      <GlobalFilters
        filters={filters}
        onFilterChange={setFilters}
        showSeguradoraFilter
        seguradoras={seguradoras}
        showPartnerFilter
        parceiros={parceiros}
        showTipoSeguroFilter
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Buscar por nº da apólice ou seguradora..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative flex-1">
          <Car className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Pesquisar por Placa..."
            className="pl-9"
            value={placaSearch}
            onChange={(e) => setPlacaSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os Status</SelectItem>
            <SelectItem value="Ativa">Ativa</SelectItem>
            <SelectItem value="Renovação Pendente">Renovação Pendente</SelectItem>
            <SelectItem value="Expirada">Expirada</SelectItem>
            <SelectItem value="Cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3.5">Código</th>
                <th className="p-3.5">Nº Apólice</th>
                <th className="p-3.5">Seguradora</th>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5">Tipo</th>
                <th className="p-3.5">Placa</th>
                <th className="p-3.5">Valor Líquido</th>
                <th className="p-3.5">Comissão</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center p-6 text-slate-500">
                    Nenhuma apólice encontrada.
                  </td>
                </tr>
              ) : (
                policies.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/80 cursor-pointer"
                    onClick={() => navigate(`/apolices/${p.id}`)}
                  >
                    <td className="p-3.5 font-bold text-blue-600">{p.policy_code || '-'}</td>
                    <td className="p-3.5 font-bold text-slate-900">{p.policy_number}</td>
                    <td className="p-3.5">
                      {p.expand?.seguradora?.nome || p.insurance_company || '-'}
                    </td>
                    <td className="p-3.5 font-medium">{p.expand?.client?.name || 'Indefinido'}</td>
                    <td className="p-3.5">{p.tipo_de_seguro || p.coverage_type}</td>
                    <td className="p-3.5">{p.placa || '-'}</td>
                    <td className="p-3.5 font-bold">
                      R$ {(p.valor_liquido || p.premium_amount)?.toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3.5">{p.commission_percent || p.commission || 0}%</td>
                    <td className="p-3.5">
                      <Badge
                        className={
                          p.status === 'Ativa'
                            ? 'bg-emerald-500'
                            : p.status === 'Renovação Pendente'
                              ? 'bg-amber-500'
                              : 'bg-slate-500'
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-right">
                      <Button variant="ghost" size="sm" className="text-blue-600">
                        Detalhes
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <PolicyFormDialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSubmit={handleCreate}
        clients={clients}
        seguradoras={seguradoras}
        parceiros={parceiros}
      />
    </div>
  )
}
