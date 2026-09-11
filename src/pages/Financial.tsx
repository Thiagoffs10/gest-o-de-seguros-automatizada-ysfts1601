import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Edit2,
  CheckCircle2,
  Check,
  ArrowDownCircle,
  History,
  Trash2,
  Pencil,
  AlertTriangle,
  Building2,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import { getPolicies, updatePolicyFinancial } from '@/services/policies'
import { getParceiros } from '@/services/parceiros'
import { getSeguradoras } from '@/services/seguradoras'
import { getCustosFixos } from '@/services/custos-fixos'
import { getComissaoRecebimentos } from '@/services/comissao-recebimentos'
import {
  getComissoesPrevistasPaginated,
  ComissoesPrevistasPaginatedResult,
} from '@/services/modelos-comissao'
import { getProdutos } from '@/services/produtos'
import {
  Policy,
  Parceiro,
  Seguradora,
  CustoFixo,
  FilterState,
  ComissaoRecebimento,
  Produto,
} from '@/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { GlobalFilters } from '@/components/GlobalFilters'
import { FinancialSummaryCards } from '@/components/FinancialSummaryCards'
import { CommissionEditDialog, FinancialEditData } from '@/components/CommissionEditDialog'
import { RegistrarRecebimentoModal } from '@/components/RegistrarRecebimentoModal'
import { EditRecebimentoModal } from '@/components/EditRecebimentoModal'
import { EstornoRecebimentoModal } from '@/components/EstornoRecebimentoModal'
import { RotateCcw } from 'lucide-react'
import { deleteComissaoRecebimento } from '@/services/comissao-recebimentos'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
  const [recebimentoInitialComp, setRecebimentoInitialComp] = useState<string | undefined>(
    undefined,
  )
  const [historyPolicy, setHistoryPolicy] = useState<Policy | null>(null)
  const [isEditRecebimentoOpen, setIsEditRecebimentoOpen] = useState(false)
  const [editingRecebimento, setEditingRecebimento] = useState<ComissaoRecebimento | null>(null)
  const [isEstornoOpen, setIsEstornoOpen] = useState(false)
  const [estornandoRecebimento, setEstornandoRecebimento] = useState<ComissaoRecebimento | null>(
    null,
  )
  const [isDeleteRecebimentoOpen, setIsDeleteRecebimentoOpen] = useState(false)
  const [deletingRecebimento, setDeletingRecebimento] = useState<ComissaoRecebimento | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Estados para modal de Detalhamento do Saldo a Receber por Seguradora
  const [isSeguradorasModalOpen, setIsSeguradorasModalOpen] = useState(false)
  const [selectedSeguradoraDetail, setSelectedSeguradoraDetail] = useState<{
    id: string
    nome: string
  } | null>(null)

  const isOperationInProgressRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [commPage, setCommPage] = useState(1)
  const [repassePage, setRepassePage] = useState(1)
  const [produtos, setProdutos] = useState<Produto[]>([])

  // ETAPA 2B — ITEM 7: Sub-aba ou visão de comissões por competência/previsões com filtros server-side
  const [commViewTab, setCommViewTab] = useState<'apolices' | 'competencias'>('apolices')
  const [prevStatusFilter, setPrevStatusFilter] = useState<string>('ALL')
  const [prevSeguradoraFilter, setPrevSeguradoraFilter] = useState<string>('ALL')
  const [prevProdutoFilter, setPrevProdutoFilter] = useState<string>('ALL')
  const [prevPage, setPrevPage] = useState(1)
  const [prevPaginatedData, setPrevPaginatedData] = useState<ComissoesPrevistasPaginatedResult>({
    items: [],
    page: 1,
    perPage: 15,
    totalItems: 0,
    totalPages: 1,
  })
  const [prevLoading, setPrevLoading] = useState(false)

  const ITEMS_PER_PAGE = 10

  // Lê eventual ?policy= e ?competencia= da URL (quando redirecionado de PolicyDetail)
  useEffect(() => {
    const urlPolicy = searchParams.get('policy')
    const urlComp = searchParams.get('competencia')
    if (urlPolicy) {
      setPolicySearchFilter(urlPolicy)
    }
    if (urlComp) {
      setRecebimentoInitialComp(urlComp)
    }
  }, [searchParams])

  useEffect(() => {
    setCommPage(1)
    setRepassePage(1)
  }, [filters, statusFilter, commFilter, cpfCnpjFilter, policySearchFilter])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [pols, pars, segs, custos, recs, prods] = await Promise.all([
        getPolicies(),
        getParceiros(),
        getSeguradoras(),
        getCustosFixos(),
        getComissaoRecebimentos().catch(() => []),
        getProdutos().catch(() => []),
      ])
      setAllPolicies(pols)
      setParceiros(pars)
      setSeguradoras(segs)
      setCustosFixos(custos)
      setRecebimentos(recs)
      setProdutos(prods)
    } catch {
      /* ignored */
    }
    setLoading(false)
  }, [])

  // ETAPA 2B — ITEM 7: Carregar previsões por competência com paginação e filtros no servidor
  const loadPrevisoesServerSide = useCallback(async () => {
    setPrevLoading(true)
    try {
      const periodRange = computePeriodFromFilters(filters)
      const res = await getComissoesPrevistasPaginated({
        page: prevPage,
        perPage: 15,
        status: prevStatusFilter,
        seguradoraId: prevSeguradoraFilter,
        produtoId: prevProdutoFilter,
        periodStart: periodRange?.start || undefined,
        periodEnd: periodRange?.end || undefined,
      })
      setPrevPaginatedData(res)
    } catch {
      /* ignored */
    }
    setPrevLoading(false)
  }, [prevPage, prevStatusFilter, prevSeguradoraFilter, prevProdutoFilter, filters])

  useEffect(() => {
    loadPrevisoesServerSide()
  }, [loadPrevisoesServerSide])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('policies', () => {
    if (!isOperationInProgressRef.current) {
      loadData()
    }
  })
  useRealtime('custos_fixos', () => {
    if (!isOperationInProgressRef.current) {
      loadData()
    }
  })
  useRealtime('comissao_recebimentos', () => {
    if (!isOperationInProgressRef.current) {
      loadData()
      loadPrevisoesServerSide()
    }
  })
  useRealtime('comissoes_previstas', () => {
    if (!isOperationInProgressRef.current) {
      loadPrevisoesServerSide()
    }
  })

  const period = useMemo(() => computePeriodFromFilters(filters), [filters])

  // Mapa de total BRUTO recebido histórico por apólice (Regra: Já recebido = soma dos valores BRUTOS)
  const receivedGrossByPolicy = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of recebimentos) {
      const val = Number(r.valor_bruto) || 0
      map.set(r.policy, (map.get(r.policy) || 0) + val)
    }
    return map
  }, [recebimentos])

  // Mapa de total LÍQUIDO recebido por apólice (Receita líquida realizada)
  const receivedNetByPolicy = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of recebimentos) {
      const val = r.valor_liquido != null ? Number(r.valor_liquido) : Number(r.valor_bruto) || 0
      map.set(r.policy, (map.get(r.policy) || 0) + val)
    }
    return map
  }, [recebimentos])

  // Helper para verificar se comissão da apólice está quitada (Soma dos BRUTOS >= previsto)
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
      const recBruto = receivedGrossByPolicy.get(p.id) || 0
      return previsto > 0 && recBruto >= previsto - 0.009
    },
    [receivedGrossByPolicy],
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
    // Comissões recebidas (Receita líquida realizada no período)
    const receivedCommissions = computeReceivedCommissions(matchingPolicies, period, recebimentos)
    // Saldo a receber = Comissão prevista (bruta) - total BRUTO recebido
    const pendingCommissions = periodStartPolicies.reduce((sum, p) => {
      const previsto =
        p.commission != null
          ? Number(p.commission)
          : Math.round(
              (((p.valor_liquido || p.premium_amount || 0) * (p.commission_percent || 0)) / 100) *
                100,
            ) / 100
      const rec = receivedGrossByPolicy.get(p.id) ?? (p.comissao_recebida ? previsto : 0)
      const saldo = Math.max(0, Math.round((previsto - rec) * 100) / 100)
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

    // Apólices pendentes com saldo individual calculado com precisão de arredondamento em centavos
    const pendingPoliciesList = periodStartPolicies
      .map((p) => {
        const previsto =
          p.commission != null
            ? Number(p.commission)
            : Math.round(
                (((p.valor_liquido || p.premium_amount || 0) * (p.commission_percent || 0)) / 100) *
                  100,
              ) / 100
        const rec = receivedGrossByPolicy.get(p.id) ?? (p.comissao_recebida ? previsto : 0)
        const saldo = Math.max(0, Math.round((previsto - rec) * 100) / 100)
        return { policy: p, previsto, rec, saldo }
      })
      .filter((item) => item.saldo > 0)

    // Agrupamento por seguradora
    const seguradoraMap = new Map<
      string,
      {
        id: string
        nome: string
        saldoTotal: number
        policies: Array<{
          policy: Policy
          previsto: number
          rec: number
          saldo: number
        }>
      }
    >()

    for (const item of pendingPoliciesList) {
      const segId = item.policy.seguradora || item.policy.insurance_company || 'nao_identificada'
      const segNome =
        seguradoras.find((s) => s.id === item.policy.seguradora)?.nome ||
        item.policy.expand?.seguradora?.nome ||
        item.policy.insurance_company ||
        'Seguradora Não Identificada'

      if (!seguradoraMap.has(segId)) {
        seguradoraMap.set(segId, {
          id: segId,
          nome: segNome,
          saldoTotal: 0,
          policies: [],
        })
      }
      const entry = seguradoraMap.get(segId)!
      entry.saldoTotal = Math.round((entry.saldoTotal + item.saldo) * 100) / 100
      entry.policies.push(item)
    }

    const seguradorasBreakdown = Array.from(seguradoraMap.values()).sort(
      (a, b) => b.saldoTotal - a.saldoTotal,
    )

    // Total consolidado por seguradoras arredondado a 2 casas
    const totalSeguradorasSaldo =
      Math.round(seguradorasBreakdown.reduce((sum, s) => sum + s.saldoTotal, 0) * 100) / 100

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
      pendingPoliciesList,
      seguradorasBreakdown,
      totalSeguradorasSaldo,
    }
  }, [matchingPolicies, custosFixos, period, recebimentos, receivedGrossByPolicy, seguradoras])

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

  const handleOpenRegistrarRecebimento = (policy: Policy, competenciaPreenchida?: string) => {
    setRecebimentoPolicy(policy)
    setRecebimentoInitialComp(competenciaPreenchida || undefined)
  }

  const handleConfirmDeleteRecebimento = async () => {
    if (!deletingRecebimento || deleteLoading) return
    const recId = deletingRecebimento.id
    const targetPolicyId = deletingRecebimento.policy
    setDeleteLoading(true)
    setIsDeleteRecebimentoOpen(false)
    try {
      await deleteComissaoRecebimento(recId, targetPolicyId)
      toast({
        title: 'Recebimento excluído com sucesso!',
        description: 'Os valores financeiros e o status foram recalculados.',
      })
      setTimeout(() => {
        loadData()
      }, 50)
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir recebimento',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleQuickPayRepasse = async (policyId: string) => {
    if (saving) return
    setSaving(true)
    try {
      await updatePolicyFinancial(policyId, {
        pago_parceiro: true,
        data_pagamento_parceiro: todayLocalDate(),
      })
      toast({ title: 'Repasse marcado como pago!' })
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
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
        onSaldoAReceberClick={() => {
          setSelectedSeguradoraDetail(null)
          setIsSeguradorasModalOpen(true)
        }}
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

      {/* ETAPA 2B — ITEM 7: GESTÃO E VISÃO GERAL DE COMISSÕES */}
      <Card className="shadow-sm overflow-hidden border">
        <CardHeader className="bg-slate-50/70 border-b pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Gestão e Visão Geral de Comissões
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Acompanhamento consolidado por contrato ou detalhado por competência/parcela
                prevista
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCommViewTab('apolices')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  commViewTab === 'apolices'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Por Apólice
              </button>
              <button
                type="button"
                onClick={() => setCommViewTab('competencias')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  commViewTab === 'competencias'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Por Competência (Previsões)
              </button>
            </div>
          </div>
        </CardHeader>

        {commViewTab === 'competencias' ? (
          <div>
            {/* Filtros server-side para competências */}
            <div className="p-3 bg-slate-50/50 border-b flex flex-wrap items-center gap-2">
              <Select
                value={prevStatusFilter}
                onValueChange={(val) => {
                  setPrevStatusFilter(val)
                  setPrevPage(1)
                }}
              >
                <SelectTrigger className="w-[150px] bg-white h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Status</SelectItem>
                  <SelectItem value="Pendente">Pendentes</SelectItem>
                  <SelectItem value="Parcial">Parciais</SelectItem>
                  <SelectItem value="Recebida">Recebidas</SelectItem>
                  <SelectItem value="Cancelada">Canceladas</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={prevSeguradoraFilter}
                onValueChange={(val) => {
                  setPrevSeguradoraFilter(val)
                  setPrevPage(1)
                }}
              >
                <SelectTrigger className="w-[180px] bg-white h-8 text-xs">
                  <SelectValue placeholder="Seguradora" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as Seguradoras</SelectItem>
                  {seguradoras.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={prevProdutoFilter}
                onValueChange={(val) => {
                  setPrevProdutoFilter(val)
                  setPrevPage(1)
                }}
              >
                <SelectTrigger className="w-[180px] bg-white h-8 text-xs">
                  <SelectValue placeholder="Produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Produtos</SelectItem>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs px-2.5"
                onClick={() => {
                  setPrevStatusFilter('ALL')
                  setPrevSeguradoraFilter('ALL')
                  setPrevProdutoFilter('ALL')
                  setPrevPage(1)
                }}
              >
                Limpar
              </Button>
            </div>

            {/* Tabela de Previsões por Competência (ITEM 7) */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Seguradora</th>
                    <th className="p-3">Produto</th>
                    <th className="p-3">Competência</th>
                    <th className="p-3 text-right">Previsto</th>
                    <th className="p-3 text-right">Recebido</th>
                    <th className="p-3 text-right">Saldo</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {prevLoading ? (
                    <tr>
                      <td colSpan={9} className="text-center p-8 text-slate-500">
                        Carregando previsões...
                      </td>
                    </tr>
                  ) : prevPaginatedData.items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center p-8 text-slate-500">
                        Nenhuma comissão prevista encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    prevPaginatedData.items.map((prev) => {
                      const recsDesta = recebimentos.filter(
                        (r) =>
                          r.comissao_prevista === prev.id ||
                          (r.policy === prev.policy &&
                            r.competencia &&
                            prev.competencia &&
                            r.competencia === prev.competencia),
                      )
                      const recBrutoDesta =
                        Math.round(
                          recsDesta.reduce((acc, r) => acc + (Number(r.valor_bruto) || 0), 0) * 100,
                        ) / 100
                      const vPrev = Number(prev.valor_previsto) || 0
                      const saldoDesta = Math.max(
                        0,
                        Math.round((vPrev - recBrutoDesta) * 100) / 100,
                      )
                      const targetPolicy =
                        (prev as any).expand?.policy ||
                        allPolicies.find((p) => p.id === prev.policy)

                      const clientName =
                        (prev as any).expand?.policy?.expand?.client?.name ||
                        targetPolicy?.expand?.client?.name ||
                        '-'
                      const segNome =
                        (prev as any).expand?.policy?.expand?.seguradora?.nome ||
                        targetPolicy?.expand?.seguradora?.nome ||
                        targetPolicy?.insurance_company ||
                        '-'
                      const prodNome =
                        (prev as any).expand?.policy?.expand?.produto?.nome ||
                        targetPolicy?.expand?.produto?.nome ||
                        targetPolicy?.tipo_de_seguro ||
                        '-'

                      return (
                        <tr key={prev.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-semibold text-slate-900">{clientName}</td>
                          <td className="p-3">{segNome}</td>
                          <td className="p-3">{prodNome}</td>
                          <td className="p-3 font-bold text-slate-800">
                            {prev.competencia || `Parc. ${prev.parcela_numero}`}
                          </td>
                          <td className="p-3 text-right font-medium text-slate-900">
                            R$ {fmtMoney(vPrev)}
                          </td>
                          <td className="p-3 text-right font-semibold text-emerald-700">
                            R$ {fmtMoney(recBrutoDesta)}
                          </td>
                          <td className="p-3 text-right font-bold text-amber-700">
                            R$ {fmtMoney(saldoDesta)}
                          </td>
                          <td className="p-3 text-center">
                            <Badge
                              className={
                                prev.status === 'Recebida' || saldoDesta === 0
                                  ? 'bg-emerald-600 text-white'
                                  : prev.status === 'Parcial' || recBrutoDesta > 0
                                    ? 'bg-blue-600 text-white'
                                    : prev.status === 'Cancelada'
                                      ? 'bg-red-500 text-white'
                                      : 'bg-amber-500 text-white'
                              }
                            >
                              {saldoDesta === 0 && vPrev > 0
                                ? 'Recebida'
                                : recBrutoDesta > 0
                                  ? 'Parcial'
                                  : prev.status || 'Pendente'}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            {targetPolicy && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2 shadow-xs"
                                onClick={() =>
                                  handleOpenRegistrarRecebimento(targetPolicy, prev.competencia)
                                }
                              >
                                <ArrowDownCircle className="w-3.5 h-3.5 mr-1" />
                                Receber
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação server-side das previsões */}
            <div className="p-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50 text-xs text-slate-600">
              <span>
                Página {prevPaginatedData.page} de {prevPaginatedData.totalPages} (
                {prevPaginatedData.totalItems} previsões no total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  disabled={prevPage <= 1 || prevLoading}
                  onClick={() => setPrevPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="font-semibold px-1">
                  {prevPage} / {prevPaginatedData.totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  disabled={prevPage >= prevPaginatedData.totalPages || prevLoading}
                  onClick={() => setPrevPage((p) => Math.min(prevPaginatedData.totalPages, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
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
                      const recBrutoTotal =
                        receivedGrossByPolicy.get(p.id) ?? (p.comissao_recebida ? previsto : 0)
                      const recLiquidoTotal =
                        receivedNetByPolicy.get(p.id) ??
                        (p.comissao_recebida ? Math.max(0, previsto - (p.iss || 0)) : 0)
                      const saldo = Math.max(0, Math.round((previsto - recBrutoTotal) * 100) / 100)
                      const quitada =
                        p.comissao_recebida || (previsto > 0 && recBrutoTotal >= previsto - 0.009)
                      const parcial = !quitada && recBrutoTotal > 0
                      const acima = previsto > 0 && recBrutoTotal > previsto
                      const policyRecCount = recebimentos.filter((r) => r.policy === p.id).length

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
                          <td className="p-3 text-right">
                            <span className="font-semibold text-emerald-700 block">
                              R$ {fmtMoney(recBrutoTotal)}
                            </span>
                            {recLiquidoTotal > 0 && (
                              <span
                                className="text-[11px] text-blue-600 block"
                                title="Receita líquida creditada"
                              >
                                Líq: R$ {fmtMoney(recLiquidoTotal)}
                              </span>
                            )}
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
                              {policyRecCount > 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-slate-600 hover:text-slate-900 h-8 px-2"
                                  title={`Ver/Editar histórico de recebimentos (${policyRecCount})`}
                                  onClick={() => setHistoryPolicy(p)}
                                >
                                  <History className="w-3.5 h-3.5 mr-1" />
                                  <span className="text-xs">{policyRecCount}</span>
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
                {Math.min(commPage * ITEMS_PER_PAGE, tablePolicies.length)} de{' '}
                {tablePolicies.length} registros
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
          </>
        )}
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
        onOpenChange={(open) => {
          if (!open) {
            setRecebimentoPolicy(null)
            setRecebimentoInitialComp(undefined)
          }
        }}
        policy={recebimentoPolicy}
        seguradoras={seguradoras}
        initialCompetencia={recebimentoInitialComp}
        alreadyReceived={
          recebimentoPolicy
            ? (receivedGrossByPolicy.get(recebimentoPolicy.id) ??
              (recebimentoPolicy.comissao_recebida ? recebimentoPolicy.commission || 0 : 0))
            : 0
        }
        onSuccess={() => {
          loadData()
        }}
      />
      {/* Modal para Gerenciar/Ver/Editar Recebimentos no Financeiro */}
      <Dialog open={!!historyPolicy} onOpenChange={(open) => !open && setHistoryPolicy(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Recebimentos da Apólice</DialogTitle>
            {historyPolicy && (
              <p className="text-xs text-slate-500">
                Apólice {historyPolicy.policy_number} —{' '}
                {historyPolicy.expand?.client?.name || 'Cliente'}
              </p>
            )}
          </DialogHeader>

          {historyPolicy && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-lg border text-center text-xs">
                <div>
                  <span className="text-slate-500 block">Comissão Prevista</span>
                  <strong className="text-slate-800 text-sm">
                    R$ {fmtMoney(historyPolicy.commission || 0)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Já Recebido (Bruto)</span>
                  <strong className="text-emerald-700 text-sm">
                    R$ {fmtMoney(receivedGrossByPolicy.get(historyPolicy.id) || 0)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Receita Líquida</span>
                  <strong className="text-blue-700 text-sm">
                    R$ {fmtMoney(receivedNetByPolicy.get(historyPolicy.id) || 0)}
                  </strong>
                </div>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                    <tr>
                      <th className="p-2.5">Data</th>
                      <th className="p-2.5">Valor Bruto</th>
                      <th className="p-2.5">Imposto</th>
                      <th className="p-2.5">Valor Líquido</th>
                      <th className="p-2.5">Origem / Obs</th>
                      <th className="p-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recebimentos
                      .filter((r) => r.policy === historyPolicy.id)
                      .map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-medium">
                            {formatDateDisplay(rec.data_recebimento)}
                          </td>
                          <td
                            className={`p-2.5 font-bold ${rec.is_estorno || rec.valor_bruto < 0 ? 'text-rose-600' : ''}`}
                          >
                            {rec.valor_bruto < 0
                              ? `- R$ ${fmtMoney(Math.abs(rec.valor_bruto))}`
                              : `R$ ${fmtMoney(rec.valor_bruto)}`}
                          </td>
                          <td className="p-2.5 text-slate-500">
                            {rec.descontos_impostos
                              ? `R$ ${fmtMoney(rec.descontos_impostos)}`
                              : '-'}
                          </td>
                          <td
                            className={`p-2.5 font-bold ${rec.is_estorno || (rec.valor_liquido || 0) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}
                          >
                            {(rec.valor_liquido || 0) < 0
                              ? `- R$ ${fmtMoney(Math.abs(rec.valor_liquido || 0))}`
                              : `R$ ${fmtMoney(rec.valor_liquido)}`}
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-1.5">
                              {rec.is_estorno && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-rose-50 text-rose-700 border-rose-200"
                                >
                                  Estorno
                                </Badge>
                              )}
                              <span className="font-semibold block">{rec.origem || 'Manual'}</span>
                            </div>
                            {rec.observacao && (
                              <span className="text-[11px] text-slate-500 block">
                                {rec.observacao}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {can('policies', 'update') && !rec.is_estorno && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-7 px-2"
                                  title="Estornar recebimento"
                                  onClick={() => {
                                    setEstornandoRecebimento(rec)
                                    setIsEstornoOpen(true)
                                  }}
                                >
                                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Estornar
                                </Button>
                              )}
                              {can('policies', 'update') && !rec.is_estorno && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-blue-600 h-7 px-2"
                                  title="Editar recebimento"
                                  onClick={() => {
                                    setEditingRecebimento(rec)
                                    setIsEditRecebimentoOpen(true)
                                  }}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {can('policies', 'delete') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 h-7 px-2"
                                  title="Desfazer / Excluir"
                                  onClick={() => {
                                    setDeletingRecebimento(rec)
                                    setIsDeleteRecebimentoOpen(true)
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryPolicy(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Estorno de Recebimento no Financeiro */}
      <EstornoRecebimentoModal
        open={isEstornoOpen}
        onOpenChange={(open) => {
          setIsEstornoOpen(open)
          if (!open) setEstornandoRecebimento(null)
        }}
        recebimento={estornandoRecebimento}
        onSuccess={() => {
          setTimeout(() => {
            loadData()
          }, 50)
        }}
      />

      {/* Modal de Edição de Recebimento no Financeiro */}
      <EditRecebimentoModal
        open={isEditRecebimentoOpen}
        onOpenChange={(open) => {
          setIsEditRecebimentoOpen(open)
        }}
        recebimento={editingRecebimento}
        comissaoPrevista={
          editingRecebimento
            ? allPolicies.find((p) => p.id === editingRecebimento.policy)?.commission || 0
            : 0
        }
        totalOutrosRecebimentosBrutos={
          editingRecebimento
            ? Math.round(
                recebimentos
                  .filter(
                    (r) => r.policy === editingRecebimento.policy && r.id !== editingRecebimento.id,
                  )
                  .reduce((sum, r) => sum + (Number(r.valor_bruto) || 0), 0) * 100,
              ) / 100
            : 0
        }
        onSuccess={() => {
          setTimeout(() => {
            loadData()
          }, 50)
        }}
      />

      {/* Diálogo de Confirmação para Desfazer Recebimento */}
      <Dialog
        open={isDeleteRecebimentoOpen}
        onOpenChange={(open) => {
          setIsDeleteRecebimentoOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>Desfazer / Excluir Recebimento?</span>
            </DialogTitle>
          </DialogHeader>

          {deletingRecebimento && (
            <div className="space-y-3 text-sm text-slate-600 py-1">
              <p>Tem certeza de que deseja desfazer e excluir este recebimento de comissão?</p>
              <div className="p-3 bg-slate-50 border rounded text-xs space-y-1">
                <div>
                  <span className="text-slate-500">Data:</span>{' '}
                  <span className="font-semibold">
                    {formatDateDisplay(deletingRecebimento.data_recebimento)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Valor Bruto:</span>{' '}
                  <span className="font-semibold">
                    R$ {fmtMoney(deletingRecebimento.valor_bruto)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Valor Líquido:</span>{' '}
                  <span className="font-semibold text-emerald-700">
                    R$ {fmtMoney(deletingRecebimento.valor_liquido)}
                  </span>
                </div>
                {deletingRecebimento.origem === 'Legado' && (
                  <div className="pt-1 text-amber-700 font-medium">
                    Aviso: Registro marcado como Legado. A exclusão devolverá o saldo pendente à
                    apólice.
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteRecebimentoOpen(false)}
              disabled={deleteLoading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDeleteRecebimento}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Excluindo...' : 'Confirmar e Desfazer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhamento do Saldo a Receber por Seguradora */}
      <Dialog
        open={isSeguradorasModalOpen}
        onOpenChange={(open) => {
          setIsSeguradorasModalOpen(open)
          if (!open) setSelectedSeguradoraDetail(null)
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {selectedSeguradoraDetail && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 mr-1"
                  onClick={() => setSelectedSeguradoraDetail(null)}
                  title="Voltar para todas as seguradoras"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              <div>
                <DialogTitle className="flex items-center gap-2 text-slate-900">
                  <Building2 className="w-5 h-5 text-amber-600" />
                  <span>
                    {selectedSeguradoraDetail
                      ? `Apólices Pendentes — ${selectedSeguradoraDetail.nome}`
                      : 'Composição do Saldo a Receber por Seguradora'}
                  </span>
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Período: {period.label} • Saldo Geral a Receber: R${' '}
                  {fmtMoney(metrics.pendingCommissions)}
                </p>
              </div>
            </div>
          </DialogHeader>

          {!selectedSeguradoraDetail ? (
            // VISÃO 1: LISTAGEM DAS SEGURADORAS
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <span className="text-amber-800 font-semibold block">Total Geral Acumulado</span>
                  <span className="text-amber-700">
                    Soma exata das {metrics.seguradorasBreakdown.length} seguradora
                    {metrics.seguradorasBreakdown.length !== 1 ? 's' : ''} com pendência
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-amber-900">
                    R$ {fmtMoney(metrics.totalSeguradorasSaldo)}
                  </span>
                  {Math.abs(metrics.totalSeguradorasSaldo - metrics.pendingCommissions) > 0.009 ? (
                    <span className="block text-[11px] text-red-600 font-semibold">
                      Divergência detectada
                    </span>
                  ) : (
                    <span className="block text-[11px] text-emerald-700 font-medium">
                      ✓ Bate 100% com o saldo geral
                    </span>
                  )}
                </div>
              </div>

              {metrics.seguradorasBreakdown.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Nenhuma apólice com saldo pendente de comissão no período selecionado.
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg bg-white">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                      <tr>
                        <th className="p-3">Seguradora</th>
                        <th className="p-3 text-center">Apólices Pendentes</th>
                        <th className="p-3 text-right">Saldo Bruto a Receber</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {metrics.seguradorasBreakdown.map((seg) => (
                        <tr
                          key={seg.id}
                          className="hover:bg-amber-50/40 cursor-pointer transition-colors"
                          onClick={() =>
                            setSelectedSeguradoraDetail({ id: seg.id, nome: seg.nome })
                          }
                        >
                          <td className="p-3 font-semibold text-slate-900 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            {seg.nome}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="secondary" className="font-semibold text-xs">
                              {seg.policies.length} apólice{seg.policies.length !== 1 ? 's' : ''}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-bold text-amber-700 text-sm">
                            R$ {fmtMoney(seg.saldoTotal)}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-blue-600 hover:text-blue-800"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedSeguradoraDetail({ id: seg.id, nome: seg.nome })
                              }}
                            >
                              Ver apólices <ChevronRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t">
                      <tr>
                        <td className="p-3 text-slate-800">Total Consolidado</td>
                        <td className="p-3 text-center text-slate-800">
                          {metrics.pendingPoliciesList?.length || 0} apólices
                        </td>
                        <td className="p-3 text-right text-amber-800 text-sm">
                          R$ {fmtMoney(metrics.totalSeguradorasSaldo)}
                        </td>
                        <td className="p-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ) : (
            // VISÃO 2: APÓLICES QUE COMPÕEM O SALDO DA SEGURADORA SELECIONADA
            <div className="space-y-4 pt-2">
              {(() => {
                const segData = metrics.seguradorasBreakdown.find(
                  (s) => s.id === selectedSeguradoraDetail.id,
                )
                if (!segData) {
                  return (
                    <div className="p-4 text-center text-slate-500">
                      Nenhuma apólice encontrada para esta seguradora.
                    </div>
                  )
                }

                return (
                  <>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border text-xs">
                      <div>
                        <span className="text-slate-500 block">Seguradora Selecionada</span>
                        <strong className="text-slate-900 text-sm">{segData.nome}</strong>
                      </div>
                      <div className="text-center">
                        <span className="text-slate-500 block">Quantidade</span>
                        <strong className="text-slate-800 text-sm">
                          {segData.policies.length} apólice
                          {segData.policies.length !== 1 ? 's' : ''}
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block">Saldo Bruto a Receber</span>
                        <strong className="text-amber-700 text-sm">
                          R$ {fmtMoney(segData.saldoTotal)}
                        </strong>
                      </div>
                    </div>

                    <div className="overflow-x-auto border rounded-lg bg-white">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                          <tr>
                            <th className="p-2.5">Apólice</th>
                            <th className="p-2.5">Cliente</th>
                            <th className="p-2.5 text-right">Comissão Prevista</th>
                            <th className="p-2.5 text-right">Já Recebido</th>
                            <th className="p-2.5 text-right">Saldo a Receber</th>
                            <th className="p-2.5 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {segData.policies.map(({ policy, previsto, rec, saldo }) => (
                            <tr key={policy.id} className="hover:bg-slate-50">
                              <td className="p-2.5 font-bold text-slate-900">
                                {policy.policy_number}
                              </td>
                              <td className="p-2.5 font-medium">
                                {policy.expand?.client?.name || 'Cliente'}
                              </td>
                              <td className="p-2.5 text-right text-slate-800">
                                R$ {fmtMoney(previsto)}
                              </td>
                              <td className="p-2.5 text-right text-emerald-700 font-medium">
                                R$ {fmtMoney(rec)}
                              </td>
                              <td className="p-2.5 text-right font-bold text-amber-700">
                                R$ {fmtMoney(saldo)}
                              </td>
                              <td className="p-2.5 text-center">
                                <Badge
                                  className={
                                    policy.status === 'Ativa'
                                      ? 'bg-emerald-500'
                                      : policy.status === 'Renovação Pendente'
                                        ? 'bg-amber-500'
                                        : 'bg-slate-500'
                                  }
                                >
                                  {policy.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t">
                          <tr>
                            <td className="p-2.5 text-slate-800" colSpan={2}>
                              Subtotal da Seguradora
                            </td>
                            <td className="p-2.5 text-right text-slate-800">
                              R${' '}
                              {fmtMoney(
                                Math.round(
                                  segData.policies.reduce((sum, p) => sum + p.previsto, 0) * 100,
                                ) / 100,
                              )}
                            </td>
                            <td className="p-2.5 text-right text-emerald-700">
                              R${' '}
                              {fmtMoney(
                                Math.round(
                                  segData.policies.reduce((sum, p) => sum + p.rec, 0) * 100,
                                ) / 100,
                              )}
                            </td>
                            <td className="p-2.5 text-right text-amber-700">
                              R$ {fmtMoney(segData.saldoTotal)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          <DialogFooter className="pt-2">
            {selectedSeguradoraDetail ? (
              <Button variant="outline" onClick={() => setSelectedSeguradoraDetail(null)}>
                Voltar às Seguradoras
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setIsSeguradorasModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
