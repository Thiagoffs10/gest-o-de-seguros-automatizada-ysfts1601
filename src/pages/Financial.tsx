import { useEffect, useState } from 'react'
import { DollarSign, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react'
import { getPayments, updatePayment } from '@/services/payments'
import { Payment } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useToast } from '@/hooks/use-toast'

export default function Financial() {
  const { toast } = useToast()
  const [payments, setPayments] = useState<Payment[]>([])

  const loadPayments = async () => {
    try {
      const data = await getPayments()
      setPayments(data)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadPayments()
  }, [])

  const totalReceived = payments
    .filter((p) => p.status === 'Pago')
    .reduce((sum, p) => sum + p.amount, 0)
  const totalPending = payments
    .filter((p) => p.status === 'Pendente')
    .reduce((sum, p) => sum + p.amount, 0)
  const totalOverdue = payments
    .filter((p) => p.status === 'Atrasado')
    .reduce((sum, p) => sum + p.amount, 0)

  const chartData = [
    { name: 'Recebido', valor: totalReceived },
    { name: 'Pendente', valor: totalPending },
    { name: 'Atrasado', valor: totalOverdue },
  ]

  const handleMarkAsPaid = async (id: string) => {
    try {
      await updatePayment(id, { status: 'Pago', paid_date: new Date().toISOString() })
      toast({ title: 'Pagamento marcado como recebido!' })
      loadPayments()
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Controle Financeiro</h1>
        <p className="text-slate-500 text-sm">Gestão de recebimentos de prêmios e parcelamentos.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Arrecadado</CardTitle>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              R$ {totalReceived.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-slate-500 mt-1">Pagamentos confirmados</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">A Receber</CardTitle>
            <Wallet className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              R$ {totalPending.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-slate-500 mt-1">Parcelas a vencer</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-red-200 bg-red-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Em Atraso</CardTitle>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              R$ {totalOverdue.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-red-600 mt-1">Inadimplência pendente</p>
          </CardContent>
        </Card>
      </div>

      <Card className="p-4 shadow-sm">
        <h3 className="font-bold text-base text-slate-800 mb-4">
          Visão Comparativa de Valores (R$)
        </h3>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip />
              <Bar dataKey="valor" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="shadow-sm overflow-hidden border">
        <CardHeader>
          <CardTitle className="text-base font-bold">Listagem de Pagamentos</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3.5">Apólice</th>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5">Valor</th>
                <th className="p-3.5">Vencimento</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3.5 font-bold">
                    {p.expand?.policy?.policy_number || 'Apólice'}
                  </td>
                  <td className="p-3.5">{p.expand?.policy?.expand?.client?.name || '-'}</td>
                  <td className="p-3.5 font-bold">R$ {p.amount?.toLocaleString('pt-BR')}</td>
                  <td className="p-3.5">{new Date(p.due_date).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3.5">
                    <Badge
                      className={
                        p.status === 'Pago'
                          ? 'bg-emerald-500'
                          : p.status === 'Atrasado'
                            ? 'bg-red-500'
                            : 'bg-amber-500'
                      }
                    >
                      {p.status}
                    </Badge>
                  </td>
                  <td className="p-3.5 text-right">
                    {p.status !== 'Pago' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-700 hover:bg-emerald-50"
                        onClick={() => handleMarkAsPaid(p.id)}
                      >
                        Confirmar Recebimento
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
