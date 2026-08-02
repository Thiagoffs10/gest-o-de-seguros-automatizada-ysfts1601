import { useState, useMemo } from 'react'
import { Send, Mail, MessageSquare, FileText, Cake, RefreshCw } from 'lucide-react'
import { Client, Policy } from '@/types'
import { createCommunication } from '@/services/communications'
import { formatClientDocument } from '@/lib/document-validators'
import { EMAIL_TEMPLATES, personalizeTemplate } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { ClientProfileCard } from './ClientProfileCard'

interface Props {
  clients: Client[]
  policies: Policy[]
  onSuccess: () => void
}

export function IndividualTab({ clients, policies, onSuccess }: Props) {
  const { toast } = useToast()
  const { can } = usePermissions()
  const [type, setType] = useState<'WhatsApp' | 'Email'>('WhatsApp')
  const [search, setSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [template, setTemplate] = useState<'aniversario' | 'renovacao' | 'personalizado'>(
    'personalizado',
  )
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients
    const q = search.trim().toLowerCase()
    const cleanNum = q.replace(/\D/g, '')
    return clients.filter((c) => {
      if (c.name && c.name.toLowerCase().includes(q)) return true
      if (c.email && c.email.toLowerCase().includes(q)) return true
      const cpfClean = (c.cpf || '').replace(/\D/g, '')
      const cnpjClean = (c.cnpj || '').replace(/\D/g, '')
      if (cpfClean && cleanNum && cpfClean.includes(cleanNum)) return true
      if (cnpjClean && cleanNum && cnpjClean.includes(cleanNum)) return true
      return false
    })
  }, [clients, search])

  const selectedClient = clients.find((c) => c.id === selectedClientId)
  const hasEmail = Boolean(selectedClient?.email && selectedClient.email.trim().length > 0)

  const handleTemplateChange = (tpl: 'aniversario' | 'renovacao' | 'personalizado') => {
    setTemplate(tpl)
    const lastPol = policies.find((p) => p.client === selectedClientId)
    const vars: Record<string, string> = {
      nome_cliente: selectedClient?.name || '[Nome do Cliente]',
      numero_apolice: lastPol?.policy_number || '[Número da Apólice]',
      seguradora: lastPol?.expand?.seguradora?.nome || lastPol?.insurance_company || '[Seguradora]',
    }

    if (tpl === 'aniversario') {
      const t = EMAIL_TEMPLATES.aniversario
      setSubject(personalizeTemplate(t.subject, vars))
      setBody(personalizeTemplate(t.body, vars))
    } else if (tpl === 'renovacao') {
      const t = EMAIL_TEMPLATES.renovacao
      setSubject(personalizeTemplate(t.subject, vars))
      setBody(personalizeTemplate(t.body, vars))
    }
  }

  const handleSend = async () => {
    if (!selectedClient) {
      toast({ title: 'Selecione um cliente primeiro', variant: 'destructive' })
      return
    }

    if (type === 'Email' && !hasEmail) {
      toast({ title: 'Este cliente não possui e-mail cadastrado', variant: 'destructive' })
      return
    }

    if (type === 'WhatsApp' && !selectedClient.phone) {
      toast({ title: 'Este cliente não possui telefone cadastrado', variant: 'destructive' })
      return
    }

    if (type === 'Email') {
      window.open(
        `mailto:${selectedClient.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      )
    } else {
      const cleanPhone = (selectedClient.phone || '').replace(/\D/g, '')
      window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(body)}`)
    }

    try {
      await createCommunication({
        type,
        client: selectedClientId,
        subject: type === 'Email' ? subject : 'WhatsApp Direct',
        body,
        recipient_email: selectedClient.email,
        recipient_phone: selectedClient.phone,
        status: 'Rascunho',
        sent_date: new Date().toISOString(),
      })
      toast({ title: 'Comunicação aberta e registrada no histórico!' })
      onSuccess()
    } catch {
      toast({ title: 'Erro ao registrar histórico', variant: 'destructive' })
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold">Compor Mensagem Individual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              type="button"
              variant={type === 'WhatsApp' ? 'default' : 'outline'}
              className={type === 'WhatsApp' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              onClick={() => setType('WhatsApp')}
            >
              <MessageSquare className="w-4 h-4 mr-2" /> WhatsApp
            </Button>
            <Button
              type="button"
              variant={type === 'Email' ? 'default' : 'outline'}
              className={type === 'Email' ? 'bg-blue-600 hover:bg-blue-700' : ''}
              onClick={() => setType('Email')}
            >
              <Mail className="w-4 h-4 mr-2" /> E-mail
            </Button>
          </div>

          <div>
            <Label className="text-xs font-semibold">Buscar e Selecionar Cliente</Label>
            <div className="space-y-2 mt-1">
              <Input
                placeholder="Busque por Nome, E-mail, CPF ou CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-xs bg-white"
              />
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredClients.length === 0 ? (
                    <SelectItem value="_empty" disabled className="text-slate-400 text-xs">
                      Nenhum cliente encontrado
                    </SelectItem>
                  ) : (
                    filteredClients.slice(0, 50).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {formatClientDocument(c) ? `(${formatClientDocument(c)})` : ''} -{' '}
                        {c.email || c.phone || 'Sem contato'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedClient && (
            <ClientProfileCard client={selectedClient} policies={policies} type={type} />
          )}

          <div>
            <Label className="block mb-1 text-xs font-semibold">Modelo de Mensagem</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={template === 'renovacao' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTemplateChange('renovacao')}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Renovação
              </Button>
              <Button
                type="button"
                variant={template === 'aniversario' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTemplateChange('aniversario')}
              >
                <Cake className="w-3.5 h-3.5 mr-1" /> Aniversário
              </Button>
              <Button
                type="button"
                variant={template === 'personalizado' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTemplateChange('personalizado')}
              >
                <FileText className="w-3.5 h-3.5 mr-1" /> Personalizado
              </Button>
            </div>
          </div>

          {type === 'Email' && (
            <div>
              <Label className="text-xs font-semibold">Assunto do E-mail *</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Lembrete Importante CRED10MIX"
                className="mt-1 bg-white text-xs"
              />
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold">Mensagem *</Label>
            <Textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Digite a mensagem para o cliente..."
              className="mt-1 bg-white text-xs"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Variáveis disponíveis:{' '}
              <code className="bg-slate-200 px-1 rounded">{'{nome_cliente}'}</code>,{' '}
              <code className="bg-slate-200 px-1 rounded">{'{numero_apolice}'}</code>,{' '}
              <code className="bg-slate-200 px-1 rounded">{'{seguradora}'}</code>
            </p>
          </div>

          <Button
            type="button"
            className="w-full bg-blue-600 hover:bg-blue-700 font-bold"
            onClick={handleSend}
            disabled={
              !selectedClient || (type === 'Email' && !hasEmail) || !can('communications', 'create')
            }
          >
            <Send className="w-4 h-4 mr-2" />
            {can('communications', 'create')
              ? `Enviar via ${type === 'WhatsApp' ? 'WhatsApp' : 'E-mail'}`
              : 'Sem permissão para enviar'}
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm bg-blue-50/50 border-blue-200 h-fit">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-blue-900">Como Funciona</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-blue-800 space-y-3">
          <p>1. Selecione o cliente desejado buscando por nome, e-mail, CPF ou CNPJ.</p>
          <p>
            2. Escolha entre enviar mensagem via <strong>WhatsApp Web</strong> ou abrir no seu
            gerenciador de <strong>E-mail</strong>.
          </p>
          <p>3. Selecione um modelo pronto ou escreva uma mensagem personalizada.</p>
          <p>4. Todas as comunicações geradas ficam registradas no histórico unificado.</p>
        </CardContent>
      </Card>
    </div>
  )
}
