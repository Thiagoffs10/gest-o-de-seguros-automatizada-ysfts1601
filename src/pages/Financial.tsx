import { useEffect, useState, useCallback, useMemo } from 'react'
import { Edit2, CheckCircle2, Check } from 'lucide-react'
import { getPolicies, updatePolicyFinancial } from '@/services/policies'
import { getParceiros } from '@/services/parceiros'
import { getSeguradoras } from '@/services/seguradoras'
import { getCustosFixos } from '@/services/custos-fixos'
import { Policy, Parceiro, Seguradora, CustoFixo, FilterState } from '@/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { GlobalFilters } from '@/components/GlobalFilters'
import { FinancialSummaryCards } from '@/components/FinancialSummaryCards'
import { CommissionEditDialog, FinancialEditData } from '@/components/CommissionEditDialog'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'
import { matchDocument } from '@/lib/document-validators'
import { todayLocalDate, formatDateDisplay } from '@/lib/utils'
import { computePeriodFromFilters, isDateInPeriod } from '@/lib/date-filter'
import {
  calcNetCommission,
  computeReceivedCommissions,
  computePendingRepasses,
  computePaidRepasses,
  computePaidCosts,
  computePendingCosts,
  computeExpectedCommissions,
  computeExpectedRepasses,
  computeCosts,
  computeExpectedProfit,
  computeRealProfit,
  getPartnerPolicies,
} from '@/lib/financial-calcs'
import { DevTrackingPanel } from '@/components/DevTrackingPanel'
import { PortfolioExportButton } from '@/components/PortfolioExportButton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Financial() {
  const { toast } = useToast()
  const { can } = usePermissions()
  const [allPolicies, setAllPolicies] = useState<Policy[]>([])
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([])
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([])
  const [filters, setFilters] = useState<FilterState>({
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
  })
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [commFilter, setCommFilter] = useState('ALL')
  const [cpfCnpjFilter, setCpfCnpjFilter] = useState('')
  const [editPolicy, setEditPolicy] = useState<Policy | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [commPage, setCommPage] = useState(1)
  const [repassePage, setRepassePage] = useState(1)
  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    setCommPage(1)
    setRepassePage(1)
  }, [filters, statusFilter, commFilter, cpfCnpjFilter])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [pols, pars, segs, custos] = await Promise.all([
        getPolicies(),
        getParceiros(),
        getSeguradoras(),
        getCustosFixos(),
      ])
      setAllPolicies(pols)
      setParceiros(pars)
      setSeguradoras(segs)
      setCustosFixos(custos)
    } catch {
      /* ignored */
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('policies', () => loadData())
  useRealtime('custos_fixos', () => loadData())

  const period = useMemo(() => computePeriodFromFilters(filters), [filters])

  const applyFilters = useCallback(
    (p: Policy, checkDate = true): boolean => {
      if (checkDate && !isDateInPeriod(period, p.start_date)) return false

      if (statusFilter !== 'ALL') {
        if (statusFilter === 'Vencida' || statusFilter === 'Expirada') {
          if (p.status !== 'Vencida' && p.status !== 'Expirada') return false
        } else if (p.status !== statusFilter) {
          return false
        }
      }
      if (commFilter === 'received' && !p.comissao_recebida) return false
      if (commFilter === 'pending' && p.comissao_recebida) return false
      if (filters.partnerId && filters.partnerId !== 'ALL' && p.parceiro !== filters.partnerId)
        return false
      if (
        filters.seguradoraId &&
        filters.seguradoraId !== 'ALL' &&
        p.seguradora !== filters.seguradoraId
      )
        return false
      if (
        filters.tipoSeguro &&
        filters.tipoSeguro !== 'ALL' &&
        p.tipo_de_seguro !== filters.tipoSeguro &&
        p.coverage_type !== filters.tipoSeguro
      )
        return false
      if (cpfCnpjFilter.trim()) {
        if (!matchDocument(p.expand?.client, cpfCnpjFilter)) return false
      }
      return true
    },
    [statusFilter, commFilter, filters, cpfCnpjFilter, period],
  )

  const tablePolicies = useMemo(
    () => allPolicies.filter((p) => applyFilters(p, true)),
    [allPolicies, applyFilters],
  )

  const metrics = useMemo(() => {
    const expectedCommissions = computeExpectedCommissions(tablePolicies, period)
    const receivedCommissions = computeReceivedCommissions(tablePolicies, period)
    const pendingCommissions = expectedCommissions - receivedCommissions
    const paidRepasses = computePaidRepasses(tablePolicies, period)
    const pendingRepasses = computePendingRepasses(tablePolicies)
    const paidCosts = computePaidCosts(custosFixos, period)
    const pendingCosts = computePendingCosts(custosFixos, period)
    const expectedRepasses = computeExpectedRepasses(tablePolicies, period)
    const totalCustos = computeCosts(custosFixos, period)
    const expectedProfit = computeExpectedProfit(expectedCommissions, expectedRepasses, totalCustos)
    const realProfit = computeRealProfit(receivedCommissions, paidRepasses, paidCosts)
    const partnerPols = getPartnerPolicies(tablePolicies)
    return {
      expectedCommissions,
      receivedCommissions,
      pendingCommissions,
      paidRepasses,
      pendingRepasses,
      paidCosts,
      pendingCosts,
      expectedProfit,
      realProfit,
      partnerPols,
    }
  }, [allPolicies, tablePolicies, custosFixos, period])

  const totalCommPages = Math.ceil(tablePolicies.length / ITEMS_PER_PAGE) || 1
  const paginatedCommPolicies = useMemo(() => {
    const start = (commPage - 1) * ITEMS_PER_PAGE
    return tablePolicies.slice(start, start + ITEMS_PER_PAGE)
  }, [tablePolicies, commPage])

  const totalRepassePages = Math.ceil((metrics?.partnerPols?.length || 0) / ITEMS_PER_PAGE) || 1
  const paginatedPartnerPols = useMemo(() => {
    const partnerPols = metrics?.partnerPols || []
    const start = (repassePage - 1) * ITEMS_PER_PAGE
    return partnerPols.slice(start, start + ITEMS_PER_PAGE)
  }, [metrics?.partnerPols, repassePage])

  const handleQuickReceive = async (policyId: string) => {
    try {
      await updatePolicyFinancial(policyId, {
        comissao_recebida: true,
        data_recebimento_comissao: todayLocalDate(),
      })
      toast({ title: 'Comissão marcada como recebida!' })
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    }
  }

  const handleQuickPayRepasse = async (policyId: string) => {
    try {
      await updatePolicyFinancial(policyId, {
        pago_parceiro: true,
        data_pagamento_parceiro: todayLocalDate(),
      })
      toast({ title: 'Repasse marcado como pago!' })
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    }
  }

  const handleSave = async (data: FinancialEditData) => {
    if (!editPolicy) return
    setSaving(true)
    try {
      await updatePolicyFinancial(editPolicy.id, data)
      toast({ title: 'Atualizado com sucesso!' })
      setEditPolicy(null)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return <div className="text-slate-500 py-8 text-center">Carregando informações...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Controle Financeiro</h1>
          <p className="text-slate-500 text-sm">
            Gestão de comissões, repasses e performance financeira.
          </p>
        </div>
        <PortfolioExportButton policies={tablePolicies} />
      </div>

      <FinancialSummaryCards
        expectedCommissions={metrics.expectedCommissions}
        receivedCommissions={metrics.receivedCommissions}
        pendingCommissions={metrics.pendingCommissions}
        paidRepasses={metrics.paidRepasses}
        pendingRepasses={metrics.pendingRepasses}
        paidCosts={metrics.paidCosts}
        pendingCosts={metrics.pendingCosts}
        expectedProfit={metrics.expectedProfit}
        realProfit={metrics.realProfit}
        periodLabel={period.label}
      />

      <DevTrackingPanel
        policies={allPolicies}
        period={period}
        totalReceitas={metrics.receivedCommissions}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <GlobalFilters
          filters={filters}
          onFilterChange={setFilters}
          showPartnerFilter
          parceiros={parceiros}
          showSeguradoraFilter
          seguradoras={seguradoras}
          showTipoSeguroFilter
        />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Filtrar por CPF/CNPJ"
            value={cpfCnpjFilter}
            onChange={(e) => setCpfCnpjFilter(e.target.value)}
            className="w-[170px] text-xs h-9 bg-white"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os Status</SelectItem>
              <SelectItem value="Ativa">Ativa</SelectItem>
              <SelectItem value="Renovação Pendente">Renovação Pendente</SelectItem>
              <SelectItem value="Vencida">Vencida</SelectItem>
              <SelectItem value="Expirada">Expirada</SelectItem>
              <SelectItem value="Cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={commFilter} onValueChange={setCommFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Comissão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as Comissões</SelectItem>
              <SelectItem value="received">Recebidas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilters({
                year: String(new Date().getFullYear()),
                month: String(new Date().getMonth() + 1),
              })
              setStatusFilter('ALL')
              setCommFilter('ALL')
              setCpfCnpjFilter('')
            }}
          >
            Limpar Filtros
          </Button>
        </div>
      </div>

      <Card className="shadow-sm overflow-hidden border">
        <CardHeader>
          <CardTitle className="text-base font-bold">Gestão de Comissões</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3">Apólice</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Seguradora</th>
                <th className="p-3">Tipo</th>
                <th className="p-3 text-right">Bruto</th>
                <th className="p-3 text-right">Líquido</th>
                <th className="p-3 text-right">Comissão</th>
                <th className="p-3 text-right">ISS</th>
                <th className="p-3 text-right">Com. Líquida</th>
                <th className="p-3 text-center">Recebida</th>
                <th className="p-3">Data Receb.</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tablePolicies.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center p-6 text-slate-500">
                    Nenhuma apólice encontrada.
                  </td>
                </tr>
              ) : (
                paginatedCommPolicies.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-bold text-slate-900">{p.policy_number}</td>
                    <td className="p-3">{p.expand?.client?.name || '-'}</td>
                    <td className="p-3">
                      {p.expand?.seguradora?.nome || p.insurance_company || '-'}
                    </td>
                    <td className="p-3">{p.tipo_de_seguro || p.coverage_type}</td>
                    <td className="p-3 text-right">R$ {fmtMoney(p.valor_bruto || 0)}</td>
                    <td className="p-3 text-right font-bold">
                      R$ {fmtMoney(p.valor_liquido || p.premium_amount || 0)}
                    </td>
                    <td className="p-3 text-right">R$ {fmtMoney(p.commission || 0)}</td>
                    <td className="p-3 text-right text-red-600">R$ {fmtMoney(p.iss || 0)}</td>
                    <td className="p-3 text-right font-bold text-blue-600">
                      R$ {fmtMoney(calcNetCommission(p))}
                    </td>
                    <td className="p-3 text-center">
                      <Badge className={p.comissao_recebida ? 'bg-emerald-500' : 'bg-amber-500'}>
                        {p.comissao_recebida ? 'Recebida' : 'Pendente'}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs">
                      {formatDateDisplay(p.data_recebimento_comissao)}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {can('policies', 'update') && !p.comissao_recebida && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-emerald-600"
                            title="Receber Comissão"
                            onClick={() => handleQuickReceive(p.id)}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                        {can('policies', 'update') && (
                          <Button size="sm" variant="ghost" onClick={() => setEditPolicy(p)}>
                            <Edit2 className="w-3.5 h-3.5" />
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
        <div className="p-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50 text-xs text-slate-600">
          <span>
            Exibindo {tablePolicies.length === 0 ? 0 : (commPage - 1) * ITEMS_PER_PAGE + 1} a{' '}
            {Math.min(commPage * ITEMS_PER_PAGE, tablePolicies.length)} de {tablePolicies.length}{' '}
            registros
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              disabled={commPage <= 1}
              onClick={() => setCommPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="font-semibold px-1">
              Página {commPage} de {totalCommPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              disabled={commPage >= totalCommPages}
              onClick={() => setCommPage((p) => Math.min(totalCommPages, p + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      </Card>

      <Card className="shadow-sm overflow-hidden border">
        <CardHeader>
          <CardTitle className="text-base font-bold">Repasses de Parceiros</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3">Apólice</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Parceiro</th>
                <th className="p-3 text-right">Líquido</th>
                <th className="p-3 text-right">Repasse (R$)</th>
                <th className="p-3 text-center">Pago</th>
                <th className="p-3">Data Pagto</th>
                <th className="p-3">Forma</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.partnerPols.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center p-6 text-slate-500">
                    Nenhuma apólice de parceiro encontrada.
                  </td>
                </tr>
              ) : (
                paginatedPartnerPols.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-bold text-slate-900">{p.policy_number}</td>
                    <td className="p-3">{p.expand?.client?.name || '-'}</td>
                    <td className="p-3">{p.expand?.parceiro?.nome || '-'}</td>
                    <td className="p-3 text-right font-bold">
                      R$ {fmtMoney(p.valor_liquido || p.premium_amount || 0)}
                    </td>
                    <td className="p-3 text-right font-bold text-blue-600">
                      R$ {fmtMoney(p.valor_repasse || 0)}
                    </td>
                    <td className="p-3 text-center">
                      <Badge className={p.pago_parceiro ? 'bg-emerald-500' : 'bg-amber-500'}>
                        {p.pago_parceiro ? 'Pago' : 'Pendente'}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs">{formatDateDisplay(p.data_pagamento_parceiro)}</td>
                    <td className="p-3 text-xs">{p.forma_pagamento_repasse || '-'}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {can('policies', 'update') && !p.pago_parceiro && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-emerald-600"
                            title="Pagar Repasse"
                            onClick={() => handleQuickPayRepasse(p.id)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        {can('policies', 'update') && (
                          <Button size="sm" variant="ghost" onClick={() => setEditPolicy(p)}>
                            <Edit2 className="w-3.5 h-3.5" />
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
        <div className="p-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50 text-xs text-slate-600">
          <span>
            Exibindo {metrics.partnerPols.length === 0 ? 0 : (repassePage - 1) * ITEMS_PER_PAGE + 1}{' '}
            a {Math.min(repassePage * ITEMS_PER_PAGE, metrics.partnerPols.length)} de{' '}
            {metrics.partnerPols.length} registros
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              disabled={repassePage <= 1}
              onClick={() => setRepassePage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="font-semibold px-1">
              Página {repassePage} de {totalRepassePages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              disabled={repassePage >= totalRepassePages}
              onClick={() => setRepassePage((p) => Math.min(totalRepassePages, p + 1))}
            >
              Próxima
            </Button>
          </div>
        </div>
      </Card>

      <CommissionEditDialog
        open={!!editPolicy}
        onOpenChange={(open) => !open && setEditPolicy(null)}
        policy={editPolicy}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}
