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
import { useState } from 'react'
import { TrendingUp, AlertCircle, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { exportFinancialListingPDF, slugifyFilename } from '@/lib/financial-pdf'

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
  const [isExporting, setIsExporting] = useState(false)
  const isNegative = expectedProfit < 0

  const handleExportPDF = async () => {
    try {
      setIsExporting(true)
      await exportFinancialListingPDF({
        title: 'Memória de Cálculo: Resultado Líquido Projetado',
        subtitle: `Estimativa de fechamento da competência de produção de ${periodLabel}`,
        periodLabel,
        orientation: 'portrait',
        filename: slugifyFilename('memoria-resultado-liquido-projetado', periodLabel),
        filters: {
          periodo: periodLabel,
        },
        summaryCards: [
          {
            label: 'Comissões Previstas',
            value: `R$ ${formatCurrency(expectedCommission)}`,
            variant: 'green',
          },
          {
            label: 'Repasses Previstos',
            value: `R$ ${formatCurrency(expectedRepasses)}`,
            variant: 'amber',
          },
          {
            label: 'Custos Previstos',
            value: `R$ ${formatCurrency(expectedCosts)}`,
            variant: 'red',
          },
          {
            label: 'Resultado Projetado',
            value: `R$ ${formatCurrency(expectedProfit)}`,
            variant: isNegative ? 'red' : 'green',
            highlight: true,
          },
        ],
        columns: [
          { header: 'Operação', dataKey: 'operacao', align: 'center', width: 25 },
          { header: 'Componente da Memória', dataKey: 'descricao', align: 'left' },
          { header: 'Valor (R$)', dataKey: 'valorFmt', align: 'right', width: 45 },
        ],
        rows: [
          {
            operacao: '(+)',
            descricao: 'Comissões Previstas Líquidas (vendas do período)',
            valorFmt: `R$ ${formatCurrency(expectedCommission)}`,
          },
          {
            operacao: '(-)',
            descricao: 'Repasses Previstos a Parceiros',
            valorFmt: `R$ ${formatCurrency(expectedRepasses)}`,
          },
          {
            operacao: '(-)',
            descricao: 'Custos Fixos / Variáveis Estimados',
            valorFmt: `R$ ${formatCurrency(expectedCosts)}`,
          },
        ],
        totalRow: {
          operacao: '(=)',
          descricao: 'Resultado Líquido Projetado (Estimativa da Safra)',
          valorFmt: `R$ ${formatCurrency(expectedProfit)}`,
        },
        infoNotes: [
          'Memória baseada na margem projetada das apólices comercializadas na competência.',
          'Valores estimados sujeitos à liquidação futura de recebimentos e custos.',
        ],
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Resultado Líquido Projetado
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="bg-indigo-50 text-indigo-700 border-indigo-200 mt-1"
                >
                  {periodLabel}
                </Badge>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="h-8 px-2.5 text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shrink-0 gap-1.5 shadow-2xs"
              title="Exportar memória de cálculo em PDF"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>Exportar PDF</span>
            </Button>
          </div>
          <DialogDescription className="text-xs text-slate-500 mt-1">
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
