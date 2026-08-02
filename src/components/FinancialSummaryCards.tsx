import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, CheckCircle2, Clock, AlertCircle, Target, Banknote } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Props {
  expectedCommissions: number
  receivedCommissions: number
  pendingCommissions: number
  pendingRepasses: number
  paidCosts: number
  pendingCosts: number
  expectedProfit: number
  realProfit: number
  periodLabel: string
}

export function FinancialSummaryCards({
  expectedCommissions,
  receivedCommissions,
  pendingCommissions,
  pendingRepasses,
  paidCosts,
  pendingCosts,
  expectedProfit,
  realProfit,
  periodLabel,
}: Props) {
  const groups = [
    {
      title: 'RECEITAS',
      cards: [
        {
          label: 'Comissões Previstas',
          value: expectedCommissions,
          icon: TrendingUp,
          color: 'text-slate-700',
        },
        {
          label: 'Comissões Recebidas',
          value: receivedCommissions,
          icon: CheckCircle2,
          color: 'text-emerald-700',
        },
        {
          label: 'Saldo a Receber',
          value: pendingCommissions,
          icon: Clock,
          color: 'text-amber-700',
        },
      ],
    },
    {
      title: 'OBRIGAÇÕES',
      cards: [
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
              {group.cards.map((c) => {
                const Icon = c.icon
                return (
                  <Card key={c.label} className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-3 px-4">
                      <CardTitle className="text-xs font-medium text-slate-600">
                        {c.label}
                      </CardTitle>
                      <Icon className={`w-4 h-4 ${c.color}`} />
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className={`text-lg font-bold ${c.color}`}>
                        R$ {formatCurrency(c.value)}
                      </div>
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
