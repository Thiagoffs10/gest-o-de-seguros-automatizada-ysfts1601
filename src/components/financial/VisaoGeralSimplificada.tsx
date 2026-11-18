import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, HandCoins, Receipt, ShoppingBag, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { CompetenciaProjecaoCard } from '@/components/FinancialSummaryCards'

export type ProducaoDetalheTipo =
  | 'premio_bruto'
  | 'premio_liquido'
  | 'comissao_bruta'
  | 'comissao_liquida'

const SEM_PREVISAO = 'SEM_PREVISAO'

interface VisaoGeralSimplificadaProps {
  periodLabel: string
  premioBruto: number
  premioLiquido: number
  comissaoBruta: number
  comissaoLiquida: number
  recebidoNoMes: number
  recebidoSistema: number
  recebidoLegado: number
  competencias: CompetenciaProjecaoCard[]
  saldoSemPrevisao: number
  countSemPrevisao: number
  onDetalheProducao: (tipo: ProducaoDetalheTipo) => void
  onDetalheRecebido: () => void
  onIrParaAReceber: (competenciaRaw: string | null) => void
}

function BlocoCard({
  icone,
  titulo,
  hint,
  children,
  destaque,
}: {
  icone: React.ReactNode
  titulo: string
  hint: string
  children: React.ReactNode
  destaque?: boolean
}) {
  return (
    <Card
      className={`shadow-xs ${destaque ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-md ${
              destaque ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {icone}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 truncate">
              {titulo}
            </p>
            <p className="text-[10px] text-slate-400 truncate">{hint}</p>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function ValorLinha({
  rotulo,
  valor,
  onClick,
  principal,
}: {
  rotulo: string
  valor: number
  onClick?: () => void
  principal?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
        onClick ? 'hover:bg-slate-100/80 cursor-pointer' : 'cursor-default'
      }`}
    >
      <span className="text-xs text-slate-500 shrink-0">{rotulo}</span>
      <span
        className={`font-bold tabular-nums ${principal ? 'text-base text-slate-900' : 'text-sm text-slate-700'}`}
      >
        {formatCurrency(valor)}
      </span>
    </button>
  )
}

export function VisaoGeralSimplificada({
  periodLabel,
  premioBruto,
  premioLiquido,
  comissaoBruta,
  comissaoLiquida,
  recebidoNoMes,
  recebidoSistema,
  recebidoLegado,
  competencias,
  saldoSemPrevisao,
  countSemPrevisao,
  onDetalheProducao,
  onDetalheRecebido,
  onIrParaAReceber,
}: VisaoGeralSimplificadaProps) {
  const competenciaAtual = periodLabel.includes('/') ? periodLabel.split(' ').pop() : null
  // Pré-seleciona a competência do período da Visão Geral; null = "Todas as competências"
  const [compSelecionada, setCompSelecionada] = useState<string | null>(null)
  const compEfetiva =
    compSelecionada ??
    competencias.find((c) => c.competencia === competenciaAtual)?.competenciaRaw ??
    (saldoSemPrevisao > 0.009 && competencias.length === 0 ? SEM_PREVISAO : SEM_PREVISAO)
  const isSemPrevisaoSelecionada = compEfetiva === SEM_PREVISAO

  const pendenteTotalAcumulado = useMemo(
    () =>
      Math.round((competencias.reduce((s, c) => s + c.saldoPrevisto, 0) + saldoSemPrevisao) * 100) /
      100,
    [competencias, saldoSemPrevisao],
  )

  const compAtual = competencias.find((c) => c.competenciaRaw === compEfetiva) || null

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-1">
        <h2 className="text-sm font-semibold text-slate-700">Visão Geral do Financeiro</h2>
        <span className="text-xs text-slate-400">Competência: {periodLabel}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* BLOCO 1 — VENDAS DO MÊS */}
        <BlocoCard
          icone={<ShoppingBag className="h-4 w-4" />}
          titulo="1. Vendas do mês"
          hint={`Prêmios vendidos em ${periodLabel}`}
        >
          <div className="space-y-1">
            <ValorLinha
              rotulo="Prêmio bruto"
              valor={premioBruto}
              principal
              onClick={() => onDetalheProducao('premio_bruto')}
            />
            <ValorLinha
              rotulo="Prêmio líquido"
              valor={premioLiquido}
              onClick={() => onDetalheProducao('premio_liquido')}
            />
          </div>
        </BlocoCard>

        {/* BLOCO 2 — RECEITA GERADA COM ESSAS VENDAS */}
        <BlocoCard
          icone={<Receipt className="h-4 w-4" />}
          titulo="2. Receita gerada"
          hint="Comissões previstas dessas vendas"
        >
          <div className="space-y-1">
            <ValorLinha
              rotulo="Comissão bruta"
              valor={comissaoBruta}
              onClick={() => onDetalheProducao('comissao_bruta')}
            />
            <ValorLinha
              rotulo="Comissão líquida (− ISS)"
              valor={comissaoLiquida}
              principal
              onClick={() => onDetalheProducao('comissao_liquida')}
            />
          </div>
        </BlocoCard>

        {/* BLOCO 3 — RECEBIDO NO MÊS (CAIXA) */}
        <BlocoCard
          icone={<Wallet className="h-4 w-4" />}
          titulo="3. Recebido no mês (caixa)"
          hint="Entradas reais no período, de qualquer competência"
          destaque
        >
          <div className="space-y-1">
            <ValorLinha
              rotulo="Total em caixa"
              valor={recebidoNoMes}
              principal
              onClick={onDetalheRecebido}
            />
            <div className="flex items-center justify-between gap-2 px-2 text-[10px] text-slate-400">
              <span>Sistema: {formatCurrency(recebidoSistema)}</span>
              <span>Legado: {formatCurrency(recebidoLegado)}</span>
            </div>
          </div>
        </BlocoCard>

        {/* BLOCO 4 — PENDENTE ACUMULADO POR COMPETÊNCIA */}
        <BlocoCard
          icone={<HandCoins className="h-4 w-4" />}
          titulo="4. Pendente acumulado"
          hint="Comissões a receber, mês a mês"
        >
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 px-2">
              <span className="text-xs text-slate-500">Total a receber</span>
              <span className="font-bold tabular-nums text-base text-slate-900">
                {formatCurrency(pendenteTotalAcumulado)}
              </span>
            </div>

            {competencias.length > 0 || saldoSemPrevisao > 0 ? (
              <>
                <Select value={compEfetiva} onValueChange={setCompSelecionada}>
                  <SelectTrigger className="w-full h-8 text-xs bg-white">
                    <SelectValue placeholder="Selecionar competência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_PREVISAO}>Todas as competências</SelectItem>
                    {competencias.map((c) => (
                      <SelectItem key={c.competenciaRaw} value={c.competenciaRaw}>
                        {c.competencia} — {formatCurrency(c.saldoPrevisto)} ({c.count})
                      </SelectItem>
                    ))}
                    {saldoSemPrevisao > 0.009 && (
                      <SelectItem value={SEM_PREVISAO}>
                        Sem competência definida — {formatCurrency(saldoSemPrevisao)}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>

                {isSemPrevisaoSelecionada ? (
                  <p className="px-2 text-[11px] text-slate-400">
                    Selecione uma competência acima para ver quanto há a receber daquele mês.
                  </p>
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-slate-50 border border-slate-100 px-2 py-1.5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">
                        {compAtual?.competencia}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {compAtual?.count} parcela(s) • saldo{' '}
                        {formatCurrency(compAtual?.saldoPrevisto ?? 0)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-blue-600 hover:text-blue-700 gap-0.5 shrink-0"
                      onClick={() => onIrParaAReceber(compAtual?.competenciaRaw ?? null)}
                    >
                      Ver na aba A Receber
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Badge
                variant="outline"
                className="ml-2 bg-emerald-50 text-emerald-700 border-emerald-200"
              >
                Nada pendente 🎉
              </Badge>
            )}
          </div>
        </BlocoCard>
      </div>
    </div>
  )
}
