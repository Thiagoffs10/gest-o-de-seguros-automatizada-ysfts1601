import { useEffect, useState } from 'react'
import { Send, Mail, MessageSquare, FileSpreadsheet } from 'lucide-react'
import { getClients } from '@/services/clients'
import { getPolicies } from '@/services/policies'
import { getCommunications, createCommunication } from '@/services/communications'
import { Client, Policy, Communication as CommType } from '@/types'
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'

export default function Communication() {
  const { toast } = useToast()
  const { can } = usePermissions()
  const [clients, setClients] = useState<Client[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [comms, setComms] = useState<CommType[]>([])
  const [type, setType] = useState<'Email' | 'WhatsApp'>('WhatsApp')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const loadData = async () => {
    try {
      const [cls, pols, cms] = await Promise.all([getClients(), getPolicies(), getCommunications()])
      setClients(cls)
      setPolicies(pols)
      setComms(cms)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const selectedClient = clients.find((c) => c.id === selectedClientId)

  const handleSelectTemplate = (templateName: string) => {
    const clientName = selectedClient ? selectedClient.name : '[Nome do Cliente]'
    if (templateName === 'renovacao') {
      setSubject('Lembrete de Renovação do seu Seguro')
      setBody(
        `Olá ${clientName}, tudo bem?\n\nPassando para lembrar que a sua apólice de seguro está próxima do vencimento. Entre em contato conosco para garantir a renovação do seu plano sem interrupção de cobertura!`,
      )
    } else if (templateName === 'aniversario') {
      setSubject('Feliz Aniversário!')
      setBody(
        `Parabéns ${clientName}!\n\nDesejamos a você um dia repleto de alegrias, saúde e muito sucesso. Conte sempre com nossa equipe para proteger você e sua família!`,
      )
    }
  }

  const handleOpenClientApp = async () => {
    if (type === 'Email' && selectedClient?.email) {
      window.open(
        `mailto:${selectedClient.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      )
    } else if (type === 'WhatsApp' && selectedClient?.phone) {
      const cleanPhone = selectedClient.phone.replace(/\D/g, '')
      window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(body)}`)
    } else {
      toast({ title: 'Selecione um cliente com e-mail/telefone válidos', variant: 'destructive' })
      return
    }

    await createCommunication({
      type,
      client: selectedClientId,
      subject,
      body,
      recipient_email: selectedClient.email,
      recipient_phone: selectedClient.phone,
      status: 'Rascunho',
    })
    toast({ title: 'Mensagem aberta! Confirme o envio no aplicativo.' })
    loadData()
  }

  const exportClientsCSV = () => {
    const headers = ['Nome,Email,Telefone,Aniversario\n']
    const rows = clients.map(
      (c) => `"${c.name}","${c.email || ''}","${c.phone || ''}","${c.birth_date || ''}"\n`,
    )
    const blob = new Blob([...headers, ...rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clientes_corretora.csv'
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Central de Comunicação</h1>
          <p className="text-slate-500 text-sm">
            Prepare mensagens para envio e exporte dados para ações de marketing.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportClientsCSV}>
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Lista de Clientes (CSV)
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">Compor Mensagem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant={type === 'WhatsApp' ? 'default' : 'outline'}
                className={type === 'WhatsApp' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                onClick={() => setType('WhatsApp')}
              >
                <MessageSquare className="w-4 h-4 mr-2" /> WhatsApp
              </Button>
              <Button
                variant={type === 'Email' ? 'default' : 'outline'}
                className={type === 'Email' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                onClick={() => setType('Email')}
              >
                <Mail className="w-4 h-4 mr-2" /> E-mail
              </Button>
            </div>
            <div>
              <Label>Selecionar Segurado</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.phone || c.email || 'Sem contato'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="block mb-1">Modelos Prontos de Mensagem</Label>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSelectTemplate('renovacao')}
                >
                  Template: Renovação
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSelectTemplate('aniversario')}
                >
                  Template: Aniversário
                </Button>
              </div>
            </div>
            {type === 'Email' && (
              <div>
                <Label>Assunto do E-mail</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
            )}
            <div>
              <Label>Corpo da Mensagem</Label>
              <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 font-bold"
              onClick={handleOpenClientApp}
              disabled={!can('communications', 'create')}
            >
              <Send className="w-4 h-4 mr-2" />
              {can('communications', 'create')
                ? `Abrir no ${type === 'WhatsApp' ? 'WhatsApp Web' : 'Gerenciador de E-mail'}`
                : 'Sem permissão para enviar comunicações'}
            </Button>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-blue-50/50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-blue-900">Aviso sobre Automação</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-blue-800 space-y-2">
            <p>
              Os envios nesta tela dependem do aplicativo externo do seu navegador (mailto ou
              WhatsApp Web).
            </p>
            <p>
              A comunicação é registrada como "Rascunho" até que você confirme o envio no aplicativo
              externo.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm overflow-hidden border">
        <CardHeader>
          <CardTitle className="text-base font-bold">Histórico de Comunicações</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
              <tr>
                <th className="p-3.5">Tipo</th>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5">Assunto / Prévia</th>
                <th className="p-3.5">Data</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-6 text-slate-500">
                    Nenhuma comunicação registrada.
                  </td>
                </tr>
              ) : (
                comms.map((cm) => (
                  <tr key={cm.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold">{cm.type}</td>
                    <td className="p-3.5">{cm.expand?.client?.name || '-'}</td>
                    <td className="p-3.5 max-w-xs truncate">{cm.subject || cm.body}</td>
                    <td className="p-3.5">{new Date(cm.created).toLocaleDateString('pt-BR')}</td>
                    <td className="p-3.5">
                      <Badge variant="outline">{cm.status}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
