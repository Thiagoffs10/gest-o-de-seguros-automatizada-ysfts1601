import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Policy } from '@/types'

interface Props {
  policies: Policy[]
}

export function PendenciasPanel({ policies }: Props) {
  const navigate = useNavigate()

  const pendingCommissions = policies.filter((p) => !p.comissao_recebida).length
  const pendingRepasses = policies.filter(
    (p) =>
      p.tipo_de_venda === 'Parceiro' &&
      (p.parceiro || p.expand?.parceiro) &&
      (p.valor_repasse || 0) > 0 &&
      !p.pago_parceiro,
  ).length

  const today = new Date().toISOString().split('T')[0]
  const renewalsToday = policies.filter(
    (p) => p.renewal_date && p.renewal_date.split(' ')[0] === today,
  ).length

  const pendingRenewals = policies.filter((p) => p.status === 'Renovação Pendente').length

  const items = [
    {
      count: pendingCommissions,
      label: 'Comissões Pendentes',
      path: '/financeiro',
      color: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      count: pendingRepasses,
      label: 'Repasses Pendentes',
      path: '/financeiro',
      color: 'text-blue-700 bg-blue-50 border-blue-200',
    },
    {
      count: renewalsToday,
      label: 'Renovações para Hoje',
      path: '/apolices',
      color: 'text-rose-700 bg-rose-50 border-rose-200',
    },
    {
      count: pendingRenewals,
      label: 'Renovações Pendentes',
      path: '/apolices',
      color: 'text-orange-700 bg-orange-50 border-orange-200',
    },
  ].filter((i) => i.count > 0)

  if (items.length === 0) return null

  return (
    <Card className="shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-5 h-5 text-amber-600" />
        <h3 className="text-base font-bold text-slate-800">Pendências do Dia</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:shadow-md ${item.color}`}
          >
            <div className="text-left">
              <p className="text-2xl font-bold">{item.count}</p>
              <p className="text-xs font-medium">{item.label}</p>
            </div>
            <ArrowRight className="w-4 h-4 opacity-50" />
          </button>
        ))}
      </div>
    </Card>
  )
}
