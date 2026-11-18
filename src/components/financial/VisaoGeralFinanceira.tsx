import { CalendarDays, TrendingUp, Landmark, Clock3, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CompetenciaProjecaoCard } from '@/components/FinancialSummaryCards'
import type { ProducaoDetailType } from '@/components/financial/ProducaoDetailModal'
import type { RecebimentoDetailType } from '@/components/financial/RecebimentoDetailModal'

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface VisaoGeralFinanceiraProps {
  periodLabel: string
  premioBrutoVendido: number
  premioLiquidoVendido: number
  comissaoBrutaPrevista: number
  issDeducoesPrevistas: number
  comissaoLiquidaPrevista: number
  recebidoNoMes: number
  saldoSemPrevisao: number
  competencias: CompetenciaProjecaoCard[]
  onOpenProducao: (type: ProducaoDetailType) => void
  onOpenRecebimento: (type: RecebimentoDetailType) => void
  onSelectCompetencia: (competenciaRaw: string) => void
  onOpenProjecaoCompetencia: (competenciaRaw: string) => void
  onVerProjecao: () => void
  onVerResultadoReal: () => void
}

/**
 * Visão Geral do Financeiro simplificada em 4 blocos:
 * 1. Vendas do mês (prêmio bruto/líquido da competência selecionada)
 * 2. Receita gerada com essas vendas (comissão bruta/líquida prevista)
 * 3. Recebido no mês (caixa real do período)
 * 4. Pendente acumulado (saldo a receber por competência, com drill-down para a aba A Receber)
 */
export function VisaoGeralFinanceira({
  periodLabel,
  premioBrutoVendido,
  premioLiquidoVendido,
  comissaoBrutaPrevista,
  issDeducoesPrevistas,
  comissaoLiquidaPrevista,
  recebidoNoMes,
  saldoSemPrevisao,
  competencias,
  onOpenProducao,
  onOpenRecebimento,
  onSelectCompetencia,
  onOpenProjecaoCompetencia,
  onVerProjecao,
  onVerResultadoReal,
}: VisaoGeralFinanceiraProps) {
  const totalPendente =
    Math.round((competencias.reduce((s, c) => s + c.saldoPrevisto, 0) + saldoSemPrevisao) * 100) /
    100

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
          Visão Geral Financeira
        </h2>
        <p className="text-xs text-slate-500">Período de competência: {periodLabel}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* BLOCO 1 — VENDAS DO MÊS */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpenProducao('premio_liquido')}
          onKeyDown={(e) => e.key === 'Enter' && onOpenProducao('premio_liquido')}
          className="bg-white border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              1 · Vendas do mês
            </span>
            <CalendarDays className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{fmtBRL(premioLiquidoVendido)}</div>
            <div className="text-xs text-slate-500">Prêmio líquido vendido</div>
          </div>
          <div className="text-xs text-slate-600 border-t pt-2">
            Prêmio bruto: <span className="font-semibold">{fmtBRL(premioBrutoVendido)}</span>
          </div>
        </div>

        {/* BLOCO 2 — RECEITA GERADA COM ESSAS VENDAS */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpenProducao('comissao_liquida')}
          onKeyDown={(e) => e.key === 'Enter' && onOpenProducao('comissao_liquida')}
          className="bg-white border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              2 · Receita das vendas
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-700">
              {fmtBRL(comissaoLiquidaPrevista)}
            </div>
            <div className="text-xs text-slate-500">Comissão líquida prevista</div>
          </div>
          <div className="text-xs text-slate-600 border-t pt-2">
            Comissão bruta: <span className="font-semibold">{fmtBRL(comissaoBrutaPrevista)}</span>
            <span className="text-slate-400"> · ISS: {fmtBRL(issDeducoesPrevistas)}</span>
          </div>
        </div>

        {/* BLOCO 3 — RECEBIDO NO MÊS (CAIXA) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpenRecebimento('recebida')}
          onKeyDown={(e) => e.key === 'Enter' && onOpenRecebimento('recebida')}
          className="bg-white border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              3 · Recebido no mês (caixa)
            </span>
            <Landmark className="h-4 w-4 text-sky-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{fmtBRL(recebidoNoMes)}</div>
            <div className="text-xs text-slate-500">
              Comissões efetivamente creditadas — caixa real do período
            </div>
          </div>
          <div className="border-t pt-2 flex flex-wrap items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] px-2 text-blue-700 hover:text-blue-800"
              onClick={(e) => {
                e.stopPropagation()
                onOpenRecebimento('recebida')
              }}
            >
              Abrir detalhamento de recebimentos
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] px-2 text-slate-500 hover:text-slate-800"
              onClick={(e) => {
                e.stopPropagation()
                onVerResultadoReal()
              }}
            >
              Resultado real
            </Button>
          </div>
        </div>

        {/* BLOCO 4 — PENDENTE ACUMULADO POR COMPETÊNCIA */}
        <div className="bg-white border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              4 · Pendente acumulado
            </span>
            <Clock3 className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-amber-700">{fmtBRL(totalPendente)}</div>
            <div className="text-xs text-slate-500">
              Total a receber — clique no mês para filtrar a aba A Receber
            </div>
          </div>
          <div className="border-t pt-1 max-h-44 overflow-y-auto">
            {competencias.map((c) => (
              <div
                key={c.competenciaRaw}
                className="flex items-center justify-between py-1 text-xs"
              >
                <button
                  type="button"
                  className="font-semibold text-slate-700 hover:text-blue-700"
                  onClick={() => onSelectCompetencia(c.competenciaRaw)}
                  title={`Ver a receber de ${c.competenciaLabel}`}
                >
                  {c.competenciaLabel}
                </button>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-amber-700">{fmtBRL(c.saldoPrevisto)}</span>
                  <button
                    type="button"
                    title="Ver projeção da competência"
                    onClick={() => onOpenProjecaoCompetencia(c.competenciaRaw)}
                  >
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700" />
                  </button>
                </div>
              </div>
            ))}
            {saldoSemPrevisao > 0.009 && (
              <div className="flex items-center justify-between py-1 text-xs">
                <button
                  type="button"
                  className="font-semibold text-slate-500 hover:text-slate-800"
                  onClick={() => onOpenRecebimento('sem_previsao')}
                >
                  Sem previsão
                </button>
                <span className="font-bold text-amber-700">{fmtBRL(saldoSemPrevisao)}</span>
              </div>
            )}
            {competencias.length === 0 && saldoSemPrevisao <= 0.009 && (
              <div className="py-2 text-xs text-slate-400">Nenhuma pendência acumulada</div>
            )}
          </div>
          <div className="pt-1 text-right">
            <Button
              variant="link"
              size="sm"
              className="h-6 text-[11px] px-0"
              onClick={onVerProjecao}
            >
              Ver projeção completa
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
