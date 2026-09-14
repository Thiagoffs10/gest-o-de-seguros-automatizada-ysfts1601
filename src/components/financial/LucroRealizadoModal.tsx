import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { Calculator, ArrowRight, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  receivedCommissions: number
  systemReceivedCommissions: number
  legacyReceivedCommissions: number
  paidRepasses: number
  paidCosts: number
  realProfit: number
  periodLabel: string
  onOpenRecebimentos?: () => void
  onOpenRepassesPagos?: () => void
  onOpenCustosPagos?: () => void
}

export function LucroRealizadoModal({
  open,
  onOpenChange,
  receivedCommissions,
  systemReceivedCommissions,
  legacyReceivedCommissions,
  paidRepasses,
  paidCosts,
  realProfit,
  periodLabel,
  onOpenRecebimentos,
  onOpenRepassesPagos,
  onOpenCustosPagos,
}: Props) {
  const isNegative = realProfit < 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-6">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Memória de Cálculo: Lucro Líquido Realizado
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Demonstrativo da composição real do resultado de {periodLabel}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Card de Destaque do Lucro */}
        <div
          className={`p-4 rounded-xl border text-center transition-all ${
            isNegative ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-300 shadow-sm'
          }`}
        >
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
            Lucro Líquido Realizado no Período
          </span>
          <div
            className={`text-3xl font-extrabold mt-1 flex items-center justify-center gap-1.5 ${
              isNegative ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            {isNegative ? (
              <TrendingDown className="w-7 h-7 text-rose-700" />
            ) : (
              <TrendingUp className="w-7 h-7 text-emerald-700" />
            )}
            <span>R$ {formatCurrency(realProfit)}</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            Fórmula: (+) Comissões Recebidas - (-) Repasses Pagos - (-) Custos Pagos
          </p>
        </div>

        {/* Linhas da Memória de Cálculo Auditável */}
        <div className="space-y-2 pt-1 text-xs">
          {/* (+) Comissões Recebidas */}
          <div
            onClick={() => {
              if (onOpenRecebimentos) {
                onOpenChange(false)
                onOpenRecebimentos()
              }
            }}
            className="p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                +
              </span>
              <div>
                <strong className="text-slate-900 block group-hover:text-emerald-700 transition-colors">
                  Comissões Efetivamente Recebidas
                </strong>
                <span className="text-[11px] text-slate-500">
                  Baixado no sistema: R$ {formatCurrency(systemReceivedCommissions)} | Legado: R${' '}
                  {formatCurrency(legacyReceivedCommissions)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-emerald-700">
                R$ {formatCurrency(receivedCommissions)}
              </span>
              <span className="text-[10px] text-blue-600 flex items-center justify-end gap-0.5 mt-0.5 group-hover:underline">
                Ver detalhes <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* (-) Repasses Pagos */}
          <div
            onClick={() => {
              if (onOpenRepassesPagos) {
                onOpenChange(false)
                onOpenRepassesPagos()
              }
            }}
            className="p-3 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs">
                -
              </span>
              <div>
                <strong className="text-slate-900 block group-hover:text-amber-800 transition-colors">
                  Repasses Efetivamente Pagos
                </strong>
                <span className="text-[11px] text-slate-500">
                  Repasses com data de pagamento dentro do período selecionado
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-amber-800">
                R$ {formatCurrency(paidRepasses)}
              </span>
              <span className="text-[10px] text-blue-600 flex items-center justify-end gap-0.5 mt-0.5 group-hover:underline">
                Ver tela parceiros <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* (-) Custos Pagos */}
          <div
            onClick={() => {
              if (onOpenCustosPagos) {
                onOpenChange(false)
                onOpenCustosPagos()
              }
            }}
            className="p-3 rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50/30 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red-100 text-red-800 font-bold flex items-center justify-center text-xs">
                -
              </span>
              <div>
                <strong className="text-slate-900 block group-hover:text-red-700 transition-colors">
                  Custos Efetivamente Pagos
                </strong>
                <span className="text-[11px] text-slate-500">
                  Despesas fixas e variáveis quitadas no período selecionado
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-red-700">R$ {formatCurrency(paidCosts)}</span>
              <span className="text-[10px] text-blue-600 flex items-center justify-end gap-0.5 mt-0.5 group-hover:underline">
                Ver tela custos <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* = Lucro Líquido Realizado */}
          <div className="p-3 rounded-lg border-2 border-slate-300 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs">
                =
              </span>
              <div>
                <strong className="text-slate-900 block text-xs">
                  Resultado Realizado (Lucro Líquido)
                </strong>
                <span className="text-[10px] text-slate-500">
                  Somente valores liquidados (não inclui obrigações pendentes)
                </span>
              </div>
            </div>
            <div className="text-right">
              <span
                className={`text-base font-extrabold ${
                  isNegative ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                R$ {formatCurrency(realProfit)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t mt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
