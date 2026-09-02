import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Pencil, RefreshCw, Trash2, Ban, AlertOctagon } from 'lucide-react'
import {
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicyWithRelations,
  prepareRenewalData,
} from '@/services/policies'
import { getPayments, createPayment } from '@/services/payments'
import { getReminders } from '@/services/reminders'
import { getClients } from '@/services/clients'
import { getSeguradoras } from '@/services/seguradoras'
import { getParceiros } from '@/services/parceiros'
import { Policy, Payment, Client, Seguradora, Parceiro } from '@/types'
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
import { PolicyFormDialog } from '@/components/PolicyFormDialog'
import { DeletePolicyDialog } from '@/components/DeletePolicyDialog'
import { CancelPolicyDialog } from '@/components/CancelPolicyDialog'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { usePermissions } from '@/hooks/use-permissions'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import { formatDateDisplay, todayLocalDate } from '@/lib/utils'

type DialogMode = 'edit' | 'renew' | null

export default function PolicyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { can } = usePermissions()

  const [policy, setPolicy] = useState<Policy | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([])
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [relatedCount, setRelatedCount] = useState({ payments: 0, reminders: 0 })

  const [paymentForm, setPaymentForm] = useState({
    amount: 1000,
    due_date: todayLocalDate(),
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
      const [cls, segs, pars] = await Promise.all([getClients(), getSeguradoras(), getParceiros()])
      setClients(cls)
      setSeguradoras(segs)
      setParceiros(pars)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [id])
  useRealtime('policies', () => loadData())
  useRealtime('payments', () => loadData())

  const handleSubmit = async (formData: any) => {
    if (!policy) return
    setFieldErrors({})
    try {
      if (dialogMode === 'edit') {
        await updatePolicy(policy.id, formData)
        toast({ title: 'Apólice atualizada com sucesso!' })
        setDialogMode(null)
        setFieldErrors({})
        loadData()
      } else if (dialogMode === 'renew') {
        const newPolicy = await createPolicy(formData)
        toast({ title: 'Apólice renovada com sucesso!' })
        navigate(`/apolices/${newPolicy.id}`)
      }
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast({ title: 'Erro ao salvar', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  const handleDeleteClick = async () => {
    if (!policy) return
    try {
      const [pays, rems] = await Promise.all([
        getPayments(`policy = "${policy.id}"`),
        getReminders(`policy = "${policy.id}"`),
      ])
      setRelatedCount({ payments: pays.length, reminders: rems.length })
    } catch {
      setRelatedCount({ payments: 0, reminders: 0 })
    }
    setDeleteOpen(true)
  }

  const handleCancelConfirm = async (data: {
    data_cancelamento: string
    motivo_cancelamento: string
  }) => {
    if (!policy) return
    try {
      await updatePolicy(policy.id, {
        status: 'Cancelada',
        data_cancelamento: data.data_cancelamento,
        motivo_cancelamento: data.motivo_cancelamento,
      })
      toast({ title: 'Apólice cancelada com sucesso!' })
      setCancelOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao cancelar apólice',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
      throw err
    }
  }

  const handleDeleteConfirm = async () => {
    if (!policy) return
    setDeleteLoading(true)
    try {
      await deletePolicyWithRelations(policy.id)
      toast({ title: 'Apólice excluída com sucesso!' })
      navigate('/apolices')
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: getErrorMessage(err), variant: 'destructive' })
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      await createPayment({ policy: id, ...paymentForm })
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

  const fmtMoney = (v: number) => v?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'
  const initialData =
    dialogMode === 'edit' ? policy : dialogMode === 'renew' ? prepareRenewalData(policy) : undefined

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
        <div className="flex flex-wrap gap-2">
          {can('policies', 'update') && (
            <Button
              variant="outline"
              onClick={() => {
                setFieldErrors({})
                setDialogMode('edit')
              }}
            >
              <Pencil className="w-4 h-4 mr-2" /> Editar
            </Button>
          )}
          {can('policies', 'update') && policy.status !== 'Cancelada' && (
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => setCancelOpen(true)}
            >
              <Ban className="w-4 h-4 mr-2" /> Cancelar Apólice
            </Button>
          )}
          {can('policies', 'create') && policy.status !== 'Cancelada' && (
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                setFieldErrors({})
                setDialogMode('renew')
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Renovar
            </Button>
          )}
          {can('policies', 'delete') && (
            <Button variant="destructive" onClick={handleDeleteClick}>
              <Trash2 className="w-4 h-4 mr-2" /> Excluir
            </Button>
          )}
        </div>
      </div>

      {policy.status === 'Cancelada' && (
        <Card className="border-red-300 bg-red-50/70 shadow-sm">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-red-900 text-sm">Esta apólice foi cancelada</p>
              <p className="text-red-800">
                <span className="font-semibold">Data do Cancelamento:</span>{' '}
                {formatDateDisplay(policy.data_cancelamento) || 'Não informada'}
              </p>
              {policy.motivo_cancelamento && (
                <p className="text-red-800">
                  <span className="font-semibold">Motivo:</span> {policy.motivo_cancelamento}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center justify-between">
            <span>Detalhes da Cobertura</span>
            <Badge
              className={
                policy.status === 'Ativa'
                  ? 'bg-emerald-500'
                  : policy.status === 'Renovação Pendente'
                    ? 'bg-amber-500'
                    : policy.status === 'Vencida' || policy.status === 'Expirada'
                      ? 'bg-slate-500'
                      : policy.status === 'Cancelada'
                        ? 'bg-red-600'
                        : 'bg-slate-500'
              }
            >
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
            <p className="font-semibold">
              {policy.expand?.seguradora?.nome || policy.insurance_company || '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Tipo de Seguro</p>
            <p className="font-semibold">{policy.tipo_de_seguro || policy.coverage_type}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Tipo de Venda</p>
            <p className="font-semibold">{policy.tipo_de_venda || '-'}</p>
          </div>
          {policy.tipo_de_seguro === 'Auto' && (
            <>
              <div>
                <p className="text-xs text-slate-500">Placa</p>
                <p className="font-semibold">{policy.placa || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Chassi</p>
                <p className="font-semibold">{policy.chassi || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Modelo do Veículo</p>
                <p className="font-semibold">{policy.modelo_veiculo || '-'}</p>
              </div>
            </>
          )}
          <div>
            <p className="text-xs text-slate-500">Valor Bruto</p>
            <p className="font-bold text-slate-900">R$ {fmtMoney(policy.valor_bruto || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Valor Líquido</p>
            <p className="font-bold text-slate-900">
              R$ {fmtMoney(policy.valor_liquido || policy.premium_amount || 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Forma de Pagamento</p>
            <p className="font-semibold">{policy.forma_pagamento || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Parcelamento</p>
            <p className="font-semibold">{policy.parcelas ? `${policy.parcelas}x` : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Comissão (%)</p>
            <p className="font-semibold">{policy.commission_percent || 0}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Valor da Comissão</p>
            <p className="font-bold text-blue-600">
              R${' '}
              {fmtMoney(
                ((policy.commission_percent || 0) / 100) *
                  (policy.valor_liquido || policy.premium_amount || 0),
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Data Início</p>
            <p className="font-semibold">{formatDateDisplay(policy.start_date)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Data Fim</p>
            <p className="font-semibold">{formatDateDisplay(policy.end_date)}</p>
          </div>
          {policy.expand?.parceiro && (
            <div>
              <p className="text-xs text-slate-500">Parceiro</p>
              <p className="font-semibold">{policy.expand.parceiro.nome}</p>
            </div>
          )}
          {policy.notes && (
            <div className="md:col-span-4">
              <p className="text-xs text-slate-500">Observações</p>
              <p className="text-sm">{policy.notes}</p>
            </div>
          )}
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
                <Plus className="w-4 h-4 mr-1" /> Registrar Pagamento
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
                      <p className="text-slate-500">Vencimento: {formatDateDisplay(p.due_date)}</p>
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

      <PolicyFormDialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogMode(null)
            setFieldErrors({})
          }
        }}
        onSubmit={handleSubmit}
        clients={clients}
        seguradoras={seguradoras}
        parceiros={parceiros}
        initialData={initialData}
        title={dialogMode === 'edit' ? 'Editar Apólice' : 'Renovar Apólice'}
        fieldErrors={fieldErrors}
        submitLabel={dialogMode === 'edit' ? 'Salvar Alterações' : 'Criar Renovação'}
      />

      <DeletePolicyDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteConfirm}
        policyNumber={policy.policy_number}
        relatedCount={relatedCount}
        loading={deleteLoading}
      />

      <CancelPolicyDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirm={handleCancelConfirm}
        policyNumber={policy.policy_number}
      />

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
