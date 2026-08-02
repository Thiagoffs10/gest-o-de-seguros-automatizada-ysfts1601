import { useEffect, useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Mail,
  Cake,
  RefreshCw,
  Users,
  Send,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { getClients } from '@/services/clients'
import { getPolicies } from '@/services/policies'
import { sendMassEmail } from '@/services/communications'
import { Client, Policy } from '@/types'
import { EMAIL_TEMPLATES, personalizeTemplate } from '@/lib/constants'
import { canAccessMassSend } from '@/lib/permissions'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'

type TemplateId = 'aniversario' | 'renovacao' | 'personalizado'
type FilterId = 'aniversariantes' | 'renovacao' | 'todos'

interface SendResults {
  sent: number
  failed: number
  total: number
}

export default function EnvioEmMassa() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { can } = usePermissions()
  const [clients, setClients] = useState<Client[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [template, setTemplate] = useState<TemplateId | null>(null)
  const [customSubject, setCustomSubject] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [filter, setFilter] = useState<FilterId | null>('todos')
  const [fromEmail, setFromEmail] = useState(
    import.meta.env.VITE_SENDER_EMAIL || 'contato@cred10mix.com.br',
  )
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<SendResults | null>(null)

  useEffect(() => {
    setSelectedClientIds(filteredClients.map((c) => c.id))
  }, [filteredClients])

  const selectedClients = useMemo(() => {
    return filteredClients.filter((c) => selectedClientIds.includes(c.id))
  }, [filteredClients, selectedClientIds])

  const isAllSelected =
    filteredClients.length > 0 && selectedClientIds.length === filteredClients.length

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedClientIds([])
    } else {
      setSelectedClientIds(filteredClients.map((c) => c.id))
    }
  }

  const toggleSelectClient = (id: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  useEffect(() => {
    Promise.all([getClients(), getPolicies()])
      .then(([c, p]) => {
        setClients(c)
        setPolicies(p)
      })
      .catch(() => {})
  }, [])

  const filteredClients = useMemo(() => {
    if (!filter) return []
    if (filter === 'todos') return clients.filter((c) => c.email)
    if (filter === 'aniversariantes') {
      const currentMonth = new Date().getMonth() + 1
      return clients.filter((c) => {
        if (!c.email || !c.birth_date) return false
        return new Date(c.birth_date).getMonth() + 1 === currentMonth
      })
    }
    if (filter === 'renovacao') {
      const now = new Date()
      const future = new Date(now.getTime() + 30 * 86400000)
      const clientIds = policies
        .filter((p) => {
          const end = new Date(p.end_date)
          return end >= now && end <= future
        })
        .map((p) => p.client)
      return clients.filter((c) => c.email && clientIds.includes(c.id))
    }
    return []
  }, [clients, policies, filter])

  const getPersonalizedData = (client: Client) => {
    const clientPolicy = policies.find((p) => p.client === client.id)
    const vars: Record<string, string> = {
      nome_cliente: client.name || '',
      numero_apolice: clientPolicy?.policy_number || '',
    }
    if (template === 'personalizado') {
      return {
        subject: personalizeTemplate(customSubject, vars),
        body: personalizeTemplate(customBody, vars),
      }
    }
    const tpl = template ? EMAIL_TEMPLATES[template] : null
    if (!tpl) return { subject: '', body: '' }
    return {
      subject: personalizeTemplate(tpl.subject, vars),
      body: personalizeTemplate(tpl.body, vars),
    }
  }

  const isFormValid = useMemo(() => {
    if (!template || selectedClients.length === 0) return false
    if (template === 'personalizado') {
      return customSubject.trim().length > 0 && customBody.trim().length > 0
    }
    return true
  }, [template, selectedClients.length, customSubject, customBody])

  const handleSend = () => {
    if (!isFormValid) return
    setResults(null)
    setShowConfirm(true)
  }

  const handleConfirmSend = async () => {
    setShowConfirm(false)
    setSending(true)
    setResults(null)

    const recipients = selectedClients.map((c) => {
      const { subject, body } = getPersonalizedData(c)
      return { to: c.email!, client_id: c.id, subject, body }
    })

    try {
      const result = await sendMassEmail(recipients, fromEmail)
      setResults(result)
      if (result.failed > 0) {
        toast({
          title: `${result.sent} enviados, ${result.failed} falharam`,
          variant: 'destructive',
        })
      } else {
        toast({ title: `${result.sent} e-mails enviados com sucesso!` })
      }
    } catch (err: any) {
      const msg = err?.message || 'Erro ao enviar e-mails'
      toast({ title: 'Erro ao enviar e-mails', description: msg, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  if (!canAccessMassSend(user?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  const tpl = template ? EMAIL_TEMPLATES[template] : null
  const displaySubject = template === 'personalizado' ? customSubject : tpl?.subject || ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Envio em Massa</h1>
        <p className="text-slate-500 text-sm">
          Envie comunicações automaticamente via Resend para seus clientes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">1. Escolha o Modelo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                id: 'aniversario' as TemplateId,
                label: EMAIL_TEMPLATES.aniversario.name,
                icon: Cake,
                desc: EMAIL_TEMPLATES.aniversario.subject,
              },
              {
                id: 'renovacao' as TemplateId,
                label: EMAIL_TEMPLATES.renovacao.name,
                icon: RefreshCw,
                desc: EMAIL_TEMPLATES.renovacao.subject,
              },
              {
                id: 'personalizado' as TemplateId,
                label: 'Modelo Personalizado',
                icon: FileText,
                desc: 'Crie um assunto e mensagem customizados',
              },
            ].map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${template === t.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-sm">{t.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{t.desc}</p>
                </button>
              )
            })}

            {template === 'personalizado' && (
              <div className="mt-3 p-4 bg-slate-50 rounded-lg border space-y-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Assunto *</Label>
                  <Input
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Ex: Comunicado Especial CRED10MIX"
                    className="mt-1 bg-white text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Mensagem *</Label>
                  <Textarea
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    placeholder="Digite a mensagem para os clientes..."
                    rows={4}
                    className="mt-1 bg-white text-sm"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Variáveis disponíveis:{' '}
                    <code className="bg-slate-200 px-1 rounded">${'{nome_cliente}'}</code>,{' '}
                    <code className="bg-slate-200 px-1 rounded">${'{numero_apolice}'}</code>
                  </p>
                </div>
              </div>
            )}

            {template && template !== 'personalizado' && (
              <div className="mt-2 p-3 bg-slate-50 rounded-lg">
                <p className="text-xs font-semibold text-slate-600 mb-1">Prévia do corpo:</p>
                <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-4">
                  {tpl?.body}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">2. Escolha o Filtro (Destinatários)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { id: 'aniversariantes' as FilterId, label: 'Aniversariantes do mês', icon: Cake },
              {
                id: 'renovacao' as FilterId,
                label: 'Apólices vencendo nos próximos 30 dias',
                icon: RefreshCw,
              },
              { id: 'todos' as FilterId, label: 'Todos os clientes com e-mail', icon: Users },
            ].map((f) => {
              const Icon = f.icon
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${filter === f.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-sm">{f.label}</span>
                    </div>
                    {filter === f.id && filteredClients.length > 0 && (
                      <Badge className="bg-blue-600">{filteredClients.length}</Badge>
                    )}
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {filter && filteredClients.length > 0 && (
        <>
          <Card className="shadow-sm">
            <CardContent className="pt-4">
              <Label className="text-xs font-semibold text-slate-700">E-mail do Remetente</Label>
              <Input
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="onboarding@resend.dev"
                className="mt-1 bg-white text-sm max-w-md"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Use um domínio verificado no Resend. O padrão <code>onboarding@resend.dev</code> é
                apenas para teste.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">
                  Clientes Selecionados ({selectedClients.length} de {filteredClients.length})
                </CardTitle>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                  <input
                    type="checkbox"
                    id="select-all-clients"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                  />
                  <label
                    htmlFor="select-all-clients"
                    className="cursor-pointer font-medium select-none"
                  >
                    {isAllSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </label>
                </div>
              </div>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                disabled={!isFormValid || !can('communications', 'create') || sending}
                onClick={handleSend}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" /> Enviar
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {results && (
                <div className="mb-4 p-4 bg-slate-50 rounded-lg flex items-center gap-6">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-semibold text-sm">{results.sent} enviados</span>
                  </div>
                  {results.failed > 0 && (
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="w-5 h-5" />
                      <span className="font-semibold text-sm">{results.failed} falharam</span>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {filteredClients.map((c) => {
                  const isChecked = selectedClientIds.includes(c.id)
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleSelectClient(c.id)}
                      className={`flex items-center gap-2.5 p-2 rounded text-sm border cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-blue-50/70 border-blue-200'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectClient(c.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer shrink-0"
                      />
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-xs sm:text-sm">{c.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{c.email}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Envio</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-slate-700">
              Você está prestes a enviar <strong>{selectedClients.length} e-mails</strong>{' '}
              utilizando o tema{' '}
              <strong>{template === 'personalizado' ? 'Modelo Personalizado' : tpl?.name}</strong>.
            </p>
            <p className="text-sm text-slate-500">
              Assunto: <em>{displaySubject}</em>
            </p>
            <p className="text-sm text-slate-500">
              Remetente: <em>{fromEmail}</em>
            </p>
            <p className="text-xs text-slate-400">
              Os e-mails serão enviados automaticamente via Resend e registrados no sistema.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancelar
            </Button>
            <Button className="bg-blue-600" onClick={handleConfirmSend} disabled={sending}>
              Confirmar e Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
