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
          subtitle: `Comissões efetivamente recebidas na data deste período (${periodLabel})`,
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
          subtitle: `Repasses a parceiros com data de pagamento no período (${periodLabel})`,
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          badgeText: 'Pago',
          isPolicy: true,
          isCustos: false,
        }
      case 'repasses-pendentes':
        return {
          title: 'Detalhamento de Repasses Pendentes',
          subtitle: `Repasses de parceiros ainda não pagos`,
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
    return Array.from(set).sort()
  }, [policies])

  const availablePartners = useMemo(() => {
    const set = new Set<string>()
    policies.forEach((p) => {
      const partnerName = p.expand?.parceiro?.nome
      if (partnerName) set.add(partnerName)
    })
    return Array.from(set).sort()
  }, [policies])

  // Filter policies based on search, seguradora, partner
  const filteredPolicies = useMemo(() => {
    if (!meta.isPolicy) return []
    return policies.filter((p) => {
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
    })
  }, [policies, meta.isPolicy, seguradoraFilter, partnerFilter, search])

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

  // Total amount calculated on the filtered list
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b bg-slate-50/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-6">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold text-slate-900">{meta.title}</DialogTitle>
                <Badge variant="outline" className={meta.badgeClass}>
                  {meta.isCustos
                    ? `${filteredCustos.length} item(ns)`
                    : `${filteredPolicies.length} apólice(s)`}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                {meta.subtitle}
              </DialogDescription>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-500 block">Total do grupo</span>
              <span className="text-xl font-bold text-slate-900">R$ {fmt(totalAmount)}</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={
                  meta.isCustos
                    ? 'Buscar por descrição, categoria...'
                    : 'Buscar por cliente, apólice, seguradora...'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-white"
              />
            </div>

            {meta.isPolicy && availableSeguradoras.length > 0 && (
              <Select value={seguradoraFilter} onValueChange={setSeguradoraFilter}>
                <SelectTrigger className="w-[170px] h-9 text-xs bg-white">
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
            )}

            {meta.isPolicy && availablePartners.length > 0 && (
              <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                <SelectTrigger className="w-[170px] h-9 text-xs bg-white">
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
            )}

            {(search || seguradoraFilter !== 'ALL' || partnerFilter !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setSeguradoraFilter('ALL')
                  setPartnerFilter('ALL')
                }}
                className="h-9 px-2 text-xs text-slate-500 hover:text-slate-900"
              >
                Limpar
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {meta.isPolicy ? (
            filteredPolicies.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <AlertCircle className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-medium">Nenhum registro encontrado.</p>
                <p className="text-xs text-slate-400">
                  Verifique os filtros selecionados ou tente buscar outro termo.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPolicies.map((p) => {
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
                      className="border rounded-lg p-3 sm:p-4 bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      {/* Left: Info */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm truncate">
                            {clientName}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                            Apólice {p.policy_number || '-'}
                          </span>
                          {p.tipo_de_seguro && (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                              {p.tipo_de_seguro}
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
                            <strong className="text-slate-700">
                              {formatDateDisplay(p.start_date)}
                            </strong>
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
                              <span className="text-[11px] text-slate-500 block">
                                Valor Repasse
                              </span>
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
                              <span className="text-[11px] text-slate-500 block">
                                Prêmio Líquido
                              </span>
                              <span className="text-base font-bold text-slate-900">
                                R$ {fmt(p.valor_liquido || p.premium_amount || 0)}
                              </span>
                              <span className="text-[11px] text-blue-600 block">
                                Com. líq: R$ {fmt(netComm)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-[11px] text-slate-500 block">
                                Comissão Líquida
                              </span>
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
                          {canEdit &&
                            type === 'repasses-pendentes' &&
                            isRepassePending &&
                            onMarkRepassePaid && (
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
                })}
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
