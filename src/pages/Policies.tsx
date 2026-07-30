import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Download, Car, Pencil, RefreshCw, Trash2, X } from 'lucide-react'
import {
  getPolicies,
  createPolicy,
  updatePolicy,
  deletePolicyWithRelations,
  prepareRenewalData,
  countActivePolicies,
} from '@/services/policies'
import { getClients } from '@/services/clients'
import { getSeguradoras } from '@/services/seguradoras'
import { getParceiros } from '@/services/parceiros'
import { getPayments } from '@/services/payments'
import { getReminders } from '@/services/reminders'
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
import { DeletePolicyDialog } from '@/components/DeletePolicyDialog'
import { GlobalFilters } from '@/components/GlobalFilters'
import { buildFilterString } from '@/lib/constants'
import { exportPoliciesToCsv } from '@/lib/export-utils'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'

type DialogMode = 'create' | 'edit' | 'renew' | null

export default function Policies() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { can } = usePermissions()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([])
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [search, setSearch] = useState('')
  const [placaSearch, setPlacaSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [totalActiveCount, setTotalActiveCount] = useState(0)
  const [filters, setFilters] = useState<FilterState>({})
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [deleteTarget, setDeleteTarget] = useState<Policy | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [relatedCount, setRelatedCount] = useState({ payments: 0, reminders: 0 })

  const loadData = useCallback(async () => {
    try {
      const [cls, segs, pars] = await Promise.all([getClients(), getSeguradoras(), getParceiros()])
      setClients(cls)
      setSeguradoras(segs)
      setParceiros(pars)
      const activeCount = await countActivePolicies()
      setTotalActiveCount(activeCount)
      let filter = buildFilterString('', filters, 'start_date')
      if (periodStart && periodEnd) {
        const periodFilter = `start_date >= "${periodStart}" && start_date <= "${periodEnd} 23:59:59" && status = "Ativa"`
        filter = filter ? `${filter} && (${periodFilter})` : periodFilter
      } else {
        if (statusFilter !== 'ALL')
          filter = filter ? `${filter} && status = "${statusFilter}"` : `status = "${statusFilter}"`
      }
      if (search) {
        const sanitized = search.replace(/"/g, '')
        const matchingClients = await getClients(sanitized)
        const clientIds = matchingClients.map((c) => c.id)
        if (clientIds.length === 0) {
          setPolicies([])
          return
        }
        const clientFilter = clientIds.map((id) => `client = "${id}"`).join(' || ')
        filter = filter ? `${filter} && (${clientFilter})` : clientFilter
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
  }, [search, placaSearch, statusFilter, filters, periodStart, periodEnd])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 300)
    return () => clearTimeout(timer)
  }, [loadData])
  useRealtime('policies', () => loadData())

  const handleSubmit = async (formData: any) => {
    try {
      if (dialogMode === 'edit' && selectedPolicy) {
        await updatePolicy(selectedPolicy.id, formData)
        toast({ title: 'Apólice atualizada com sucesso!' })
      } else {
        const newPolicy = await createPolicy(formData)
        toast({ title: dialogMode === 'renew' ? 'Apólice renovada!' : 'Apólice cadastrada!' })
        if (dialogMode === 'renew') {
          navigate(`/apolices/${newPolicy.id}`)
          return
        }
      }
      setDialogMode(null)
      setSelectedPolicy(null)
      setFieldErrors({})
      loadData()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao salvar', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleEdit = (policy: Policy) => {
    setSelectedPolicy(policy)
    setFieldErrors({})
    setDialogMode('edit')
  }

  const handleRenew = (policy: Policy) => {
    setSelectedPolicy(policy)
    setFieldErrors({})
    setDialogMode('renew')
  }

  const handleDeleteClick = async (policy: Policy) => {
    setDeleteTarget(policy)
    try {
      const [pays, rems] = await Promise.all([
        getPayments(`policy = "${policy.id}"`),
        getReminders(`policy = "${policy.id}"`),
      ])
      setRelatedCount({ payments: pays.length, reminders: rems.length })
    } catch {
      setRelatedCount({ payments: 0, reminders: 0 })
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deletePolicyWithRelations(deleteTarget.id)
      toast({ title: 'Apólice excluída com sucesso!' })
      setDeleteTarget(null)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: getErrorMessage(err), variant: 'destructive' })
    } finally {
      setDeleteLoading(false)
    }
  }

  const closeDialog = () => {
    setDialogMode(null)
    setSelectedPolicy(null)
    setFieldErrors({})
  }

  const initialData =
    dialogMode === 'edit' && selectedPolicy
      ? selectedPolicy
      : dialogMode === 'renew' && selectedPolicy
        ? prepareRenewalData(selectedPolicy)
        : undefined

  const dialogTitle =
    dialogMode === 'edit'
      ? 'Editar Apólice'
      : dialogMode === 'renew'
        ? 'Renovar Apólice'
        : 'Registrar Nova Apólice'

  const submitLabel =
    dialogMode === 'edit'
      ? 'Salvar Alterações'
      : dialogMode === 'renew'
        ? 'Criar Renovação'
        : 'Salvar Apólice'

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
          {can('policies', 'create') && (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setSelectedPolicy(null)
                setFieldErrors({})
                setDialogMode('create')
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Nova Apólice
            </Button>
          )}
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
            placeholder="Buscar por CPF ou CNPJ do cliente..."
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

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-slate-50 rounded-lg border">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Período:</span>
          <Input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="w-auto"
          />
          <span className="text-slate-400 text-sm">até</span>
          <Input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="w-auto"
          />
          {(periodStart || periodEnd) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPeriodStart('')
                setPeriodEnd('')
              }}
            >
              Limpar
            </Button>
          )}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-sm">
          {periodStart && periodEnd && (
            <span className="font-medium text-blue-600">
              {policies.length} apólice{policies.length !== 1 ? 's' : ''} ativa
              {policies.length !== 1 ? 's' : ''} no período selecionado
            </span>
          )}
          <span className="text-slate-500">
            Total ativas: <strong className="text-slate-700">{totalActiveCount}</strong>
          </span>
        </div>
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
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center p-6 text-slate-500">
                    {search
                      ? 'Nenhuma apólice encontrada para o CPF/CNPJ informado.'
                      : 'Nenhuma apólice encontrada.'}
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
                    <td className="p-3.5">
                      <div
                        className="flex items-center justify-end gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/apolices/${p.id}`)}
                          title="Detalhes"
                        >
                          Detalhes
                        </Button>
                        {can('policies', 'update') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600"
                            onClick={() => handleEdit(p)}
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {can('policies', 'create') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-600"
                            onClick={() => handleRenew(p)}
                            title="Renovar"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {can('policies', 'delete') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => handleDeleteClick(p)}
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      <PolicyFormDialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        onSubmit={handleSubmit}
        clients={clients}
        seguradoras={seguradoras}
        parceiros={parceiros}
        initialData={initialData}
        title={dialogTitle}
        fieldErrors={fieldErrors}
        submitLabel={submitLabel}
      />

      <DeletePolicyDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={handleDeleteConfirm}
        policyNumber={deleteTarget?.policy_number || ''}
        relatedCount={relatedCount}
        loading={deleteLoading}
      />
    </div>
  )
}
