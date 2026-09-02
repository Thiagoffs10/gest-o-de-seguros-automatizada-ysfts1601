import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { User, Phone, Mail, MapPin, FileText, Plus, Edit, Hash, Building2 } from 'lucide-react'
import { getClient, updateClient } from '@/services/clients'
import { getPolicies, createPolicy } from '@/services/policies'
import { getSeguradoras } from '@/services/seguradoras'
import { getPayments } from '@/services/payments'
import { getCommunications } from '@/services/communications'
import { getReminders } from '@/services/reminders'
import { formatDocumentLabel } from '@/lib/document-validators'
import { Client, Policy, Seguradora, Payment, Communication as CommType, Reminder } from '@/types'
import { formatDateDisplay, todayLocalDate, toLocalDate, formatDateTimeDisplay } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import { Badge } from '@/components/ui/badge'
import { ClientFormDialog } from '@/components/ClientFormDialog'
import { BRAZILIAN_STATES, TIPOS_DE_SEGURO } from '@/lib/constants'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [client, setClient] = useState<Client | null>(null)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [comms, setComms] = useState<CommType[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isNewPolicyOpen, setIsNewPolicyOpen] = useState(false)
  const [newPolicy, setNewPolicy] = useState({
    policy_number: '',
    seguradora: '',
    tipo_de_seguro: 'Auto',
    valor_liquido: 1000,
    commission_percent: 10,
    start_date: todayLocalDate(),
    end_date: toLocalDate(new Date(Date.now() + 365 * 86400000)),
  })

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const c = await getClient(id)
      setClient(c)
      const [pols, segs] = await Promise.all([getPolicies(`client = "${id}"`), getSeguradoras()])
      setPolicies(pols)
      setSeguradoras(segs)
      const paymentFilter =
        pols.length > 0 ? pols.map((p) => `policy = "${p.id}"`).join(' || ') : 'id = ""'
      const [pays, cms, rems] = await Promise.all([
        getPayments(paymentFilter),
        getCommunications(`client = "${id}"`),
        getReminders(`client = "${id}"`),
      ])
      setPayments(pays)
      setComms(cms)
      setReminders(rems)
    } catch {
      /* intentionally ignored */
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('policies', () => loadData())
  useRealtime('payments', () => loadData())
  useRealtime('communications', () => loadData())
  useRealtime('reminders', () => loadData())

  const handleUpdateClient = async (formData: any) => {
    if (!id) return
    try {
      await updateClient(id, formData)
      toast({ title: 'Cliente atualizado com sucesso!' })
      setIsEditOpen(false)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' })
    }
  }

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      const endDate = new Date(newPolicy.end_date + 'T00:00:00')
      const renewalDate = toLocalDate(new Date(endDate.getTime() - 30 * 86400000))
      const commission = (newPolicy.commission_percent / 100) * newPolicy.valor_liquido
      await createPolicy({
        ...newPolicy,
        client: id,
        renewal_date: renewalDate,
        commission,
        status: 'Ativa',
        premium_amount: newPolicy.valor_liquido,
        valor_bruto: newPolicy.valor_liquido,
      })
      toast({ title: 'Apólice vinculada ao cliente!' })
      setIsNewPolicyOpen(false)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao criar apólice', description: err.message, variant: 'destructive' })
    }
  }

  if (!client)
    return <div className="p-8 text-center text-slate-500">Carregando dados do segurado...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/clientes')}
            className="mb-2"
          >
            ← Voltar
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <Hash className="w-3 h-3" /> Código: {client.client_code || 'N/A'}
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {client.tipo_pessoa === 'PJ' ? (
                <>
                  <Building2 className="w-3 h-3" /> PJ
                </>
              ) : (
                <>
                  <User className="w-3 h-3" /> PF
                </>
              )}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditOpen(true)}>
            <Edit className="w-4 h-4 mr-2" /> Editar
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setIsNewPolicyOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" /> Nova Apólice
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dados">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="apolices">Apólices ({policies.length})</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos ({payments.length})</TabsTrigger>
          <TabsTrigger value="comunicacoes">Comunicações ({comms.length})</TabsTrigger>
          <TabsTrigger value="lembretes">Lembretes ({reminders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <Card className="shadow-sm">
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-700 pt-6">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">E-mail</p>
                  <p className="font-semibold">{client.email || 'Não informado'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Telefone</p>
                  <p className="font-semibold">{client.phone || 'Não informado'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Documento</p>
                  <p className="font-semibold">{formatDocumentLabel(client)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">CEP</p>
                  <p className="font-semibold">{client.cep || 'Não informado'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Endereço</p>
                  <p className="font-semibold">
                    {[client.rua, client.numero, client.bairro].filter(Boolean).join(', ') ||
                      client.address ||
                      'Não informado'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Cidade/UF</p>
                  <p className="font-semibold">
                    {[client.cidade, client.estado].filter(Boolean).join('/') || 'Não informado'}
                  </p>
                </div>
              </div>
              {client.tipo_pessoa !== 'PJ' && client.birth_date && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Nascimento</p>
                    <p className="font-semibold">{formatDateDisplay(client.birth_date)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apolices">
          <Card className="shadow-sm">
            <CardContent className="pt-6 space-y-3">
              {policies.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  Nenhuma apólice cadastrada.
                </p>
              ) : (
                policies.map((pol) => (
                  <div
                    key={pol.id}
                    className="p-3 border rounded-lg bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {pol.policy_number} -{' '}
                        {pol.expand?.seguradora?.nome || pol.insurance_company || '-'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Tipo: {pol.tipo_de_seguro || pol.coverage_type} | Vigência:{' '}
                        {formatDateDisplay(pol.start_date)} a {formatDateDisplay(pol.end_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">
                        R$ {(pol.valor_liquido || pol.premium_amount)?.toLocaleString('pt-BR')}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 h-6 p-0"
                        onClick={() => navigate(`/apolices/${pol.id}`)}
                      >
                        Ver Detalhes →
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagamentos">
          <Card className="shadow-sm overflow-hidden">
            <CardContent className="pt-6 overflow-x-auto">
              {payments.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  Nenhum pagamento registrado.
                </p>
              ) : (
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                    <tr>
                      <th className="p-2">Valor</th>
                      <th className="p-2">Vencimento</th>
                      <th className="p-2">Pagamento</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="p-2 font-bold">R$ {p.amount?.toLocaleString('pt-BR')}</td>
                        <td className="p-2">{formatDateDisplay(p.due_date)}</td>
                        <td className="p-2">
                          {p.paid_date ? formatDateDisplay(p.paid_date) : '-'}
                        </td>
                        <td className="p-2">
                          <Badge
                            className={
                              p.status === 'Pago'
                                ? 'bg-emerald-500'
                                : p.status === 'Pendente'
                                  ? 'bg-amber-500'
                                  : p.status === 'Atrasado'
                                    ? 'bg-red-600'
                                    : 'bg-slate-500'
                            }
                          >
                            {p.status}
                          </Badge>{' '}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comunicacoes">
          <Card className="shadow-sm overflow-hidden">
            <CardContent className="pt-6 overflow-x-auto">
              {comms.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  Nenhuma comunicação registrada.
                </p>
              ) : (
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                    <tr>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Assunto</th>
                      <th className="p-2">Data</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comms.map((cm) => (
                      <tr key={cm.id}>
                        <td className="p-2 font-bold">{cm.type}</td>
                        <td className="p-2 max-w-xs truncate">{cm.subject || cm.body}</td>
                        <td className="p-2">{formatDateTimeDisplay(cm.created)}</td>
                        <td className="p-2">
                          <Badge variant="outline">{cm.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lembretes">
          <Card className="shadow-sm overflow-hidden">
            <CardContent className="pt-6 overflow-x-auto">
              {reminders.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  Nenhum lembrete registrado.
                </p>
              ) : (
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                    <tr>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Data</th>
                      <th className="p-2">Mensagem</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reminders.map((r) => (
                      <tr key={r.id}>
                        <td className="p-2 font-bold text-blue-600">{r.type}</td>
                        <td className="p-2">{formatDateDisplay(r.date)}</td>
                        <td className="p-2 max-w-xs truncate">{r.message}</td>
                        <td className="p-2">
                          <Badge className={r.sent ? 'bg-slate-400' : 'bg-amber-500'}>
                            {r.sent ? 'Concluído' : 'Pendente'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ClientFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSubmit={handleUpdateClient}
        initialData={client}
        title="Editar Cliente"
      />

      <Dialog open={isNewPolicyOpen} onOpenChange={setIsNewPolicyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Apólice para {client.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePolicy} className="space-y-3">
            <div>
              <Label>Nº da Apólice *</Label>
              <Input
                required
                value={newPolicy.policy_number}
                onChange={(e) => setNewPolicy({ ...newPolicy, policy_number: e.target.value })}
              />
            </div>
            <div>
              <Label>Seguradora</Label>
              <Select
                value={newPolicy.seguradora}
                onValueChange={(v) => setNewPolicy({ ...newPolicy, seguradora: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {seguradoras.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Seguro</Label>
              <Select
                value={newPolicy.tipo_de_seguro}
                onValueChange={(v: any) => setNewPolicy({ ...newPolicy, tipo_de_seguro: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DE_SEGURO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Valor Líquido (R$)</Label>
                <Input
                  type="number"
                  value={newPolicy.valor_liquido}
                  onChange={(e) =>
                    setNewPolicy({ ...newPolicy, valor_liquido: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Comissão (%)</Label>
                <Input
                  type="number"
                  value={newPolicy.commission_percent}
                  onChange={(e) =>
                    setNewPolicy({ ...newPolicy, commission_percent: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={newPolicy.start_date}
                  onChange={(e) => setNewPolicy({ ...newPolicy, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={newPolicy.end_date}
                  onChange={(e) => setNewPolicy({ ...newPolicy, end_date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNewPolicyOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600">
                Vincular Apólice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
