import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, Calendar, RefreshCw, DollarSign, Plus } from 'lucide-react'
import { getPolicy, createPolicy, updatePolicy } from '@/services/policies'
import { getPayments, createPayment } from '@/services/payments'
import { Policy, Payment } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

export default function PolicyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [policy, setPolicy] = useState<Policy | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)

  const [paymentForm, setPaymentForm] = useState({
    amount: 1000,
    due_date: new Date().toISOString().split('T')[0],
    status: 'Pendente' as const,
    payment_method: 'Boleto' as const,
  })

  const loadData = async () => {
    if (!id) return
    try {
      const p = await getPolicy(id)
      setPolicy(p)
      const pays = await getPayments(`policy = "${id}"`)
      setPayments(pays)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleRenew = async () => {
    if (!policy) return
    try {
      const oldEndDate = new Date(policy.end_date)
      const newStartDate = oldEndDate.toISOString().split('T')[0]
      const newEndDate = new Date(oldEndDate.getTime() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
      const renewalDate = new Date(
        new Date(newEndDate).getTime() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString()

      await createPolicy({
        client: policy.client,
        insurance_company: policy.insurance_company,
        policy_number: `${policy.policy_number}-REN`,
        coverage_type: policy.coverage_type,
        premium_amount: policy.premium_amount,
        start_date: newStartDate,
        end_date: newEndDate,
        renewal_date: renewalDate,
        status: 'Ativa',
        commission: policy.commission,
      })

      await updatePolicy(policy.id, { status: 'Expirada' })
      toast({ title: 'Apólice renovada com sucesso!' })
      navigate('/apolices')
    } catch (err: any) {
      toast({ title: 'Erro ao renovar', description: err.message, variant: 'destructive' })
    }
  }

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      await createPayment({
        policy: id,
        ...paymentForm,
      })
      toast({ title: 'Pagamento registrado!' })
      setIsPayModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar pagamento',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  if (!policy) return <div className="p-8 text-center text-slate-500">Carregando apólice...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/apolices')}
            className="mb-2"
          >
            ← Voltar para Apólices
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">Apólice {policy.policy_number}</h1>
        </div>
        <Button className="bg-amber-600 hover:bg-amber-700" onClick={handleRenew}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Renovar Apólice
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center justify-between">
            <span>Detalhes da Cobertura</span>
            <Badge className={policy.status === 'Ativa' ? 'bg-emerald-500' : 'bg-amber-500'}>
              {policy.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-slate-700">
          <div>
            <p className="text-xs text-slate-500">Cliente Segurado</p>
            <p className="font-bold text-slate-900">
              {policy.expand?.client?.name || 'Não informado'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Seguradora</p>
            <p className="font-semibold">{policy.insurance_company || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Tipo Cobertura</p>
            <p className="font-semibold">{policy.coverage_type}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Prêmio Anual</p>
            <p className="font-bold text-slate-900">
              R$ {policy.premium_amount?.toLocaleString('pt-BR')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Pagamentos ({payments.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="payments" className="mt-4">
          <Card className="p-4 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm">Histórico de Parcelas</h3>
              <Button size="sm" onClick={() => setIsPayModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Registrar Pagamento
              </Button>
            </div>
            {payments.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                Nenhum pagamento registrado nesta apólice.
              </p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center p-3 bg-slate-50 border rounded text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        R$ {p.amount?.toLocaleString('pt-BR')}
                      </p>
                      <p className="text-slate-500">
                        Vencimento: {new Date(p.due_date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={p.status === 'Pago' ? 'bg-emerald-500' : 'bg-red-500'}>
                        {p.status}
                      </Badge>
                      <p className="text-slate-400 mt-1">{p.payment_method}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Pagamento */}
      <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Parcela / Pagamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPayment} className="space-y-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Data de Vencimento</Label>
              <Input
                type="date"
                value={paymentForm.due_date}
                onChange={(e) => setPaymentForm({ ...paymentForm, due_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={paymentForm.status}
                onValueChange={(val: any) => setPaymentForm({ ...paymentForm, status: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select
                value={paymentForm.payment_method}
                onValueChange={(val: any) =>
                  setPaymentForm({ ...paymentForm, payment_method: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Cartão">Cartão</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPayModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600">
                Salvar Pagamento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
