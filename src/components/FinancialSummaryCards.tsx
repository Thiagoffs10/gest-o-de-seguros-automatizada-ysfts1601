import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Banknote,
  Receipt,
  Handshake,
  DollarSign,
  ChevronRight,
  HelpCircle,
  Calendar,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export interface CompetenciaProjecaoCard {
  competencia: string // ex: "SET/26" ou "09/2026"
  competenciaRaw: string // ex: "09/2026"
  valorPrevisto: number
  valorRecebido: number
  saldoPrevisto: number
  count: number
}

interface Props {
  // BLOCO 1: PRODUÇÃO E COMISSÕES
  premioLiquidoVendido: number
  premioBrutoVendido?: number
  comissaoBrutaPrevista: number
  issDeducoesPrevistas: number
  comissaoLiquidaPrevista: number
  onPremioLiquidoClick?: () => void
  onPremioBrutoClick?: () => void
  onComissaoBrutaClick?: () => void
  onIssDeducoesClick?: () => void
  onComissaoLiquidaClick?: () => void

  // BLOCO 2: RECEBIMENTO DE COMISSÕES
  receivedCommissions: number
  systemReceivedCommissions?: number
  legacyReceivedCommissions?: number
  saldoParcialRecebido: number
  comissoesNaoRecebidas: number
  saldoTotalAReceber: number
  onComissaoRecebidaClick?: () => void
  onSaldoParcialClick?: () => void
  onComissoesNaoRecebidasClick?: () => void
  onSaldoTotalClick?: () => void

  // BLOCO 3: PROJEÇÃO DE RECEBIMENTOS
  projecoesCompetencias?: CompetenciaProjecaoCard[]
  onCompetenciaClick?: (competenciaRaw: string) => void
  saldoSemPrevisao?: number
  countSemPrevisao?: number
  onSemPrevisaoClick?: () => void
  onExpectedProfitClick?: () => void

  // RESULTADO PROJETADO (renomeado de Lucro Previsto, destacado na seção de projeção)
  expectedProfit: number

  // BLOCO 4: RESULTADO REAL DO PERÍODO
  realProfit: number
  paidRepasses: number
  paidCosts: number
  onRealProfitClick?: () => void
  onPaidRepassesClick?: () => void
  onPaidCostsClick?: () => void

  // BLOCO 5: OBRIGAÇÕES PENDENTES
  pendingRepasses: number
  pendingCosts: number
  onPendingRepassesClick?: () => void
  onPendingCostsClick?: () => void

  periodLabel: string
}

export const FinancialSummaryCards = memo(function FinancialSummaryCards({
  // BLOCO 1
  premioLiquidoVendido,
  premioBrutoVendido = 0,
  comissaoBrutaPrevista,
  issDeducoesPrevistas,
  comissaoLiquidaPrevista,
  onPremioLiquidoClick,
  onPremioBrutoClick,
  onComissaoBrutaClick,
  onIssDeducoesClick,
  onComissaoLiquidaClick,

  // BLOCO 2
  receivedCommissions,
  systemReceivedCommissions,
  legacyReceivedCommissions = 0,
  saldoParcialRecebido,
  comissoesNaoRecebidas,
  saldoTotalAReceber,
  onComissaoRecebidaClick,
  onSaldoParcialClick,
  onComissoesNaoRecebidasClick,
  onSaldoTotalClick,

  // BLOCO 3
  projecoesCompetencias = [],
  onCompetenciaClick,
  saldoSemPrevisao = 0,
  countSemPrevisao = 0,
  onSemPrevisaoClick,
  onExpectedProfitClick,

  // RESULTADO PROJETADO
  expectedProfit,

  // BLOCO 4
  realProfit,
  paidRepasses,
  paidCosts,
  onRealProfitClick,
  onPaidRepassesClick,
  onPaidCostsClick,

  // BLOCO 5
  pendingRepasses,
  pendingCosts,
  onPendingRepassesClick,
  onPendingCostsClick,

  periodLabel,
}: Props) {
  const sistemaVal =
    systemReceivedCommissions !== undefined
      ? systemReceivedCommissions
      : Math.max(0, Math.round((receivedCommissions - legacyReceivedCommissions) * 100) / 100)

  const showBreakdown = legacyReceivedCommissions > 0 || sistemaVal > 0
  const isLucroRealNegativo = realProfit < 0
  const isLucroProjetadoNegativo = expectedProfit < 0

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Painel Financeiro Consolidado • Período Selecionado: {periodLabel}
          </p>
        </div>

        {/* ============================================================ */}
        {/* BLOCO 1 — PRODUÇÃO DO PERÍODO ("PRODUÇÃO E COMISSÕES")       */}
        {/* ============================================================ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
              1. PRODUÇÃO E COMISSÕES
            </h3>
            <span className="text-[11px] text-slate-400">Vendas correspondentes ao período</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* 1. Prêmio Bruto Vendido */}
            <Card
              onClick={onPremioBrutoClick}
              role="button"
              tabIndex={0}
              className="shadow-xs cursor-pointer hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group bg-white border-slate-200 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-2.5 px-3">
                <div className="flex items-center gap-1 min-w-0">
                  <CardTitle className="text-[11px] font-medium text-slate-600 truncate">
                    Prêmio Bruto Vendido
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      Soma do prêmio total bruto das vendas correspondentes ao período/filtros
                      (venda bruta antes de deduções)
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Banknote className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform shrink-0" />
              </CardHeader>
              <CardContent className="px-3 pb-2.5 pt-0">
                <div className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  R$ {formatCurrency(premioBrutoVendido)}
                </div>
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                  <span className="truncate">Venda bruta total</span>
                  <span className="text-blue-600 font-medium group-hover:underline flex items-center shrink-0 ml-1">
                    Auditar <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 2. Prêmio Líquido Vendido */}
            <Card
              onClick={onPremioLiquidoClick}
              role="button"
              tabIndex={0}
              className="shadow-xs cursor-pointer hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group bg-white border-slate-200 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-2.5 px-3">
                <div className="flex items-center gap-1 min-w-0">
                  <CardTitle className="text-[11px] font-medium text-slate-600 truncate">
                    Prêmio Líquido Vendido
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      Soma do prêmio líquido das vendas correspondentes ao período/filtros
                    </TooltipContent>
                  </Tooltip>
                </div>
                <DollarSign className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform shrink-0" />
              </CardHeader>
              <CardContent className="px-3 pb-2.5 pt-0">
                <div className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  R$ {formatCurrency(premioLiquidoVendido)}
                </div>
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                  <span className="truncate">Base de cálculo</span>
                  <span className="text-blue-600 font-medium group-hover:underline flex items-center shrink-0 ml-1">
                    Auditar <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 3. Comissão Bruta Prevista */}
            <Card
              onClick={onComissaoBrutaClick}
              role="button"
              tabIndex={0}
              className="shadow-xs cursor-pointer hover:border-slate-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group bg-white border-slate-200 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-2.5 px-3">
                <div className="flex items-center gap-1 min-w-0">
                  <CardTitle className="text-[11px] font-medium text-slate-600 truncate">
                    Comissão Bruta Prevista
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      Soma da comissão bruta gerada pelas vendas do período antes de ISS e deduções
                    </TooltipContent>
                  </Tooltip>
                </div>
                <TrendingUp className="w-3.5 h-3.5 text-slate-600 group-hover:scale-110 transition-transform shrink-0" />
              </CardHeader>
              <CardContent className="px-3 pb-2.5 pt-0">
                <div className="text-base sm:text-lg font-bold text-slate-800 truncate">
                  R$ {formatCurrency(comissaoBrutaPrevista)}
                </div>
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                  <span className="truncate">Antes de impostos</span>
                  <span className="text-slate-600 font-medium group-hover:underline flex items-center shrink-0 ml-1">
                    Composição <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 4. ISS / Deduções Previstas */}
            <Card
              onClick={onIssDeducoesClick}
              role="button"
              tabIndex={0}
              className="shadow-xs cursor-pointer hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group bg-white border-slate-200 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-2.5 px-3">
                <div className="flex items-center gap-1 min-w-0">
                  <CardTitle className="text-[11px] font-medium text-slate-600 truncate">
                    ISS / Deduções Previstas
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      Total de deduções e impostos aplicáveis sobre a comissão do período
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Receipt className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform shrink-0" />
              </CardHeader>
              <CardContent className="px-3 pb-2.5 pt-0">
                <div className="text-base sm:text-lg font-bold text-amber-700 truncate">
                  R$ {formatCurrency(issDeducoesPrevistas)}
                </div>
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                  <span className="truncate">Impostos retidos</span>
                  <span className="text-amber-700 font-medium group-hover:underline flex items-center shrink-0 ml-1">
                    Auditar <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 5. Comissão Líquida Prevista (MAIOR DESTAQUE VISUAL — PRINCIPAL) */}
            <Card
              onClick={onComissaoLiquidaClick}
              role="button"
              tabIndex={0}
              className="shadow-sm cursor-pointer hover:border-emerald-500 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group border-emerald-300 bg-gradient-to-br from-emerald-50/70 to-emerald-100/40 ring-1 ring-emerald-200/80 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-2.5 px-3">
                <div className="flex items-center gap-1 min-w-0">
                  <CardTitle className="text-[11px] font-bold text-emerald-900 truncate">
                    Comissão Líquida Prevista
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-emerald-700 shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      Comissão que efetivamente se espera receber (Bruta Prevista - ISS/Deduções)
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider bg-emerald-200 text-emerald-900 px-1 py-0.5 rounded shrink-0">
                  Principal
                </span>
              </CardHeader>
              <CardContent className="px-3 pb-2.5 pt-0">
                <div className="text-base sm:text-lg lg:text-xl font-extrabold text-emerald-800 truncate">
                  R$ {formatCurrency(comissaoLiquidaPrevista)}
                </div>
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-emerald-700 mt-0.5 font-medium">
                  <span className="truncate">Bruta - Deduções</span>
                  <span className="group-hover:underline flex items-center font-bold shrink-0 ml-1">
                    Ver propostas <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ============================================================ */}
        {/* BLOCO 2 — RECEBIMENTOS ("RECEBIMENTO DE COMISSÕES")           */}
        {/* ============================================================ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
              2. RECEBIMENTO DE COMISSÕES
            </h3>
            <span className="text-[11px] text-slate-400">
              Movimentações e situação das comissões
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Comissão Recebida no Período */}
            <Card
              onClick={onComissaoRecebidaClick}
              role="button"
              tabIndex={0}
              className="shadow-xs cursor-pointer hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group bg-white border-slate-200 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3.5">
                <CardTitle className="text-xs font-medium text-slate-600">
                  Comissão Recebida
                </CardTitle>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
              </CardHeader>
              <CardContent className="px-3.5 pb-3">
                <div className="text-lg font-bold text-emerald-700">
                  R$ {formatCurrency(receivedCommissions)}
                </div>
                {showBreakdown ? (
                  <div className="space-y-0.5 mt-1.5 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                    <p>Baixado no sistema: R$ {formatCurrency(sistemaVal)}</p>
                    <p>
                      Histórico legado importado: R$ {formatCurrency(legacyReceivedCommissions)}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1">Efetivamente liquidado</p>
                )}
                <div className="text-right mt-1">
                  <span className="text-[10px] text-emerald-700 font-semibold group-hover:underline inline-flex items-center">
                    Auditar recebimentos <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 2. Saldo de Comissões Parcialmente Recebidas */}
            <Card
              onClick={onSaldoParcialClick}
              role="button"
              tabIndex={0}
              className="shadow-xs cursor-pointer hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group bg-white border-slate-200 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3.5">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-xs font-medium text-slate-600">
                    Saldo Parcial
                  </CardTitle>
                  <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200">
                    Parcial
                  </span>
                </div>
                <Clock className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
              </CardHeader>
              <CardContent className="px-3.5 pb-3">
                <div className="text-lg font-bold text-blue-700">
                  R$ {formatCurrency(saldoParcialRecebido)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Resíduos de comissões com baixa parcial
                </p>
                <div className="text-right mt-1">
                  <span className="text-[10px] text-blue-600 font-semibold group-hover:underline inline-flex items-center">
                    Ver parciais <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 3. Comissões Ainda Não Recebidas */}
            <Card
              onClick={onComissoesNaoRecebidasClick}
              role="button"
              tabIndex={0}
              className="shadow-xs cursor-pointer hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group bg-white border-slate-200 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3.5">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-xs font-medium text-slate-600">
                    Não Recebidas
                  </CardTitle>
                  <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200">
                    Pendente
                  </span>
                </div>
                <AlertCircle className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
              </CardHeader>
              <CardContent className="px-3.5 pb-3">
                <div className="text-lg font-bold text-amber-700">
                  R$ {formatCurrency(comissoesNaoRecebidas)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Sem nenhum recebimento até o momento
                </p>
                <div className="text-right mt-1">
                  <span className="text-[10px] text-amber-700 font-semibold group-hover:underline inline-flex items-center">
                    Ver pendentes <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 4. Saldo Total a Receber */}
            <Card
              onClick={onSaldoTotalClick}
              role="button"
              tabIndex={0}
              className="shadow-xs cursor-pointer hover:border-amber-500 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group bg-amber-50/30 border-amber-200 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3.5">
                <CardTitle className="text-xs font-bold text-amber-900">
                  Saldo Total a Receber
                </CardTitle>
                <Clock className="w-4 h-4 text-amber-700 group-hover:scale-110 transition-transform" />
              </CardHeader>
              <CardContent className="px-3.5 pb-3">
                <div className="text-lg font-extrabold text-amber-800">
                  R$ {formatCurrency(saldoTotalAReceber)}
                </div>
                <p className="text-[11px] text-slate-600 mt-1">Resíduos parciais + Não recebidas</p>
                <div className="text-right mt-1">
                  <span className="text-[10px] text-amber-800 font-bold group-hover:underline inline-flex items-center">
                    Ver todas as pendências <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ============================================================ */}
        {/* BLOCO 3 — PROJEÇÃO DE RECEBIMENTOS & RESULTADO PROJETADO     */}
        {/* ============================================================ */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-1 gap-1">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
              3. PROJEÇÃO DE RECEBIMENTOS (QUANDO ESPERAMOS RECEBER O SALDO)
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              Modelos parcelados, recorrentes e esgotamento
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-7 gap-2.5">
            {projecoesCompetencias.map((comp) => {
              const isClickable = Boolean(onCompetenciaClick)
              return (
                <Card
                  key={comp.competenciaRaw}
                  onClick={
                    isClickable ? () => onCompetenciaClick?.(comp.competenciaRaw) : undefined
                  }
                  role="button"
                  tabIndex={0}
                  className="shadow-xs cursor-pointer hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group bg-white border-slate-200 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <CardHeader className="p-2.5 pb-1 flex flex-row items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase group-hover:text-indigo-600 transition-colors">
                      {comp.competencia}
                    </span>
                    <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                  </CardHeader>
                  <CardContent className="p-2.5 pt-0">
                    <div className="text-sm font-bold text-indigo-900">
                      R$ {formatCurrency(comp.saldoPrevisto)}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                      <span>{comp.count} parcela(s)</span>
                      <span className="text-indigo-600 font-medium group-hover:underline">Ver</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Card de SEM PREVISÃO DEFINIDA (quando não há competência futura confiável) */}
            <Card
              onClick={onSemPrevisaoClick}
              role="button"
              tabIndex={0}
              className={`shadow-xs cursor-pointer hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group border-slate-200 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400 ${
                saldoSemPrevisao > 0 ? 'bg-amber-50/40 border-amber-200' : 'bg-slate-50/50'
              }`}
            >
              <CardHeader className="p-2.5 pb-1 flex flex-row items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-slate-700 uppercase group-hover:text-amber-800 transition-colors">
                    Sem Previsão
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-slate-400" />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs max-w-xs">
                      Comissões pendentes ou com saldo sem competência futura definida. Conciliação:
                      Projeções com data + Sem previsão = Saldo Total a Receber.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Clock className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-700" />
              </CardHeader>
              <CardContent className="p-2.5 pt-0">
                <div className="text-sm font-bold text-slate-800">
                  R$ {formatCurrency(saldoSemPrevisao)}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                  <span>{countSemPrevisao} item(ns)</span>
                  <span className="text-amber-700 font-medium group-hover:underline">Ver</span>
                </div>
              </CardContent>
            </Card>

            {/* Card de RESULTADO LÍQUIDO PROJETADO (clicável com memória simples) */}
            <Card
              onClick={onExpectedProfitClick}
              role="button"
              tabIndex={0}
              className="shadow-xs cursor-pointer hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group bg-slate-50 border-slate-300 col-span-2 sm:col-span-1 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <CardHeader className="p-2.5 pb-1 flex flex-row items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-slate-700 uppercase group-hover:text-indigo-600 transition-colors">
                    Res. Líq. Projetado
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-slate-400" />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs max-w-xs">
                      (+) Receitas previstas (-) Repasses previstos (-) Custos previstos = Resultado
                      Líquido Projetado. Valor ESTIMADO, nunca apresentado como recebido. Clique
                      para ver memória.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <TrendingUp className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-600 transition-colors" />
              </CardHeader>
              <CardContent className="p-2.5 pt-0">
                <div
                  className={`text-sm font-bold ${
                    isLucroProjetadoNegativo ? 'text-rose-700' : 'text-slate-800'
                  }`}
                >
                  R$ {formatCurrency(expectedProfit)}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                  <span>Estimativa</span>
                  <span className="text-indigo-600 font-medium group-hover:underline">Memória</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ============================================================ */}
        {/* BLOCO 4 — RESULTADO REAL DO PERÍODO                          */}
        {/* ============================================================ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-700 inline-block" />
              4. RESULTADO REAL DO PERÍODO (LIQUIDADO)
            </h3>
            <span className="text-[11px] text-slate-400">
              Comissões recebidas (-) Repasses pagos (-) Custos pagos
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Comissões Recebidas */}
            <Card
              onClick={onComissaoRecebidaClick}
              role="button"
              tabIndex={0}
              className="shadow-xs cursor-pointer hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group bg-white border-slate-200 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3.5">
                <CardTitle className="text-xs font-medium text-slate-600">
                  (+) Comissões Recebidas
                </CardTitle>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
              </CardHeader>
              <CardContent className="px-3.5 pb-3">
                <div className="text-lg font-bold text-emerald-700">
                  R$ {formatCurrency(receivedCommissions)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Receita realizada</span>
                  <span className="text-emerald-700 font-medium group-hover:underline flex items-center">
                    Ver recebimentos <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 2. Repasses Pagos */}
            <Card
              onClick={onPaidRepassesClick}
              role="button"
              tabIndex={0}
              className="shadow-xs cursor-pointer hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group bg-white border-slate-200 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3.5">
                <CardTitle className="text-xs font-medium text-slate-600">
                  (-) Repasses Pagos
                </CardTitle>
                <Handshake className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
              </CardHeader>
              <CardContent className="px-3.5 pb-3">
                <div className="text-lg font-bold text-amber-800">
                  R$ {formatCurrency(paidRepasses)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Parceiros quitados</span>
                  <span className="text-amber-800 font-medium group-hover:underline flex items-center">
                    Ver repasses pagos <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 3. Custos Pagos */}
            <Card
              onClick={onPaidCostsClick}
              role="button"
              tabIndex={0}
              className="shadow-xs cursor-pointer hover:border-red-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group bg-white border-slate-200 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3.5">
                <CardTitle className="text-xs font-medium text-slate-600">
                  (-) Custos Pagos
                </CardTitle>
                <Receipt className="w-4 h-4 text-red-600 group-hover:scale-110 transition-transform" />
              </CardHeader>
              <CardContent className="px-3.5 pb-3">
                <div className="text-lg font-bold text-red-700">R$ {formatCurrency(paidCosts)}</div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Despesas quitadas</span>
                  <span className="text-red-700 font-medium group-hover:underline flex items-center">
                    Ver custos pagos <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 4. LUCRO LÍQUIDO REALIZADO (GRANDE DESTAQUE) */}
            <Card
              onClick={onRealProfitClick}
              role="button"
              tabIndex={0}
              className={`shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group ring-2 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 ${
                isLucroRealNegativo
                  ? 'border-rose-300 bg-rose-50/70 ring-rose-200 hover:border-rose-400 focus-visible:ring-rose-400'
                  : 'border-emerald-300 bg-gradient-to-br from-emerald-50/80 to-blue-50/40 ring-emerald-200 hover:border-emerald-400 focus-visible:ring-emerald-400'
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3.5">
                <div className="flex items-center gap-1.5">
                  <CardTitle
                    className={`text-xs font-bold ${
                      isLucroRealNegativo ? 'text-rose-900' : 'text-slate-900'
                    }`}
                  >
                    (=) LUCRO LÍQUIDO REALIZADO
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-slate-400" />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      Clique para abrir o demonstrativo com a memória de cálculo completa
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Banknote
                  className={`w-4 h-4 ${
                    isLucroRealNegativo ? 'text-rose-700' : 'text-emerald-700'
                  } group-hover:scale-110 transition-transform`}
                />
              </CardHeader>
              <CardContent className="px-3.5 pb-3">
                <div
                  className={`text-xl font-extrabold ${
                    isLucroRealNegativo ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  R$ {formatCurrency(realProfit)}
                </div>
                <div className="flex items-center justify-between text-[11px] mt-1 font-semibold">
                  <span className={isLucroRealNegativo ? 'text-rose-600' : 'text-slate-500'}>
                    {isLucroRealNegativo ? 'Resultado Negativo' : 'Efetivamente Realizado'}
                  </span>
                  <span className="text-blue-600 group-hover:underline flex items-center font-bold">
                    Memória de cálculo <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ============================================================ */}
        {/* BLOCO 5 — OBRIGAÇÕES EM ABERTO ("OBRIGAÇÕES PENDENTES")     */}
        {/* ============================================================ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
              5. OBRIGAÇÕES PENDENTES (NÃO DESCONTADAS DO LUCRO REALIZADO)
            </h3>
            <span className="text-[11px] text-slate-400">
              Valores a pagar separados do resultado realizado
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Repasses Pendentes */}
            <Card
              onClick={onPendingRepassesClick}
              role="button"
              tabIndex={0}
              className="shadow-xs cursor-pointer hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group bg-white border-slate-200 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3.5">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-xs font-medium text-slate-600">
                    Repasses Pendentes
                  </CardTitle>
                  <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200">
                    A Pagar
                  </span>
                </div>
                <AlertCircle className="w-4 h-4 text-blue-700 group-hover:scale-110 transition-transform" />
              </CardHeader>
              <CardContent className="px-3.5 pb-3">
                <div className="text-lg font-bold text-blue-700">
                  R$ {formatCurrency(pendingRepasses)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Aguardando liquidação</span>
                  <span className="text-blue-700 font-medium group-hover:underline flex items-center">
                    Ver tela de repasses <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Custos Pendentes */}
            <Card
              onClick={onPendingCostsClick}
              role="button"
              tabIndex={0}
              className="shadow-xs cursor-pointer hover:border-red-400 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 group bg-white border-slate-200 select-none ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3.5">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-xs font-medium text-slate-600">
                    Custos Pendentes
                  </CardTitle>
                  <span className="text-[10px] font-semibold bg-red-100 text-red-700 px-1.5 py-0.2 rounded border border-red-200">
                    A Pagar
                  </span>
                </div>
                <Clock className="w-4 h-4 text-red-700 group-hover:scale-110 transition-transform" />
              </CardHeader>
              <CardContent className="px-3.5 pb-3">
                <div className="text-lg font-bold text-red-700">
                  R$ {formatCurrency(pendingCosts)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Despesas não baixadas</span>
                  <span className="text-red-700 font-medium group-hover:underline flex items-center">
                    Ver tela de custos <ChevronRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
})
