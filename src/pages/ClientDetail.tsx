import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Plus,
  Edit,
  Hash,
  Building2,
  Calendar,
  Clock,
  Send,
  ShieldCheck,
  AlertTriangle,
  History,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'
import { getClient, updateClient } from '@/services/clients'
import { getPolicies, createPolicy } from '@/services/policies'
import { getSeguradoras } from '@/services/seguradoras'
import { getPayments } from '@/services/payments'
import { getCommunications } from '@/services/communications'
import { getReminders } from '@/services/reminders'
import { getTiposSeguro } from '@/services/tipos-seguro'
import { formatDocumentLabel } from '@/lib/document-validators'
import {
  Client,
  Policy,
  Seguradora,
  Payment,
  Communication as CommType,
  Reminder,
  TipoSeguro,
} from '@/types'
import { formatDateDisplay, todayLocalDate, toLocalDate, formatDateTimeDisplay } from '@/lib/utils'
import { ClientOpportunitiesCard } from '@/components/ClientOpportunitiesCard'
import { normalizeProduct } from '@/services/cross-sell'
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
  const [tiposSeguro, setTiposSeguro] = useState<TipoSeguro[]>([])
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isNewPolicyOpen, setIsNewPolicyOpen] = useState(false)
  const [newPolicy, setNewPolicy] = useState({
    numero_proposta: '',
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
      const [pols, segs, tps] = await Promise.all([
        getPolicies(`client = "${id}"`),
        getSeguradoras(),
        getTiposSeguro().catch(() => []),
      ])
      setPolicies(pols)
      setSeguradoras(segs)
      setTiposSeguro(tps)
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

  // Classificação de apólices e status
  const activePolicies = policies.filter((p) => p.status === 'Ativa')
  const historyPolicies = policies.filter((p) => p.status !== 'Ativa')

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const in30Days = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0]

  const upcomingRenewals = policies.filter((p) => {
    if (p.status === 'Renovação Pendente') return true
    if (p.status === 'Ativa' && p.end_date) {
      const endClean = p.end_date.split('T')[0].split(' ')[0]
      return endClean >= todayStr && endClean <= in30Days
    }
    return false
  })

  // Ramos que o cliente possui
  const clientProducts = Array.from(
    new Set(policies.map((p) => normalizeProduct(p.tipo_de_seguro || p.coverage_type || 'Outros'))),
  )

  // Último contato realizado
  const lastComm = comms.length > 0 ? comms[0] : null // sorted or created

  const handleOpenEmail = () => {
    navigate(`/comunicacao?clientId=${encodeURIComponent(client.id)}&canal=Email`)
  }

  const handleOpenNewPolicyWithTipo = (tipo?: string) => {
    if (tipo) {
      setNewPolicy((prev) => ({ ...prev, tipo_de_seguro: tipo }))
    }
    setIsNewPolicyOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Topo / Header da Ficha 360º */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/clientes')}
            className="mb-2 text-slate-500 hover:text-slate-800 -ml-2 h-7 px-2"
          >
            ← Voltar para Carteira
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
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
            <Badge
              className={
                activePolicies.length > 0
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-slate-100 text-slate-600'
              }
            >
              {activePolicies.length > 0
                ? `${activePolicies.length} apólice(s) ativa(s)`
                : 'Sem apólice ativa'}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
            <span className="flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" /> Código:{' '}
              <strong>{client.client_code || 'N/A'}</strong>
            </span>
            {client.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> {client.email}
              </span>
            )}
            {client.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> {client.phone}
              </span>
            )}
            {lastComm && (
              <span className="flex items-center gap-1 text-blue-600 font-medium">
                <Clock className="w-3.5 h-3.5" /> Último contato:{' '}
                {formatDateTimeDisplay(lastComm.created)} ({lastComm.type})
              </span>
            )}
          </div>
        </div>

        {/* Ações Rápidas Obrigatórias: Editar cliente | Abrir apólice | Nova apólice | Enviar e-mail */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditOpen(true)}
            className="flex-1 md:flex-initial"
          >
            <Edit className="w-4 h-4 mr-1.5" /> Editar Cliente
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenEmail}
            className="text-blue-600 border-blue-200 hover:bg-blue-50 flex-1 md:flex-initial"
          >
            <Send className="w-4 h-4 mr-1.5" /> Enviar E-mail
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 flex-1 md:flex-initial"
            onClick={() => handleOpenNewPolicyWithTipo()}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Nova Apólice
          </Button>
        </div>
      </div>

      {/* Seção Inteligente de Cross-sell & Oportunidades do Cliente */}
      <ClientOpportunitiesCard
        client={client}
        policies={policies}
        tiposSeguro={tiposSeguro}
        onOpenNewPolicy={(tipo) => handleOpenNewPolicyWithTipo(tipo)}
      />

      {/* Alerta de Renovações/Vencimentos Próximos */}
      {upcomingRenewals.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50 shadow-sm">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-amber-900 text-sm">
                  Renovações / Vencimentos Próximos ({upcomingRenewals.length})
                </p>
                <p className="text-xs text-amber-700">
                  {upcomingRenewals
                    .map(
                      (p) =>
                        `${p.policy_number} (${p.tipo_de_seguro || p.coverage_type}) vence em ${formatDateDisplay(p.end_date)}`,
                    )
                    .join(' | ')}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400 text-amber-800 hover:bg-amber-100 shrink-0"
              onClick={handleOpenEmail}
            >
              <Send className="w-3.5 h-3.5 mr-1" /> Notificar Renovação
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs detalhadas da Ficha 360º */}
      <Tabs defaultValue="dados">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6">
          <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
          <TabsTrigger value="ativas">Apólices Ativas ({activePolicies.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({historyPolicies.length})</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos ({payments.length})</TabsTrigger>
          <TabsTrigger value="comunicacoes">Comunicações ({comms.length})</TabsTrigger>
          <TabsTrigger value="lembretes">Lembretes ({reminders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold text-slate-800">
                Informações Pessoais & Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm text-slate-700 pt-5">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
                <Mail className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 font-medium">E-mail de Contato</p>
                  <p className="font-semibold truncate">{client.email || 'Não informado'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
                <Phone className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Telefone / WhatsApp</p>
                  <p className="font-semibold">{client.phone || 'Não informado'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
                <User className="w-5 h-5 text-purple-600 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Documento Principal</p>
                  <p className="font-semibold">{formatDocumentLabel(client)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
                <MapPin className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">CEP</p>
                  <p className="font-semibold">{client.cep || 'Não informado'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border col-span-1 md:col-span-2">
                <MapPin className="w-5 h-5 text-slate-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 font-medium">Endereço Completo</p>
                  <p className="font-semibold truncate">
                    {[client.rua, client.numero, client.bairro].filter(Boolean).join(', ') ||
                      client.address ||
                      'Não informado'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
                <MapPin className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Cidade / Estado</p>
                  <p className="font-semibold">
                    {[client.cidade, client.estado].filter(Boolean).join('/') || 'Não informado'}
                  </p>
                </div>
              </div>
              {client.tipo_pessoa !== 'PJ' && client.birth_date && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
                  <Calendar className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Data de Nascimento</p>
                    <p className="font-semibold">{formatDateDisplay(client.birth_date)}</p>
                  </div>
                </div>
              )}
              {client.notes && (
                <div className="col-span-1 md:col-span-3 p-3 rounded-lg bg-slate-50 border">
                  <p className="text-xs text-slate-500 font-medium mb-1">Observações Cadastrais</p>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{client.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ativas">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-800">
                  Apólices Ativas ({activePolicies.length})
                </CardTitle>
                <p className="text-xs text-slate-500">Contratos em vigor com vigência ativa.</p>
              </div>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => handleOpenNewPolicyWithTipo()}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Nova Apólice
              </Button>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {activePolicies.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-500 mb-3">Nenhuma apólice ativa no momento.</p>
                  <Button size="sm" variant="outline" onClick={() => handleOpenNewPolicyWithTipo()}>
                    + Vincular Primeira Apólice
                  </Button>
                </div>
              ) : (
                activePolicies.map((pol) => (
                  <div
                    key={pol.id}
                    className="p-4 border rounded-lg bg-slate-50 hover:bg-blue-50/40 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {pol.policy_number}
                        </span>
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                          {pol.status}
                        </Badge>
                        <Badge variant="outline">{pol.tipo_de_seguro || pol.coverage_type}</Badge>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Seguradora:{' '}
                        <strong>
                          {pol.expand?.seguradora?.nome || pol.insurance_company || 'Não informada'}
                        </strong>{' '}
                        | Vigência: {formatDateDisplay(pol.start_date)} a{' '}
                        {formatDateDisplay(pol.end_date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Prêmio Líquido</p>
                        <p className="font-bold text-slate-900 text-sm">
                          R$ {(pol.valor_liquido || pol.premium_amount)?.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-blue-600"
                        onClick={() => navigate(`/apolices/${pol.id}`)}
                      >
                        Abrir Apólice →
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold text-slate-800">
                Histórico Geral de Apólices ({policies.length})
              </CardTitle>
              <p className="text-xs text-slate-500">
                Inclui renovadas, vencidas, expiradas e canceladas.
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {policies.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">
                  Nenhuma apólice encontrada no histórico.
                </p>
              ) : (
                policies.map((pol) => (
                  <div
                    key={pol.id}
                    className="p-3 border rounded-lg bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{pol.policy_number}</span>
                        <Badge
                          className={
                            pol.status === 'Ativa'
                              ? 'bg-emerald-100 text-emerald-800'
                              : pol.status === 'Cancelada'
                                ? 'bg-rose-100 text-rose-800'
                                : pol.status === 'Renovação Pendente'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                          }
                        >
                          {pol.status}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {pol.tipo_de_seguro || pol.coverage_type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Seguradora: {pol.expand?.seguradora?.nome || pol.insurance_company || '-'} |
                        Vigência: {formatDateDisplay(pol.start_date)} a{' '}
                        {formatDateDisplay(pol.end_date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 h-8 text-xs"
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
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-800">
                  Histórico de Comunicações ({comms.length})
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Todos os e-mails e mensagens disparados para este segurado.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={handleOpenEmail}
              >
                <Send className="w-3.5 h-3.5 mr-1" /> Nova Mensagem
              </Button>
            </CardHeader>
            <CardContent className="pt-4 overflow-x-auto">
              {comms.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500 mb-2">
                    Nenhuma comunicação registrada para este cliente.
                  </p>
                  <Button size="sm" variant="outline" onClick={handleOpenEmail}>
                    <Send className="w-3.5 h-3.5 mr-1" /> Enviar Primeiro E-mail
                  </Button>
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                    <tr>
                      <th className="p-2.5">Tipo</th>
                      <th className="p-2.5">Assunto / Prévia</th>
                      <th className="p-2.5">Destinatário</th>
                      <th className="p-2.5">Data / Hora</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comms.map((cm) => (
                      <tr key={cm.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold">{cm.type}</td>
                        <td className="p-2.5 max-w-xs truncate">{cm.subject || cm.body}</td>
                        <td className="p-2.5 text-xs text-slate-500">
                          {cm.recipient_email || cm.recipient_phone || '-'}
                        </td>
                        <td className="p-2.5 text-xs">{formatDateTimeDisplay(cm.created)}</td>
                        <td className="p-2.5">
                          <Badge
                            variant={cm.status === 'Enviado' ? 'default' : 'outline'}
                            className={cm.status === 'Enviado' ? 'bg-emerald-600' : ''}
                          >
                            {cm.status}
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Nº da proposta (opcional)</Label>
                <Input
                  value={newPolicy.numero_proposta}
                  onChange={(e) => setNewPolicy({ ...newPolicy, numero_proposta: e.target.value })}
                  placeholder="Ex: PROP-12345"
                />
              </div>
              <div>
                <Label>Nº da apólice (opcional)</Label>
                <Input
                  value={newPolicy.policy_number}
                  onChange={(e) => setNewPolicy({ ...newPolicy, policy_number: e.target.value })}
                  placeholder="Ex: AP-987654"
                />
              </div>
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
