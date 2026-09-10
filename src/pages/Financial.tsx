import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Edit2, CheckCircle2, Check, ArrowDownCircle } from 'lucide-react'
import { getPolicies, updatePolicyFinancial } from '@/services/policies'
import { getParceiros } from '@/services/parceiros'
import { getSeguradoras } from '@/services/seguradoras'
import { getCustosFixos } from '@/services/custos-fixos'
import { getComissaoRecebimentos } from '@/services/comissao-recebimentos'
import { Policy, Parceiro, Seguradora, CustoFixo, FilterState, ComissaoRecebimento } from '@/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { GlobalFilters } from '@/components/GlobalFilters'
import { FinancialSummaryCards } from '@/components/FinancialSummaryCards'
import { CommissionEditDialog, FinancialEditData } from '@/components/CommissionEditDialog'
import { RegistrarRecebimentoModal } from '@/components/RegistrarRecebimentoModal'
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
  const [searchParams] = useSearchParams()
  const [allPolicies, setAllPolicies] = useState<Policy[]>([])
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([])
  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([])
  const [recebimentos, setRecebimentos] = useState<ComissaoRecebimento[]>([])
  const [filters, setFilters] = useState<FilterState>({
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
  })
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [commFilter, setCommFilter] = useState('ALL')
  const [cpfCnpjFilter, setCpfCnpjFilter] = useState('')
  const [policySearchFilter, setPolicySearchFilter] = useState('')
  const [editPolicy, setEditPolicy] = useState<Policy | null>(null)
  const [recebimentoPolicy, setRecebimentoPolicy] = useState<Policy | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [commPage, setCommPage] = useState(1)
  const [repassePage, setRepassePage] = useState(1)
  const ITEMS_PER_PAGE = 10

  // Lê eventual ?policy= da URL (quando redirecionado de PolicyDetail)
  useEffect(() => {
    const urlPolicy = searchParams.get('policy')
    if (urlPolicy) {
      setPolicySearchFilter(urlPolicy)
    }
  }, [searchParams])

  useEffect(() => {
    setCommPage(1)
    setRepassePage(1)
  }, [filters, statusFilter, commFilter, cpfCnpjFilter, policySearchFilter])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [pols, pars, segs, custos, recs] = await Promise.all([
        getPolicies(),
        getParceiros(),
        getSeguradoras(),
        getCustosFixos(),
        getComissaoRecebimentos().catch(() => []),
      ])
      setAllPolicies(pols)
      setParceiros(pars)
      setSeguradoras(segs)
      setCustosFixos(custos)
      setRecebimentos(recs)
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
  useRealtime('comissao_recebimentos', () => loadData())

  const period = useMemo(() => computePeriodFromFilters(filters), [filters])

  // Mapa de total recebido histórico por apólice
  const receivedByPolicy = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of recebimentos) {
      const val = Number(r.valor_liquido) || Number(r.valor_bruto) || 0
      map.set(r.policy, (map.get(r.policy) || 0) + val)
    }
    return map
  }, [recebimentos])

  // Helper para verificar se comissão da apólice está quitada
  const isPolicyCommissionSettled = useCallback(
    (p: Policy) => {
      if (p.comissao_recebida) return true
      const previsto =
        p.commission != null
          ? Number(p.commission)
          : Math.round(
              (((p.valor_liquido || p.premium_amount || 0) * (p.commission_percent || 0)) / 100) *
                100,
            ) / 100
      const rec = receivedByPolicy.get(p.id) || 0
      return previsto > 0 && rec >= previsto
    },
    [receivedByPolicy],
  )

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
      const isSettled = isPolicyCommissionSettled(p)
      if (commFilter === 'received' && !isSettled) return false
      if (commFilter === 'pending' && isSettled) return false
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
      if (policySearchFilter.trim()) {
        const query = policySearchFilter.trim().toLowerCase()
        const polNum = (p.policy_number || '').toLowerCase()
        const clientName = (p.expand?.client?.name || '').toLowerCase()
        if (!polNum.includes(query) && !clientName.includes(query)) return false
      }
      return true
    },
    [
      statusFilter,
      commFilter,
      filters,
      cpfCnpjFilter,
      policySearchFilter,
      period,
      isPolicyCommissionSettled,
    ],
  )

  // Mapa de recebimentos por apólice no período selecionado
  const recsInPeriodByPolicy = useMemo(() => {
    const set = new Set<string>()
    for (const r of recebimentos) {
      if (r.data_recebimento && isDateInPeriod(period, r.data_recebimento)) {
        set.add(r.policy)
      }
    }
    return set
  }, [recebimentos, period])

  const tablePolicies = useMemo(
    () =>
      allPolicies.filter((p) => {
        // Se o usuário digitou uma busca específica de apólice/cliente ou CPF/CNPJ, priorizar exibição
        const isTargetedSearch = Boolean(policySearchFilter.trim() || cpfCnpjFilter.trim())

        // Se filtro de comissão for 'received', incluir apólices cuja comissão foi recebida no período selecionado
        if (commFilter === 'received') {
          if (!applyFilters(p, false)) return false
          if (isTargetedSearch) return true
          const hasRecInPeriod = recsInPeriodByPolicy.has(p.id)
          const hasLegacyInPeriod =
            p.comissao_recebida === true &&
            Boolean(p.data_recebimento_comissao) &&
            isDateInPeriod(period, p.data_recebimento_comissao)
          return hasRecInPeriod || hasLegacyInPeriod
        }
        // Se filtro de comissão for 'pending'
        if (commFilter === 'pending') {
          if (!applyFilters(p, !isTargetedSearch)) return false
          return !isPolicyCommissionSettled(p)
        }
        // Se 'ALL', apólices iniciadas no período OU comissão recebida no período (ou achadas pela busca direta)
        if (!applyFilters(p, false)) return false
        if (isTargetedSearch) return true
        const inStart = isDateInPeriod(period, p.start_date)
        const inReceived =
          recsInPeriodByPolicy.has(p.id) ||
          (p.comissao_recebida === true &&
            Boolean(p.data_recebimento_comissao) &&
            isDateInPeriod(period, p.data_recebimento_comissao))
        return inStart || inReceived
      }),
    [
      allPolicies,
      applyFilters,
      commFilter,
      period,
      recsInPeriodByPolicy,
      policySearchFilter,
      cpfCnpjFilter,
      isPolicyCommissionSettled,
    ],
  )

  // Apólices filtradas pelas condições (exceto data), para aplicar regras de data do evento em comissões recebidas e repasses pagos
  const matchingPolicies = useMemo(
    () => allPolicies.filter((p) => applyFilters(p, false)),
    [allPolicies, applyFilters],
  )

  const metrics = useMemo(() => {
    // Apólices iniciadas no período (produção do mês)
    const periodStartPolicies = matchingPolicies.filter((p) => isDateInPeriod(period, p.start_date))
    const expectedCommissions = computeExpectedCommissions(periodStartPolicies, period)
    // Comissões recebidas: data de recebimento pertence ao período selecionado
    const receivedCommissions = computeReceivedCommissions(matchingPolicies, period, recebimentos)
    const pendingCommissions = periodStartPolicies.reduce((sum, p) => {
      const previsto =
        p.commission != null
          ? Number(p.commission)
          : Math.round(
              (((p.valor_liquido || p.premium_amount || 0) * (p.commission_percent || 0)) / 100) *
                100,
            ) / 100
      const rec = receivedByPolicy.get(p.id) ?? (p.comissao_recebida ? previsto : 0)
      const saldo = Math.max(0, previsto - rec)
      return sum + saldo
    }, 0)
    // Repasses pagos: data de pagamento pertence ao período selecionado
    const paidRepasses = computePaidRepasses(matchingPolicies, period)
    const pendingRepasses = computePendingRepasses(periodStartPolicies)
    const paidCosts = computePaidCosts(custosFixos, period)
    const pendingCosts = computePendingCosts(custosFixos, period)
    const expectedRepasses = computeExpectedRepasses(periodStartPolicies, period)
    const totalCustos = computeCosts(custosFixos, period)
    const expectedProfit = computeExpectedProfit(expectedCommissions, expectedRepasses, totalCustos)
    const realProfit = computeRealProfit(receivedCommissions, paidRepasses, paidCosts)

    // Repasses na tabela: apólices com repasse cuja vigência é do período (produção) OU cujo repasse pago ocorreu no período
    const partnerPols = matchingPolicies.filter((p) => {
      if (
        p.tipo_de_venda !== 'Parceiro' ||
        !(p.parceiro || p.expand?.parceiro) ||
        (p.valor_repasse || 0) <= 0
      ) {
        return false
      }
      const inStart = isDateInPeriod(period, p.start_date)
      const inPaid =
        p.pago_parceiro &&
        Boolean(p.data_pagamento_parceiro) &&
        isDateInPeriod(period, p.data_pagamento_parceiro)
      return inStart || inPaid
    })

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
  }, [matchingPolicies, custosFixos, period, recebimentos, receivedByPolicy])

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

  const handleOpenRegistrarRecebimento = (policy: Policy) => {
    setRecebimentoPolicy(policy)
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
            placeholder="Buscar por Apólice / Cliente"
            value={policySearchFilter}
            onChange={(e) => setPolicySearchFilter(e.target.value)}
            className="w-[200px] text-xs h-9 bg-white"
          />
          <Input
            placeholder="Filtrar por CPF/CNPJ"
            value={cpfCnpjFilter}
            onChange={(e) => setCpfCnpjFilter(e.target.value)}
            className="w-[160px] text-xs h-9 bg-white"
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
              setPolicySearchFilter('')
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
                <th className="p-3 text-right">Prêmio Líq.</th>
                <th className="p-3 text-right">Comissão Prevista</th>
                <th className="p-3 text-right">Já Recebido</th>
                <th className="p-3 text-right">Saldo a Receber</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tablePolicies.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center p-6 text-slate-500">
                    Nenhuma apólice encontrada.
                  </td>
                </tr>
              ) : (
                paginatedCommPolicies.map((p) => {
                  const previsto =
                    p.commission != null
                      ? Number(p.commission)
                      : Math.round(
                          (((p.valor_liquido || p.premium_amount || 0) *
                            (p.commission_percent || 0)) /
                            100) *
                            100,
                        ) / 100
                  const recTotal =
                    receivedByPolicy.get(p.id) ?? (p.comissao_recebida ? previsto : 0)
                  const saldo = Math.max(0, Math.round((previsto - recTotal) * 100) / 100)
                  const quitada = p.comissao_recebida || (previsto > 0 && recTotal >= previsto)
                  const parcial = !quitada && recTotal > 0
                  const acima = previsto > 0 && recTotal > previsto

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-bold text-slate-900">{p.policy_number}</td>
                      <td className="p-3">{p.expand?.client?.name || '-'}</td>
                      <td className="p-3">
                        {p.expand?.seguradora?.nome || p.insurance_company || '-'}
                      </td>
                      <td className="p-3">{p.tipo_de_seguro || p.coverage_type}</td>
                      <td className="p-3 text-right font-medium">
                        R$ {fmtMoney(p.valor_liquido || p.premium_amount || 0)}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        R$ {fmtMoney(previsto)}
                      </td>
                      <td className="p-3 text-right font-semibold text-emerald-700">
                        R$ {fmtMoney(recTotal)}
                      </td>
                      <td className="p-3 text-right font-bold text-amber-700">
                        R$ {fmtMoney(saldo)}
                      </td>
                      <td className="p-3 text-center">
                        {quitada ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-medium">
                            {acima ? 'Recebida (Acima)' : 'Recebida'}
                          </Badge>
                        ) : parcial ? (
                          <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-medium">
                            Parcial
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-medium">
                            Pendente
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {can('policies', 'update') && (
                            <Button
                              size="sm"
                              className={
                                quitada
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border text-xs h-8 px-2'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-2 shadow-sm'
                              }
                              title="Registrar recebimento de comissão"
                              onClick={() => handleOpenRegistrarRecebimento(p)}
                            >
                              <ArrowDownCircle className="w-3.5 h-3.5 mr-1" />
                              Registrar recebimento
                            </Button>
                          )}
                          {can('policies', 'update') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Editar Repasse Parceiro"
                              onClick={() => setEditPolicy(p)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
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

      <RegistrarRecebimentoModal
        open={!!recebimentoPolicy}
        onOpenChange={(open) => !open && setRecebimentoPolicy(null)}
        policy={recebimentoPolicy}
        seguradoras={seguradoras}
        alreadyReceived={
          recebimentoPolicy
            ? (receivedByPolicy.get(recebimentoPolicy.id) ??
              (recebimentoPolicy.comissao_recebida ? recebimentoPolicy.commission || 0 : 0))
            : 0
        }
        onSuccess={() => {
          loadData()
        }}
      />
    </div>
  )
}
