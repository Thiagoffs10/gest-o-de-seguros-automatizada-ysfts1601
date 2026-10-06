import { useState, useMemo } from 'react'
import {
  Send,
  Mail,
  MessageSquare,
  FileText,
  Cake,
  RefreshCw,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Client, Policy, EmailTemplate } from '@/types'
import { createCommunication, sendSingleEmail } from '@/services/communications'
import { BANCO_MENSAGENS_EDUCATIVAS_E_OFERTAS } from '@/services/campanhas-educativas-banco'
import { formatClientDocument } from '@/lib/document-validators'
import { ImageUploadField, AttachedImage } from './ImageUploadField'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { ClientProfileCard } from './ClientProfileCard'

interface Props {
  clients: Client[]
  policies: Policy[]
  templates?: EmailTemplate[]
  initialClientId?: string
  initialChannel?: 'WhatsApp' | 'Email'
  initialSubject?: string
  initialBody?: string
  onSuccess: () => void
}

export function IndividualTab({
  clients,
  policies,
  templates = [],
  initialClientId,
  initialChannel,
  initialSubject,
  initialBody,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const { can } = usePermissions()
  const [type, setType] = useState<'WhatsApp' | 'Email'>(initialChannel || 'WhatsApp')
  const [search, setSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState(initialClientId || '')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('custom')
  const [subject, setSubject] = useState(initialSubject || '')
  const [body, setBody] = useState(initialBody || '')
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null)
  const [sending, setSending] = useState(false)

  // Sincronizar caso initialClientId ou initialChannel mudem via navegação
  useState(() => {
    if (initialClientId) {
      setSelectedClientId(initialClientId)
    }
    if (initialChannel) {
      setType(initialChannel)
    }
    if (initialSubject) {
      setSubject(initialSubject)
    }
    if (initialBody) {
      setBody(initialBody)
    }
  })

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

  const getClientVars = (clientId: string): Record<string, string> => {
    const client = clients.find((c) => c.id === clientId)
    const clientPols = policies.filter((p) => p.client === clientId)
    const activePol = clientPols.find((p) => p.status === 'Ativa')
    const lastPol = activePol || clientPols[0]
    const fullName = client?.name || ''
    const firstName = fullName.split(' ')[0] || ''

    return {
      nome: fullName || '[Nome do Cliente]',
      primeiro_nome: firstName || '[Primeiro Nome]',
      nome_cliente: fullName || '[Nome do Cliente]',
      tipo_seguro: lastPol?.tipo_de_seguro || lastPol?.coverage_type || 'Seguro',
      numero_apolice: lastPol?.policy_number || lastPol?.numero_proposta || '[Número da Apólice]',
      seguradora: lastPol?.expand?.seguradora?.nome || lastPol?.insurance_company || '[Seguradora]',
      email: client?.email || '',
      telefone: client?.phone || '',
    }
  }

  const applyVarsToText = (rawText: string, vars: Record<string, string>): string => {
    if (!rawText) return ''
    let text = rawText
    Object.entries(vars).forEach(([k, v]) => {
      const reBraces = new RegExp(`\\{${k}\\}`, 'gi')
      const reDollarBraces = new RegExp(`\\$\\{${k}\\}`, 'gi')
      text = text.replace(reDollarBraces, v || '').replace(reBraces, v || '')
    })
    return text
  }

  const handleClientChange = (newClientId: string) => {
    setSelectedClientId(newClientId)
    if (!newClientId) return

    // Se houver um modelo selecionado no dropdown, re-aplica para o novo cliente
    if (selectedTemplateId && selectedTemplateId !== 'custom') {
      applyTemplateById(selectedTemplateId, newClientId)
    }
  }

  const applyTemplateById = (templateKey: string, clientId?: string) => {
    setSelectedTemplateId(templateKey)
    if (templateKey === 'custom') return

    const targetId = clientId !== undefined ? clientId : selectedClientId
    const vars = getClientVars(targetId)

    // Verificar se é modelo de email_templates
    if (templateKey.startsWith('db_')) {
      const dbId = templateKey.replace('db_', '')
      const t = templates.find((item) => item.id === dbId)
      if (t) {
        setSubject(applyVarsToText(t.subject || '', vars))
        setBody(applyVarsToText(t.body || '', vars))
        return
      }
    }

    // Verificar se é modelo do banco educativo
    if (templateKey.startsWith('banco_')) {
      const bancoId = templateKey.replace('banco_', '')
      const m = BANCO_MENSAGENS_EDUCATIVAS_E_OFERTAS.find((item) => item.id === bancoId)
      if (m) {
        setSubject(applyVarsToText(m.sugestaoAssunto || m.titulo, vars))
        setBody(applyVarsToText(m.sugestaoCorpo || '', vars))
        return
      }
    }

    // Fallback legado direto por id de template
    const legacyT = templates.find((item) => item.id === templateKey)
    if (legacyT) {
      setSubject(applyVarsToText(legacyT.subject || '', vars))
      setBody(applyVarsToText(legacyT.body || '', vars))
    }
  }

  const handleTemplateChange = (templateId: string) => {
    applyTemplateById(templateId)
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

    // CRÍTICO (Item 3 do Usuário):
    // "Se eu aplicar um modelo e editar manualmente assunto ou mensagem, envie exatamente o texto final que revisei.
    // Não substitua minhas alterações pelo conteúdo original do modelo no momento do envio."
    // Enviamos exatamente o texto final editado pelo usuário no estado (subject e body),
    // aplicando apenas substituição de variáveis explícitas ainda presentes como {nome_cliente} etc.,
    // SEM NUNCA resetar para o t.subject ou t.body original do modelo!
    const vars = getClientVars(selectedClientId)
    const finalSubject = applyVarsToText(subject, vars)
    const finalBody = applyVarsToText(body, vars)

    // Manter a tela sincronizada com o texto final revisado
    setSubject(finalSubject)
    setBody(finalBody)

    if (type === 'Email') {
      setSending(true)
      try {
        const attachmentPayload = attachedImage
          ? {
              filename: attachedImage.filename,
              content: attachedImage.content,
              content_type: attachedImage.content_type,
            }
          : undefined

        const res = await sendSingleEmail({
          to: selectedClient.email!,
          client_id: selectedClientId,
          subject: finalSubject,
          body: finalBody,
          attachment: attachmentPayload,
        })
        if (res.success) {
          toast({ title: 'E-mail enviado com sucesso!' })
        } else {
          toast({
            title: 'Falha ao enviar e-mail',
            description: res.message || 'Ocorreu um erro no envio.',
            variant: 'destructive',
          })
        }
        onSuccess()
      } catch (err: any) {
        toast({
          title: 'Erro ao enviar e-mail',
          description: err?.message || 'Erro inesperado.',
          variant: 'destructive',
        })
      } finally {
        setSending(false)
      }
    } else {
      const cleanPhone = (selectedClient.phone || '').replace(/\D/g, '')
      window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(finalBody)}`)

      try {
        await createCommunication({
          type,
          client: selectedClientId,
          subject: 'WhatsApp Direct',
          body: finalBody,
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

          {/* Item 1: Dropdown Modelo de Mensagem (Opcional) no topo do formulário */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Modelo de Mensagem (Opcional)
              </Label>
              {selectedTemplateId !== 'custom' && (
                <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Modelo aplicado • Texto 100% editável
                </span>
              )}
            </div>
            <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
              <SelectTrigger className="h-9 text-xs bg-white">
                <SelectValue placeholder="Selecione um modelo para preencher Assunto e Mensagem..." />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="custom" className="text-xs font-medium text-slate-600">
                  — Nenhum modelo selecionado (digitação livre) —
                </SelectItem>
                {templates.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                      Modelos de E-mail Salvos ({templates.length})
                    </SelectLabel>
                    {templates.map((tpl) => (
                      <SelectItem key={tpl.id} value={`db_${tpl.id}`} className="text-xs">
                        {tpl.name} {tpl.type ? `(${tpl.type})` : ''}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                <SelectGroup>
                  <SelectLabel className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Banco de Mensagens e Campanhas ({BANCO_MENSAGENS_EDUCATIVAS_E_OFERTAS.length})
                  </SelectLabel>
                  {BANCO_MENSAGENS_EDUCATIVAS_E_OFERTAS.map((m) => (
                    <SelectItem key={m.id} value={`banco_${m.id}`} className="text-xs">
                      {m.titulo} • {m.ramo}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500">
              Ao escolher um modelo, Assunto e Mensagem são preenchidos substituindo variáveis como{' '}
              <code className="text-blue-700 bg-white px-1 rounded">{'{nome}'}</code>,{' '}
              <code className="text-blue-700 bg-white px-1 rounded">{'{primeiro_nome}'}</code> e{' '}
              <code className="text-blue-700 bg-white px-1 rounded">{'{tipo_seguro}'}</code> pelos
              dados do cliente.
            </p>
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
              <Select value={selectedClientId} onValueChange={handleClientChange}>
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

          {/* Atalhos rápidos de modelos (mantém compatibilidade com botões rápidos) */}
          <div>
            <Label className="block mb-1 text-xs font-semibold text-slate-600">
              Atalhos Rápidos de Modelos
            </Label>
            <div className="flex flex-wrap gap-2">
              {templates.map((tpl) => (
                <Button
                  key={tpl.id}
                  type="button"
                  variant={
                    selectedTemplateId === `db_${tpl.id}` || selectedTemplateId === tpl.id
                      ? 'default'
                      : 'outline'
                  }
                  size="sm"
                  className={
                    selectedTemplateId === `db_${tpl.id}` || selectedTemplateId === tpl.id
                      ? 'bg-blue-600 hover:bg-blue-700 text-xs h-7'
                      : 'text-xs h-7'
                  }
                  onClick={() => handleTemplateChange(`db_${tpl.id}`)}
                >
                  {tpl.type === 'Aniversário' ? (
                    <Cake className="w-3 h-3 mr-1" />
                  ) : tpl.type === 'Renovação' ? (
                    <RefreshCw className="w-3 h-3 mr-1" />
                  ) : (
                    <FileText className="w-3 h-3 mr-1" />
                  )}
                  {tpl.name}
                </Button>
              ))}
              <Button
                type="button"
                variant={selectedTemplateId === 'custom' ? 'default' : 'outline'}
                size="sm"
                className={
                  selectedTemplateId === 'custom'
                    ? 'bg-slate-800 hover:bg-slate-900 text-xs h-7'
                    : 'text-xs h-7'
                }
                onClick={() => handleTemplateChange('custom')}
              >
                <FileText className="w-3 h-3 mr-1" /> Personalizado / Livre
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
              Variáveis dinâmicas suportadas:{' '}
              <code className="bg-slate-200 px-1 rounded">{'{nome}'}</code>,{' '}
              <code className="bg-slate-200 px-1 rounded">{'{primeiro_nome}'}</code>,{' '}
              <code className="bg-slate-200 px-1 rounded">{'{tipo_seguro}'}</code>,{' '}
              <code className="bg-slate-200 px-1 rounded">{'{seguradora}'}</code>,{' '}
              <code className="bg-slate-200 px-1 rounded">{'{numero_apolice}'}</code>
            </p>
          </div>

          {type === 'Email' && (
            <div className="pt-2 border-t border-slate-200">
              <ImageUploadField
                image={attachedImage}
                onChange={setAttachedImage}
                disabled={sending}
                label="Anexar Imagem ao E-mail"
                helperText="JPG, PNG ou WEBP (máx. 5MB). A imagem será enviada embutida no corpo do e-mail junto ao rodapé oficial."
              />
            </div>
          )}

          <Button
            type="button"
            className="w-full bg-blue-600 hover:bg-blue-700 font-bold"
            onClick={handleSend}
            disabled={
              sending ||
              !selectedClient ||
              (type === 'Email' && !hasEmail) ||
              !can('communications', 'create')
            }
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando e-mail...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {can('communications', 'create')
                  ? `Enviar via ${type === 'WhatsApp' ? 'WhatsApp' : 'E-mail'}`
                  : 'Sem permissão para enviar'}
              </>
            )}
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
            2. Escolha entre enviar mensagem via <strong>WhatsApp Web</strong> ou enviar
            automaticamente por <strong>E-mail</strong> através do sistema.
          </p>
          <p>3. Selecione um modelo pronto ou escreva uma mensagem personalizada.</p>
          <p>
            4. Os e-mails são enviados automaticamente e o resultado (Enviado/Falhou) é registrado
            no histórico unificado.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
