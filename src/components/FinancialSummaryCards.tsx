import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, CheckCircle2, Clock, AlertCircle, Target, Banknote } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Props {
  expectedCommissions: number
  receivedCommissions: number
  legacyReceivedCommissions?: number
  pendingCommissions: number
  hasPartialReceipts?: boolean
  paidRepasses?: number
  pendingRepasses: number
  paidCosts: number
  pendingCosts: number
  expectedProfit: number
  realProfit: number
  periodLabel: string
  onSaldoAReceberClick?: () => void
}

export function FinancialSummaryCards({
  expectedCommissions,
  receivedCommissions,
  legacyReceivedCommissions = 0,
  pendingCommissions,
  hasPartialReceipts = false,
  paidRepasses = 0,
  pendingRepasses,
  paidCosts,
  pendingCosts,
  expectedProfit,
  realProfit,
  periodLabel,
  onSaldoAReceberClick,
}: Props) {
  const groups = [
    {
      title: 'RECEITAS',
      cards: [
        {
          label: 'Comissão Recebida no Mês',
          value: receivedCommissions,
          icon: CheckCircle2,
          color: 'text-emerald-700',
          secondaryText:
            legacyReceivedCommissions > 0
              ? `Histórico legado importado: R$ ${formatCurrency(legacyReceivedCommissions)}`
              : undefined,
          tooltip: 'Recebimentos reais registrados no sistema no mês selecionado',
        },
        {
          label: 'Comissão Prevista (vendas do mês)',
          value: expectedCommissions,
          icon: TrendingUp,
          color: 'text-slate-700',
          tooltip: 'Comissão líquida prevista das vendas iniciadas no mês selecionado',
        },
        {
          label: 'Saldo a Receber (vendas do mês)',
          value: pendingCommissions,
          icon: Clock,
          color: 'text-amber-700',
          clickable: true,
          badge: 'Ver por seguradora',
          statusBadge: hasPartialReceipts ? 'Parcial' : undefined,
          tooltip: 'Previsto das vendas do período menos o valor recebido delas',
        },
      ],
    },
    {
      title: 'OBRIGAÇÕES',
      cards: [
        {
          label: 'Repasses Pagos no Mês',
          value: paidRepasses,
          icon: CheckCircle2,
          color: 'text-emerald-700',
        },
        {
          label: 'Repasses Pendentes',
          value: pendingRepasses,
          icon: AlertCircle,
          color: 'text-blue-700',
        },
        { label: 'Custos Pagos', value: paidCosts, icon: CheckCircle2, color: 'text-emerald-700' },
        { label: 'Custos Pendentes', value: pendingCosts, icon: Clock, color: 'text-red-700' },
      ],
    },
    {
      title: 'RESULTADO',
      cards: [
        { label: 'Lucro Previsto', value: expectedProfit, icon: Target, color: 'text-slate-700' },
        { label: 'Lucro Real', value: realProfit, icon: Banknote, color: 'text-blue-700' },
      ],
    },
  ]

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 font-medium">Período: {periodLabel}</p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {groups.map((group) => (
          <div key={group.title} className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              {group.title}
            </h3>
            <div className="space-y-2">
              {group.cards.map((c: any) => {
                const Icon = c.icon
                const isClickable = c.clickable && onSaldoAReceberClick
                return (
                  <Card
                    key={c.label}
                    onClick={isClickable ? onSaldoAReceberClick : undefined}
                    className={`shadow-sm transition-all ${
                      isClickable
                        ? 'cursor-pointer hover:border-amber-400 hover:shadow-md border-amber-200/80 bg-amber-50/20 group'
                        : ''
                    }`}
                  >
                    <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <CardTitle className="text-xs font-medium text-slate-600">
                          {c.label}
                        </CardTitle>
                        {c.badge && (
                          <span className="text-[10px] font-medium bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded group-hover:bg-amber-200 transition-colors">
                            {c.badge}
                          </span>
                        )}
                      </div>
                      <Icon
                        className={`w-4 h-4 ${c.color} ${
                          isClickable ? 'group-hover:scale-110 transition-transform' : ''
                        }`}
                      />
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className={`text-lg font-bold ${c.color}`}>
                          R$ {formatCurrency(c.value)}
                        </div>
                        {c.statusBadge && (
                          <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                            {c.statusBadge}
                          </span>
                        )}
                      </div>
                      {c.secondaryText && (
                        <p className="text-[11px] text-slate-500 mt-1 font-normal">
                          {c.secondaryText}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
