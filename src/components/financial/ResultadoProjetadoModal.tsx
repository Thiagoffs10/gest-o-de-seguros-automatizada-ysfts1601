import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, AlertCircle, HelpCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface ResultadoProjetadoModalProps {
  isOpen: boolean
  onClose: () => void
  periodLabel: string
  expectedCommission: number
  expectedRepasses: number
  expectedCosts: number
  expectedProfit: number
}

export const ResultadoProjetadoModal: React.FC<ResultadoProjetadoModalProps> = ({
  isOpen,
  onClose,
  periodLabel,
  expectedCommission,
  expectedRepasses,
  expectedCosts,
  expectedProfit,
}) => {
  const isNegative = expectedProfit < 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Resultado Líquido Projetado
            </DialogTitle>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
              {periodLabel}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Memória de cálculo simples da estimativa de fechamento para a competência de produção
            selecionada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <Card className="bg-slate-50/70 border-slate-200">
            <CardContent className="p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-200/80">
                <span className="text-slate-700 font-medium">(+) Comissões Previstas Líquidas</span>
                <span className="font-bold text-slate-900">
                  R$ {formatCurrency(expectedCommission)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-200/80">
                <span className="text-slate-700 font-medium">(-) Repasses Previstos</span>
                <span className="font-bold text-amber-700">
                  R$ {formatCurrency(expectedRepasses)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-200/80">
                <span className="text-slate-700 font-medium">(-) Custos Previstos</span>
                <span className="font-bold text-red-700">R$ {formatCurrency(expectedCosts)}</span>
              </div>
              <div
                className={`flex items-center justify-between pt-1.5 font-extrabold text-sm ${
                  isNegative ? 'text-rose-700' : 'text-slate-900'
                }`}
              >
                <span>(=) Resultado Líquido Projetado</span>
                <span>R$ {formatCurrency(expectedProfit)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-[11px] text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Valor Estimado — Não é Receita Realizada</p>
              <p className="text-amber-800 mt-0.5">
                O Resultado Projetado reflete a margem esperada sobre as apólices produzidas no
                período, subtraindo os repasses e despesas estimadas. O dinheiro efetivamente em
                caixa está no <strong>Bloco 4 — Resultado Real do Período</strong>.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
