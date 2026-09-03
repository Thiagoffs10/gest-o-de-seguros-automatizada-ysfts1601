import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Policy, CustoFixo } from '@/types'
import { formatDateDisplay, todayLocalDate } from '@/lib/utils'
import { calcNetCommission } from '@/lib/financial-calcs'
import {
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  Clock,
  ShieldCheck,
  Building,
  User,
  ArrowUpDown,
  Check,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export type ConciliacaoDetailType =
  | 'producao'
  | 'comissoes-previstas'
  | 'comissoes-recebidas'
  | 'comissoes-pendentes'
  | 'repasses-pagos'
  | 'repasses-pendentes'
  | 'custos-pagos'
  | 'custos-pendentes'

interface ConciliacaoDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: ConciliacaoDetailType | null
  periodLabel: string
  policies: Policy[]
  otherPeriodPolicies?: Policy[]
  custos: CustoFixo[]
  canEdit: boolean
  onMarkCommissionReceived: (policyId: string) => Promise<void>
  onMarkRepassePaid?: (policyId: string) => Promise<void>
  onMarkCustoPaid?: (custoId: string) => Promise<void>
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ConciliacaoDetailModal({
  open,
  onOpenChange,
  type,
  periodLabel,
  policies,
  otherPeriodPolicies = [],
  custos,
  canEdit,
  onMarkCommissionReceived,
  onMarkRepassePaid,
  onMarkCustoPaid,
}: ConciliacaoDetailModalProps) {
  const [search, setSearch] = useState('')
  const [seguradoraFilter, setSeguradoraFilter] = useState('ALL')
  const [partnerFilter, setPartnerFilter] = useState('ALL')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Reset local search and filters when modal closes or type changes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSearch('')
      setSeguradoraFilter('ALL')
      setPartnerFilter('ALL')
      setActionLoadingId(null)
    }
    onOpenChange(isOpen)
  }

  const today = todayLocalDate()

  // Helper to compute days pending since policy start_date or date
  const computeDaysPending = (dateStr?: string) => {
    if (!dateStr) return null
    const cleanDate = dateStr.split('T')[0].split(' ')[0]
    const d1 = new Date(cleanDate)
    const d2 = new Date(today)
    const diffTime = d2.getTime() - d1.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Determine metadata based on type
  const meta = useMemo(() => {
    switch (type) {
      case 'comissoes-pendentes':
        return {
          title: 'Detalhamento de Comissões Pendentes',
          subtitle: `Apólices com início no período (${periodLabel}) que ainda não tiveram comissão recebida`,
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
          badgeText: 'Pendente',
          isPolicy: true,
          isCustos: false,
        }
      case 'comissoes-recebidas':
        return {
          title: 'Detalhamento de Comissões Recebidas',
          subtitle: `Comissões recebidas de apólices com vigência neste período (${periodLabel})`,
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          badgeText: 'Recebida',
          isPolicy: true,
          isCustos: false,
        }
      case 'comissoes-previstas':
        return {
          title: 'Detalhamento de Comissões Previstas',
          subtitle: `Todas as apólices iniciadas no período (${periodLabel})`,
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
          badgeText: 'Prevista',
          isPolicy: true,
          isCustos: false,
        }
      case 'producao':
        return {
          title: 'Detalhamento da Produção (Apólices do Mês)',
          subtitle: `Total de apólices com início no período (${periodLabel})`,
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
          badgeText: 'Apólice',
          isPolicy: true,
          isCustos: false,
        }
      case 'repasses-pagos':
        return {
          title: 'Detalhamento de Repasses Pagos',
          subtitle: `Repasses a parceiros das apólices do período (${periodLabel})`,
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          badgeText: 'Pago',
          isPolicy: true,
          isCustos: false,
        }
      case 'repasses-pendentes':
        return {
          title: 'Detalhamento de Repasses Pendentes',
          subtitle: `Repasses de parceiros ainda não pagos para as apólices do período (${periodLabel})`,
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
          badgeText: 'Pendente',
          isPolicy: true,
          isCustos: false,
        }
      case 'custos-pagos':
        return {
          title: 'Detalhamento de Custos Pagos',
          subtitle: `Despesas e custos pagos no período (${periodLabel})`,
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          badgeText: 'Pago',
          isPolicy: false,
          isCustos: true,
        }
      case 'custos-pendentes':
        return {
          title: 'Detalhamento de Custos Pendentes',
          subtitle: `Despesas e custos pendentes de pagamento no período (${periodLabel})`,
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
          badgeText: 'Pendente',
          isPolicy: false,
          isCustos: true,
        }
      default:
        return {
          title: 'Detalhamento',
          subtitle: periodLabel,
          badgeClass: 'bg-slate-100 text-slate-800',
          badgeText: '',
          isPolicy: false,
          isCustos: false,
        }
    }
  }, [type, periodLabel])

  // Extract unique seguradoras and partners for filter dropdowns
  const availableSeguradoras = useMemo(() => {
    const set = new Set<string>()
    policies.forEach((p) => {
      const segName = p.expand?.seguradora?.nome || p.insurance_company
      if (segName) set.add(segName)
    })
    otherPeriodPolicies.forEach((p) => {
      const segName = p.expand?.seguradora?.nome || p.insurance_company
      if (segName) set.add(segName)
    })
    return Array.from(set).sort()
  }, [policies, otherPeriodPolicies])

  const availablePartners = useMemo(() => {
    const set = new Set<string>()
    policies.forEach((p) => {
      const partnerName = p.expand?.parceiro?.nome
      if (partnerName) set.add(partnerName)
    })
    otherPeriodPolicies.forEach((p) => {
      const partnerName = p.expand?.parceiro?.nome
      if (partnerName) set.add(partnerName)
    })
    return Array.from(set).sort()
  }, [policies, otherPeriodPolicies])

  const filterPolicyItem = (p: Policy) => {
    const segName = p.expand?.seguradora?.nome || p.insurance_company || ''
    const partnerName = p.expand?.parceiro?.nome || ''
    const clientName = p.expand?.client?.name || ''
    const policyNum = p.policy_number || ''
    const tipoSeguro = p.tipo_de_seguro || p.coverage_type || ''

    if (seguradoraFilter !== 'ALL' && segName !== seguradoraFilter) return false
    if (partnerFilter !== 'ALL' && partnerName !== partnerFilter) return false

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      const match =
        clientName.toLowerCase().includes(q) ||
        policyNum.toLowerCase().includes(q) ||
        segName.toLowerCase().includes(q) ||
        partnerName.toLowerCase().includes(q) ||
        tipoSeguro.toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  }

  // Filter policies based on search, seguradora, partner
  const filteredPolicies = useMemo(() => {
    if (!meta.isPolicy) return []
    return policies.filter(filterPolicyItem)
  }, [policies, meta.isPolicy, seguradoraFilter, partnerFilter, search])

  // Filter policies of other periods
  const filteredOtherPolicies = useMemo(() => {
    if (!meta.isPolicy || !otherPeriodPolicies.length) return []
    return otherPeriodPolicies.filter(filterPolicyItem)
  }, [otherPeriodPolicies, meta.isPolicy, seguradoraFilter, partnerFilter, search])

  // Filter custos based on search
  const filteredCustos = useMemo(() => {
    if (!meta.isCustos) return []
    return custos.filter((c) => {
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const match =
          (c.descricao || '').toLowerCase().includes(q) ||
          (c.categoria || '').toLowerCase().includes(q) ||
          (c.observacoes || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [custos, meta.isCustos, search])

  // Total amount calculated on the filtered list of the selected month
  const totalAmount = useMemo(() => {
    if (meta.isCustos) {
      return filteredCustos.reduce((acc, c) => acc + (c.valor || 0), 0)
    }
    if (type === 'repasses-pagos' || type === 'repasses-pendentes') {
      return filteredPolicies.reduce((acc, p) => acc + (p.valor_repasse || 0), 0)
    }
    if (type === 'producao') {
      return filteredPolicies.reduce(
        (acc, p) => acc + (p.valor_liquido || p.premium_amount || 0),
        0,
      )
    }
    return filteredPolicies.reduce((acc, p) => acc + calcNetCommission(p), 0)
  }, [meta.isCustos, type, filteredCustos, filteredPolicies])

  const totalOtherAmount = useMemo(() => {
    if (type === 'repasses-pendentes') {
      return filteredOtherPolicies.reduce((acc, p) => acc + (p.valor_repasse || 0), 0)
    }
    return filteredOtherPolicies.reduce((acc, p) => acc + calcNetCommission(p), 0)
  }, [type, filteredOtherPolicies])

  const handleReceiveCommission = async (id: string) => {
    try {
      setActionLoadingId(id)
      await onMarkCommissionReceived(id)
    } finally {
      setActionLoadingId(null)
    }
  }

  const handlePayRepasse = async (id: string) => {
    if (!onMarkRepassePaid) return
    try {
      setActionLoadingId(id)
      await onMarkRepassePaid(id)
    } finally {
      setActionLoadingId(null)
    }
  }

  const handlePayCusto = async (id: string) => {
    if (!onMarkCustoPaid) return
    try {
      setActionLoadingId(id)
      await onMarkCustoPaid(id)
    } finally {
      setActionLoadingId(null)
    }
  }

  const renderPolicyCard = (p: Policy, isFromOtherMonth: boolean) => {
    const netComm = calcNetCommission(p)
    const clientName = p.expand?.client?.name || 'Cliente não informado'
    const segName = p.expand?.seguradora?.nome || p.insurance_company || '-'
    const partnerName = p.expand?.parceiro?.nome
    const daysPending = computeDaysPending(p.start_date)
    const isCommissionPending = !p.comissao_recebida
    const isRepassePending = p.tipo_de_venda === 'Parceiro' && !p.pago_parceiro

    return (
      <div
        key={p.id}
        className={`border rounded-lg p-3 sm:p-4 bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isFromOtherMonth
            ? 'border-amber-200 bg-amber-50/20'
            : 'hover:border-slate-300 hover:shadow-xs'
        }`}
      >
        {/* Left: Info */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900 text-sm truncate">{clientName}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
              Apólice {p.policy_number || '-'}
            </span>
            {p.tipo_de_seguro && (
              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                {p.tipo_de_seguro}
              </span>
            )}
            {isFromOtherMonth && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                Outro mês
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              Seguradora: <strong className="text-slate-700">{segName}</strong>
            </span>

            {partnerName && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Parceiro: <strong className="text-slate-700">{partnerName}</strong>
              </span>
            )}

            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Início vigência:{' '}
              <strong className="text-slate-700">{formatDateDisplay(p.start_date)}</strong>
            </span>

            {/* Data de recebimento se já recebida */}
            {p.comissao_recebida && p.data_recebimento_comissao && (
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Recebido em {formatDateDisplay(p.data_recebimento_comissao)}
              </span>
            )}

            {/* Dias pendentes se comissão ou repasse pendente */}
            {type === 'comissoes-pendentes' && daysPending !== null && (
              <span
                className={`flex items-center gap-1 font-semibold ${
                  daysPending > 30
                    ? 'text-rose-600'
                    : daysPending > 15
                      ? 'text-amber-600'
                      : 'text-slate-600'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                {daysPending === 0
                  ? 'Inicia hoje'
                  : daysPending > 0
                    ? `Pendente há ${daysPending} dia(s)`
                    : `Inicia em ${Math.abs(daysPending)} dia(s)`}
              </span>
            )}
          </div>
        </div>

        {/* Right: Values & Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div className="text-left sm:text-right">
            {type === 'repasses-pagos' || type === 'repasses-pendentes' ? (
              <>
                <span className="text-[11px] text-slate-500 block">Valor Repasse</span>
                <span className="text-base font-bold text-slate-900">
                  R$ {fmt(p.valor_repasse || 0)}
                </span>
                {p.percentual_repasse ? (
                  <span className="text-[11px] text-slate-400 block">
                    ({p.percentual_repasse}%)
                  </span>
                ) : null}
              </>
            ) : type === 'producao' ? (
              <>
                <span className="text-[11px] text-slate-500 block">Prêmio Líquido</span>
                <span className="text-base font-bold text-slate-900">
                  R$ {fmt(p.valor_liquido || p.premium_amount || 0)}
                </span>
                <span className="text-[11px] text-blue-600 block">Com. líq: R$ {fmt(netComm)}</span>
              </>
            ) : (
              <>
                <span className="text-[11px] text-slate-500 block">Comissão Líquida</span>
                <span
                  className={`text-base font-bold ${
                    p.comissao_recebida ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  R$ {fmt(netComm)}
                </span>
                {p.iss && p.iss > 0 ? (
                  <span className="text-[11px] text-slate-400 block">
                    Bruta: R$ {fmt(p.commission || 0)} (ISS: R$ {fmt(p.iss)})
                  </span>
                ) : null}
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {/* Quick Receive for Commissions */}
            {canEdit && type === 'comissoes-pendentes' && isCommissionPending && (
              <Button
                size="sm"
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-medium gap-1 px-2.5"
                disabled={actionLoadingId === p.id}
                onClick={() => handleReceiveCommission(p.id)}
                title="Marcar comissão como recebida com a data de hoje"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {actionLoadingId === p.id ? 'Baixando...' : 'Baixar'}
              </Button>
            )}

            {/* Quick Pay for Repasses */}
            {canEdit && type === 'repasses-pendentes' && isRepassePending && onMarkRepassePaid && (
              <Button
                size="sm"
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-medium gap-1 px-2.5"
                disabled={actionLoadingId === p.id}
                onClick={() => handlePayRepasse(p.id)}
                title="Marcar repasse como pago"
              >
                <Check className="w-3.5 h-3.5" />
                {actionLoadingId === p.id ? 'Salvando...' : 'Pagar'}
              </Button>
            )}

            {/* View policy link */}
            <Button
              asChild
              variant="outline"
              size="icon"
              className="h-8 w-8 text-slate-500 hover:text-slate-900"
              title="Ver apólice completa"
            >
              <Link to={`/apolices/${p.id}`} target="_blank">
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b bg-slate-50/50">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                  {meta.title}
                </DialogTitle>
                {meta.badgeText && (
                  <Badge variant="outline" className={meta.badgeClass}>
                    {meta.badgeText}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-slate-500">
                {meta.subtitle}
              </DialogDescription>
            </div>
          </div>

          {/* KPI Summary Strip */}
          <div className="mt-3 pt-3 border-t grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="bg-white border rounded-lg p-2.5">
              <span className="text-[11px] font-medium text-slate-500 block">
                {meta.isCustos ? 'Total de Custos' : 'Total de Apólices (Mês)'}
              </span>
              <span className="text-lg font-bold text-slate-900">
                {meta.isCustos ? filteredCustos.length : filteredPolicies.length}
              </span>
            </div>
            <div className="bg-white border rounded-lg p-2.5">
              <span className="text-[11px] font-medium text-slate-500 block">
                Total Financeiro ({periodLabel})
              </span>
              <span className="text-lg font-bold text-blue-600">R$ {fmt(totalAmount)}</span>
            </div>
            {filteredOtherPolicies.length > 0 && (
              <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-2.5 col-span-2 sm:col-span-1">
                <span className="text-[11px] font-medium text-amber-800 block">
                  Outros Meses ({filteredOtherPolicies.length})
                </span>
                <span className="text-lg font-bold text-amber-900">R$ {fmt(totalOtherAmount)}</span>
              </div>
            )}
          </div>

          {/* Filters Bar */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={
                  meta.isCustos
                    ? 'Buscar por descrição, categoria...'
                    : 'Buscar cliente, apólice, seguradora...'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>

            {meta.isPolicy && (
              <>
                <div className="sm:col-span-3">
                  <Select value={seguradoraFilter} onValueChange={setSeguradoraFilter}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Seguradora" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas Seguradoras</SelectItem>
                      {availableSeguradoras.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-3">
                  <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Parceiro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos Parceiros</SelectItem>
                      {availablePartners.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {meta.isPolicy ? (
            filteredPolicies.length === 0 && filteredOtherPolicies.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <AlertCircle className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-medium">Nenhum registro encontrado.</p>
                <p className="text-xs text-slate-400">
                  Verifique os filtros selecionados ou tente buscar outro termo.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Policies do mês selecionado */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {type === 'comissoes-pendentes'
                        ? `Pendências de ${periodLabel} (${filteredPolicies.length})`
                        : `${meta.title} (${filteredPolicies.length})`}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      R$ {fmt(totalAmount)}
                    </span>
                  </div>

                  {filteredPolicies.length === 0 ? (
                    <div className="p-4 border rounded-lg bg-slate-50/50 text-center text-xs text-slate-500">
                      {type === 'comissoes-pendentes'
                        ? `Nenhuma comissão pendente para o mês selecionado (${periodLabel}).`
                        : `Nenhum registro para o período (${periodLabel}).`}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredPolicies.map((p) => renderPolicyCard(p, false))}
                    </div>
                  )}
                </div>

                {/* Seção separada: Pendências de outros meses */}
                {filteredOtherPolicies.length > 0 && (
                  <div className="pt-4 border-t border-dashed border-slate-300">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                          Pendências de outros meses ({filteredOtherPolicies.length})
                        </span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                          Não somadas no fechamento deste mês
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-amber-900">
                        R$ {fmt(totalOtherAmount)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {filteredOtherPolicies.map((p) => renderPolicyCard(p, true))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : /* Custos view */
          filteredCustos.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-medium">Nenhum custo encontrado.</p>
              <p className="text-xs text-slate-400">
                Nenhum custo registrado para os filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCustos.map((c) => {
                const daysPending = computeDaysPending(c.data)
                const isCostPending = !c.pago

                return (
                  <div
                    key={c.id}
                    className="border rounded-lg p-3 sm:p-4 bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">{c.descricao}</span>
                        <Badge variant="outline" className="text-xs">
                          {c.categoria}
                        </Badge>
                        {c.tipo && (
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {c.tipo}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Data de referência:{' '}
                          <strong className="text-slate-700">{formatDateDisplay(c.data)}</strong>
                        </span>

                        {c.pago && c.data_pagamento && (
                          <span className="flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Pago em {formatDateDisplay(c.data_pagamento)}
                            {c.forma_pagamento ? ` (${c.forma_pagamento})` : ''}
                          </span>
                        )}

                        {type === 'custos-pendentes' && daysPending !== null && (
                          <span
                            className={`flex items-center gap-1 font-semibold ${
                              daysPending > 0 ? 'text-rose-600' : 'text-slate-600'
                            }`}
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            {daysPending > 0
                              ? `Vencido há ${daysPending} dia(s)`
                              : 'Vence no período'}
                          </span>
                        )}

                        {c.observacoes && (
                          <span className="text-slate-500 italic truncate max-w-md">
                            "{c.observacoes}"
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <span className="text-[11px] text-slate-500 block">Valor</span>
                        <span
                          className={`text-base font-bold ${
                            c.pago ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          R$ {fmt(c.valor || 0)}
                        </span>
                      </div>

                      {canEdit &&
                        type === 'custos-pendentes' &&
                        isCostPending &&
                        onMarkCustoPaid && (
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-medium gap-1 px-2.5"
                            disabled={actionLoadingId === c.id}
                            onClick={() => handlePayCusto(c.id)}
                            title="Marcar custo como pago hoje"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {actionLoadingId === c.id ? 'Baixando...' : 'Pagar'}
                          </Button>
                        )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:px-5 border-t bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            {meta.isCustos
              ? `Exibindo ${filteredCustos.length} custo(s)`
              : `Exibindo ${filteredPolicies.length} apólice(s)`}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            className="h-8 text-xs"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
