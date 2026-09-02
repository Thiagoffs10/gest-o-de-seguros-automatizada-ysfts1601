import { useState, useMemo, useEffect } from 'react'
import { Send, Loader2, Mail, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { Client, Policy, Seguradora, Parceiro, TipoSeguro } from '@/types'
import { sendMassEmail } from '@/services/communications'
import { EMAIL_TEMPLATES, personalizeTemplate } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { CampanhaFilters, CampaignFilterState } from './CampanhaFilters'

interface Props {
  clients: Client[]
  policies: Policy[]
  seguradoras: Seguradora[]
  parceiros: Parceiro[]
  tiposSeguro: TipoSeguro[]
  onSuccess: () => void
}

export function CampanhasTab({
  clients,
  policies,
  seguradoras,
  parceiros,
  tiposSeguro,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const { can } = usePermissions()

  const [filters, setFilters] = useState<CampaignFilterState>({
    statusFilter: 'todos',
    eventFilter: 'todos',
    seguradoraId: 'todas',
    tipoSeguro: 'todos',
    parceiroId: 'todos',
    cidade: '',
    estado: '',
  })

  const [template, setTemplate] = useState<'aniversario' | 'renovacao' | 'personalizado'>(
    'aniversario',
  )
  const [customSubject, setCustomSubject] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [fromEmail, setFromEmail] = useState(
    import.meta.env.VITE_SENDER_EMAIL || 'noreply@cred10mix.com.br',
  )
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<{ sent: number; failed: number; total: number } | null>(
    null,
  )

  // CRITICAL FIX: Define `filteredClients` BEFORE any useEffect/useMemo that references it!
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (!c.email || !c.email.trim()) return false

      const clientPols = policies.filter((p) => p.client === c.id)
      const hasActivePolicy = clientPols.some((p) => p.status === 'Ativa')

      if (filters.statusFilter === 'ativos' && !hasActivePolicy) return false
      if (filters.statusFilter === 'inativos' && (clientPols.length === 0 || hasActivePolicy))
        return false
      if (filters.statusFilter === 'sem_apolice' && clientPols.length > 0) return false
      if (
        filters.statusFilter === 'vencidas' &&
        !clientPols.some((p) => p.status === 'Vencida' || p.status === 'Expirada')
      )
        return false

      if (filters.eventFilter === 'aniversariantes') {
        if (!c.birth_date) return false
        const currentMonth = new Date().getMonth() + 1
        if (new Date(c.birth_date).getMonth() + 1 !== currentMonth) return false
      } else if (['renovacao_30', 'renovacao_15', 'renovacao_7'].includes(filters.eventFilter)) {
        const days =
          filters.eventFilter === 'renovacao_7'
            ? 7
            : filters.eventFilter === 'renovacao_15'
              ? 15
              : 30
        const now = new Date()
        const future = new Date(now.getTime() + days * 86400000)
        const hasMatchingExp = clientPols.some((p) => {
          const end = new Date(p.end_date)
          return end >= now && end <= future
        })
        if (!hasMatchingExp) return false
      }

      if (filters.seguradoraId !== 'todas') {
        const matchSeg = clientPols.some(
          (p) =>
            p.seguradora === filters.seguradoraId || p.insurance_company === filters.seguradoraId,
        )
        if (!matchSeg) return false
      }

      if (filters.tipoSeguro !== 'todos') {
        const matchTipo = clientPols.some(
          (p) => p.tipo_de_seguro === filters.tipoSeguro || p.coverage_type === filters.tipoSeguro,
        )
        if (!matchTipo) return false
      }

      if (filters.parceiroId !== 'todos') {
        const matchParc = clientPols.some((p) => p.parceiro === filters.parceiroId)
        if (!matchParc) return false
      }

      if (filters.cidade.trim()) {
        const cid = (c.cidade || '').toLowerCase()
        if (!cid.includes(filters.cidade.trim().toLowerCase())) return false
      }

      if (filters.estado.trim()) {
        const est = (c.estado || '').toLowerCase()
        if (!est.includes(filters.estado.trim().toLowerCase())) return false
      }

      return true
    })
  }, [clients, policies, filters])

  useEffect(() => {
    setSelectedClientIds(filteredClients.map((c) => c.id))
  }, [filteredClients])

  const selectedClients = useMemo(() => {
    return filteredClients.filter((c) => selectedClientIds.includes(c.id))
  }, [filteredClients, selectedClientIds])

  const isAllSelected =
    filteredClients.length > 0 && selectedClientIds.length === filteredClients.length

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedClientIds([])
    else setSelectedClientIds(filteredClients.map((c) => c.id))
  }

  const toggleSelectClient = (id: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const getPersonalizedData = (client: Client) => {
    const clientPolicy = policies.find((p) => p.client === client.id)
    const vars: Record<string, string> = {
      nome_cliente: client.name || '',
      numero_apolice: clientPolicy?.policy_number || '',
      seguradora: clientPolicy?.expand?.seguradora?.nome || clientPolicy?.insurance_company || '',
    }
    if (template === 'personalizado') {
      return {
        subject: personalizeTemplate(customSubject, vars),
        body: personalizeTemplate(customBody, vars),
      }
    }
    const tpl = EMAIL_TEMPLATES[template]
    return {
      subject: personalizeTemplate(tpl.subject, vars),
      body: personalizeTemplate(tpl.body, vars),
    }
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
      const res = await sendMassEmail(recipients, fromEmail)
      setResults(res)
      if (res.failed > 0) {
        toast({ title: `${res.sent} enviados, ${res.failed} falharam`, variant: 'destructive' })
      } else {
        toast({ title: `${res.sent} e-mails enviados com sucesso!` })
      }
      onSuccess()
    } catch (err: any) {
      toast({ title: 'Erro ao enviar e-mails', description: err?.message, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const displaySubject =
    template === 'personalizado' ? customSubject : EMAIL_TEMPLATES[template]?.subject || ''

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold">
            1. Filtros de Segmentação da Campanha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CampanhaFilters
            filters={filters}
            setFilters={setFilters}
            seguradoras={seguradoras}
            parceiros={parceiros}
            tiposSeguro={tiposSeguro}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">2. Escolha o Modelo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                id: 'aniversario' as const,
                label: EMAIL_TEMPLATES.aniversario.name,
                desc: EMAIL_TEMPLATES.aniversario.subject,
              },
              {
                id: 'renovacao' as const,
                label: EMAIL_TEMPLATES.renovacao.name,
                desc: EMAIL_TEMPLATES.renovacao.subject,
              },
              {
                id: 'personalizado' as const,
                label: 'Modelo Personalizado',
                desc: 'Crie assunto e mensagem customizados',
              },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                  template === t.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold text-sm">{t.label}</div>
                <p className="text-xs text-slate-500 truncate">{t.desc}</p>
              </button>
            ))}

            {template === 'personalizado' && (
              <div className="p-3 bg-slate-50 rounded-lg border space-y-3 mt-2">
                <div>
                  <Label className="text-xs font-semibold">Assunto *</Label>
                  <Input
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Assunto da campanha"
                    className="mt-1 bg-white text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Mensagem *</Label>
                  <Textarea
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    rows={4}
                    placeholder="Conteúdo da mensagem..."
                    className="mt-1 bg-white text-xs"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">3. Configuração do Remetente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">E-mail do Remetente</Label>
              <Input
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@cred10mix.com.br"
                className="mt-1 bg-white text-sm"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Padrão: noreply@cred10mix.com.br (domínio verificado no Resend).
              </p>
            </div>

            <div className="p-4 bg-slate-50 border rounded-lg space-y-2">
              <p className="text-sm font-bold text-slate-800">Resumo dos Destinatários</p>
              <p className="text-xs text-slate-600">
                Será enviado para:{' '}
                <strong className="text-blue-600 text-sm">
                  {selectedClients.length} cliente(s)
                </strong>
              </p>
              <Button
                type="button"
                className="w-full bg-blue-600 hover:bg-blue-700 font-bold mt-2"
                disabled={
                  selectedClients.length === 0 || sending || !can('communications', 'create')
                }
                onClick={() => setShowConfirm(true)}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" /> Disparar Campanha
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold">
            Clientes Selecionados ({selectedClients.length} de {filteredClients.length})
          </CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={toggleSelectAll}>
            {isAllSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
          </Button>
        </CardHeader>
        <CardContent>
          {results && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg flex items-center gap-6">
              <div className="flex items-center gap-2 text-green-600 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4" /> {results.sent} e-mails enviados
              </div>
              {results.failed > 0 && (
                <div className="flex items-center gap-2 text-red-600 font-semibold text-xs">
                  <XCircle className="w-4 h-4" /> {results.failed} falharam
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {filteredClients.map((c) => {
              const checked = selectedClientIds.includes(c.id)
              return (
                <div
                  key={c.id}
                  onClick={() => toggleSelectClient(c.id)}
                  className={`flex items-center gap-2.5 p-2 rounded text-xs border cursor-pointer ${
                    checked
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {}}
                    className="rounded text-blue-600 h-4 w-4"
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{c.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{c.email}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedClients.length > 20 && <AlertTriangle className="w-5 h-5 text-amber-500" />}
              Confirmar Envio da Campanha
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-slate-700">
            {selectedClients.length > 20 ? (
              <p className="font-bold text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
                Confirma o envio para {selectedClients.length} clientes?
              </p>
            ) : (
              <p>
                Você está prestes a enviar e-mails para{' '}
                <strong>{selectedClients.length} cliente(s)</strong>.
              </p>
            )}
            <p className="text-xs text-slate-500">
              Assunto: <em>{displaySubject}</em>
            </p>
            <p className="text-xs text-slate-500">
              Remetente: <em>{fromEmail}</em>
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
