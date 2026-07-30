import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Wallet, CheckCircle2, Clock, TrendingDown, TrendingUp } from 'lucide-react'

interface Props {
  totalGross: number
  totalNet: number
  commReceived: number
  commPending: number
  repassePaid: number
  repassePending: number
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function FinancialSummaryCards({
  totalGross,
  totalNet,
  commReceived,
  commPending,
  repassePaid,
  repassePending,
}: Props) {
  const cards = [
    {
      label: 'Valor Bruto Total',
      value: fmt(totalGross),
      icon: DollarSign,
      color: 'text-slate-700',
    },
    { label: 'Valor Líquido Total', value: fmt(totalNet), icon: Wallet, color: 'text-blue-700' },
    {
      label: 'Comissões Recebidas',
      value: fmt(commReceived),
      icon: CheckCircle2,
      color: 'text-emerald-700',
    },
    { label: 'Comissões a Receber', value: fmt(commPending), icon: Clock, color: 'text-amber-700' },
    {
      label: 'Repasses Pagos',
      value: fmt(repassePaid),
      icon: TrendingDown,
      color: 'text-emerald-700',
    },
    {
      label: 'Repasses Pendentes',
      value: fmt(repassePending),
      icon: TrendingUp,
      color: 'text-red-700',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
  )
}
