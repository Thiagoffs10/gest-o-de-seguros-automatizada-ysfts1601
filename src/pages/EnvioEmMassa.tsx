import { useEffect, useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { Mail, Cake, RefreshCw, Users, Send, ChevronRight, CheckCircle2 } from 'lucide-react'
import { getClients } from '@/services/clients'
import { getPolicies } from '@/services/policies'
import { createCommunication } from '@/services/communications'
import { Client, Policy } from '@/types'
import { EMAIL_TEMPLATES, personalizeTemplate } from '@/lib/constants'
import { canAccessMassSend } from '@/lib/permissions'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'

type TemplateId = 'aniversario' | 'renovacao'
type FilterId = 'aniversariantes' | 'renovacao' | 'todos'

export default function EnvioEmMassa() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { can } = usePermissions()
  const [clients, setClients] = useState<Client[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [template, setTemplate] = useState<TemplateId | null>(null)
  const [filter, setFilter] = useState<FilterId | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [sendStep, setSendStep] = useState(-1)
  const [sentCount, setSentCount] = useState(0)

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
    const tpl = template ? EMAIL_TEMPLATES[template] : null
    if (!tpl) return { subject: '', body: '' }
    const clientPolicy = policies.find((p) => p.client === client.id)
    const vars: Record<string, string> = {
      nome_cliente: client.name || '',
      numero_apolice: clientPolicy?.policy_number || '',
    }
    return {
      subject: personalizeTemplate(tpl.subject, vars),
      body: personalizeTemplate(tpl.body, vars),
    }
  }

  const handleSend = () => {
    if (!template || filteredClients.length === 0) return
    setShowConfirm(true)
  }

  const handleConfirmSend = () => {
    setShowConfirm(false)
    setSendStep(0)
    setSentCount(0)
  }

  const handleOpenEmail = (client: Client) => {
    const { subject, body } = getPersonalizedData(client)
    const mailto = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailto
  }

  const handleNext = async () => {
    const currentClient = filteredClients[sendStep]
    if (currentClient) {
      const { subject, body } = getPersonalizedData(currentClient)
      try {
        await createCommunication({
          type: 'Email',
          client: currentClient.id,
          subject,
          body,
          recipient_email: currentClient.email,
          status: 'Enviado',
          sent_date: new Date().toISOString(),
        })
        setSentCount((s) => s + 1)
      } catch {
        /* intentionally ignored */
      }
    }
    if (sendStep + 1 >= filteredClients.length) {
      toast({ title: `${sentCount + 1} emails processados!` })
      setSendStep(-1)
    } else {
      setSendStep((s) => s + 1)
    }
  }

  if (!canAccessMassSend(user?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  const currentClient = sendStep >= 0 ? filteredClients[sendStep] : null
  const tpl = template ? EMAIL_TEMPLATES[template] : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Envio em Massa</h1>
        <p className="text-slate-500 text-sm">
          Selecione um modelo e filtro para enviar comunicações semi-automatizadas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">1. Escolha o Modelo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(['aniversario', 'renovacao'] as TemplateId[]).map((id) => {
              const t = EMAIL_TEMPLATES[id]
              const Icon = id === 'aniversario' ? Cake : RefreshCw
              return (
                <button
                  key={id}
                  onClick={() => setTemplate(id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${template === id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-sm">{t.name}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{t.subject}</p>
                </button>
              )
            })}
            {template && (
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
            <CardTitle className="text-base">2. Escolha o Filtro</CardTitle>
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
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Clientes Selecionados ({filteredClients.length})
            </CardTitle>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!template || !can('communications', 'create')}
              onClick={handleSend}
            >
              <Send className="w-4 h-4 mr-2" /> Enviar
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {filteredClients.map((c) => (
                <div key={c.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded text-sm">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-slate-500 truncate">{c.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Envio</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-slate-700">
              Você está prestes a enviar <strong>{filteredClients.length} emails</strong> com o tema{' '}
              <strong>{tpl?.name}</strong>.
            </p>
            <p className="text-sm text-slate-500">
              Assunto: <em>{tpl?.subject.replace(/\$\{[^}]+\}/g, '...')}</em>
            </p>
            <p className="text-xs text-slate-400">
              O sistema abrirá seu cliente de email para cada cliente, um por vez.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancelar
            </Button>
            <Button className="bg-blue-600" onClick={handleConfirmSend}>
              Confirmar e Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={sendStep >= 0}
        onOpenChange={(open) => {
          if (!open) setSendStep(-1)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Envio Sequencial ({sendStep + 1} de {filteredClients.length})
            </DialogTitle>
          </DialogHeader>
          {currentClient && (
            <div className="space-y-3 py-2">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-semibold text-sm">{currentClient.name}</p>
                <p className="text-xs text-slate-500">{currentClient.email}</p>
              </div>
              <div className="p-3 border rounded-lg">
                <p className="text-xs font-semibold text-slate-600 mb-1">Assunto:</p>
                <p className="text-sm">{getPersonalizedData(currentClient).subject}</p>
                <p className="text-xs font-semibold text-slate-600 mt-2 mb-1">Corpo:</p>
                <p className="text-xs text-slate-600 whitespace-pre-wrap">
                  {getPersonalizedData(currentClient).body}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Enviados: {sentCount}</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSendStep(-1)}>
                    Cancelar
                  </Button>
                  <Button variant="secondary" onClick={() => handleOpenEmail(currentClient)}>
                    <Mail className="w-4 h-4 mr-1" /> Abrir Email
                  </Button>
                  <Button className="bg-blue-600" onClick={handleNext}>
                    {sendStep + 1 >= filteredClients.length ? 'Concluir' : 'Próximo'}
                    {sendStep + 1 < filteredClients.length && (
                      <ChevronRight className="w-4 h-4 ml-1" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
