import { useEffect, useState, useCallback } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { FileSpreadsheet } from 'lucide-react'
import { getClients } from '@/services/clients'
import { getPolicies } from '@/services/policies'
import { getSeguradoras } from '@/services/seguradoras'
import { getParceiros } from '@/services/parceiros'
import { getTiposSeguro } from '@/services/tipos-seguro'
import { getCommunications } from '@/services/communications'
import { getEmailTemplates } from '@/services/email-templates'
import {
  Client,
  Policy,
  Seguradora,
  Parceiro,
  TipoSeguro,
  EmailTemplate,
  Communication as CommType,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { IndividualTab } from '@/components/comunicacao/IndividualTab'
import { CampanhasTab } from '@/components/comunicacao/CampanhasTab'
import { AutomacaoCampanhasTab } from '@/components/comunicacao/AutomacaoCampanhasTab'
import { CommsHistory } from '@/components/comunicacao/CommsHistory'
import { EmailTemplatesManager } from '@/components/comunicacao/EmailTemplatesManager'
import { useRealtime } from '@/hooks/use-realtime'
import {
  CampaignAutomation,
  CampaignQueueItem,
  CampaignSendLog,
  getCampaignAutomations,
  getCampaignQueue,
  getCampaignSendLogs,
} from '@/services/campaigns'

export default function Communication() {
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const queryClientId = searchParams.get('clientId') || (location.state as any)?.clientId || ''
  const queryChannel = (searchParams.get('canal') || (location.state as any)?.canal || 'Email') as
    | 'WhatsApp'
    | 'Email'
  const querySubject = searchParams.get('assunto') || (location.state as any)?.assunto || ''
  const queryBody = searchParams.get('corpo') || (location.state as any)?.corpo || ''
  const initialTab = searchParams.get('tab') || (location.state as any)?.tab || 'automacao'

  const [activeTab, setActiveTab] = useState(initialTab)
  const [clients, setClients] = useState<Client[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([])
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [tiposSeguro, setTiposSeguro] = useState<TipoSeguro[]>([])
  const [comms, setComms] = useState<CommType[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])

  // Estados de Automação de E-mail (Campanhas, Fila e Logs)
  const [campaigns, setCampaigns] = useState<CampaignAutomation[]>([])
  const [campaignQueue, setCampaignQueue] = useState<CampaignQueueItem[]>([])
  const [campaignLogs, setCampaignLogs] = useState<CampaignSendLog[]>([])

  const loadData = useCallback(async () => {
    try {
      const [cls, pols, segs, parcs, tipos, cms, tpls, camps, queue, cLogs] = await Promise.all([
        getClients(),
        getPolicies(),
        getSeguradoras().catch(() => []),
        getParceiros().catch(() => []),
        getTiposSeguro().catch(() => []),
        getCommunications().catch(() => []),
        getEmailTemplates().catch(() => []),
        getCampaignAutomations().catch(() => []),
        getCampaignQueue().catch(() => []),
        getCampaignSendLogs().catch(() => []),
      ])
      setClients(cls)
      setPolicies(pols)
      setSeguradoras(segs)
      setParceiros(parcs)
      setTiposSeguro(tipos)
      setComms(cms)
      setTemplates(tpls)
      setCampaigns(camps)
      setCampaignQueue(queue)
      setCampaignLogs(cLogs)
    } catch {
      /* intentionally ignored */
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('email_templates', () => loadData())
  useRealtime('campaign_automations', () => loadData())
  useRealtime('campaign_queue', () => loadData())
  useRealtime('campaign_send_logs', () => loadData())

  const pendingApprovalCount = campaignQueue.filter(
    (q) => q.status === 'AGUARDANDO_APROVACAO',
  ).length

  const exportClientsCSV = () => {
    const headers = ['Nome,Email,Telefone,CPF,CNPJ,Aniversario\n']
    const rows = clients.map(
      (c) =>
        `"${c.name}","${c.email || ''}","${c.phone || ''}","${c.cpf || ''}","${c.cnpj || ''}","${c.birth_date || ''}"\n`,
    )
    const blob = new Blob([...headers, ...rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lista_clientes_comunicacao.csv'
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Central de Comunicação</h1>
          <p className="text-slate-500 text-sm">
            Envie mensagens individuais, crie campanhas em massa e gerencie todo o histórico.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportClientsCSV}>
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Lista de Clientes (CSV)
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="automacao" className="flex items-center gap-1.5">
            <span>Automação & Fila</span>
            {pendingApprovalCount > 0 && (
              <Badge className="h-4 px-1 text-[10px] bg-amber-500 text-white">
                {pendingApprovalCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="campanhas">Disparo em Massa</TabsTrigger>
          <TabsTrigger value="individual">Comunicação Individual</TabsTrigger>
          <TabsTrigger value="templates">Modelos de E-mail</TabsTrigger>
        </TabsList>

        {/* 1. NOVA ÁREA DE AUTOMAÇÃO (Campanhas Educativas + Ofertas, Fila de Aprovação, Teto 100/dia e 3.000/mês) */}
        <TabsContent value="automacao" className="mt-4">
          <AutomacaoCampanhasTab
            campaigns={campaigns}
            queue={campaignQueue}
            logs={campaignLogs}
            onRefresh={loadData}
          />
        </TabsContent>

        {/* 2. DISPARO EM MASSA ATUAL (100% mantido e funcionando) */}
        <TabsContent value="campanhas" className="mt-4">
          <CampanhasTab
            clients={clients}
            policies={policies}
            seguradoras={seguradoras}
            parceiros={parceiros}
            tiposSeguro={tiposSeguro}
            templates={templates}
            onSuccess={loadData}
          />
        </TabsContent>

        {/* 3. COMUNICAÇÃO INDIVIDUAL ATUAL (100% mantida e funcionando) */}
        <TabsContent value="individual" className="mt-4">
          <IndividualTab
            clients={clients}
            policies={policies}
            templates={templates}
            initialClientId={queryClientId}
            initialChannel={queryChannel}
            initialSubject={querySubject}
            initialBody={queryBody}
            onSuccess={loadData}
          />
        </TabsContent>

        {/* 4. MODELOS DE E-MAIL */}
        <TabsContent value="templates" className="mt-4">
          <EmailTemplatesManager templates={templates} onTemplatesChange={loadData} />
        </TabsContent>
      </Tabs>

      <CommsHistory communications={comms} />
    </div>
  )
}
