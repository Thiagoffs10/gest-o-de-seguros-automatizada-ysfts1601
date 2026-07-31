import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DollarSign,
  Wallet,
  CheckCircle2,
  Clock,
  TrendingDown,
  TrendingUp,
  Receipt,
  Banknote,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Props {
  totalGross: number
  totalNet: number
  commReceived: number
  commPending: number
  repassePaid: number
  repassePending: number
  totalCustos: number
  lucroLiquido: number
  periodLabel: string
}

export function FinancialSummaryCards({
  totalGross,
  totalNet,
  commReceived,
  commPending,
  repassePaid,
  repassePending,
  totalCustos,
  lucroLiquido,
  periodLabel,
}: Props) {
  const cards = [
    {
      label: 'Valor Bruto Total',
      value: formatCurrency(totalGross),
      icon: DollarSign,
      color: 'text-slate-700',
    },
    {
      label: 'Valor Líquido Total',
      value: formatCurrency(totalNet),
      icon: Wallet,
      color: 'text-blue-700',
    },
    {
      label: 'Comissões Recebidas',
      value: formatCurrency(commReceived),
      icon: CheckCircle2,
      color: 'text-emerald-700',
    },
    {
      label: 'Comissões a Receber',
      value: formatCurrency(commPending),
      icon: Clock,
      color: 'text-amber-700',
    },
    {
      label: 'Repasses Pagos',
      value: formatCurrency(repassePaid),
      icon: TrendingDown,
      color: 'text-emerald-700',
    },
    {
      label: 'Repasses Pendentes',
      value: formatCurrency(repassePending),
      icon: TrendingUp,
      color: 'text-red-700',
    },
    {
      label: 'Total de Custos',
      value: formatCurrency(totalCustos),
      icon: Receipt,
      color: 'text-red-700',
    },
    {
      label: 'Lucro Líquido Real',
      value: formatCurrency(lucroLiquido),
      icon: Banknote,
      color: 'text-blue-700',
    },
  ]

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 font-medium">Período: {periodLabel}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.label} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-slate-600">{c.label}</CardTitle>
                <Icon className={`w-4 h-4 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-lg font-bold ${c.color}`}>R$ {c.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
