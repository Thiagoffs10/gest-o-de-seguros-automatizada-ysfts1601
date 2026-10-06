import { useEffect, useState, useCallback } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { FileSpreadsheet, AlertTriangle, Eye, CheckCircle, Loader2 } from 'lucide-react'
import { approveAllQueueItems } from '@/services/campaigns'
import { useToast } from '@/hooks/use-toast'
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

  const { toast } = useToast()
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
  const [isApprovingAllDirect, setIsApprovingAllDirect] = useState(false)

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

  const handleApproveAllDirect = async () => {
    const pendingIds = campaignQueue
      .filter((q) => q.status === 'AGUARDANDO_APROVACAO')
      .map((q) => q.id)
    if (pendingIds.length === 0) return

    setIsApprovingAllDirect(true)
    try {
      const count = await approveAllQueueItems(pendingIds)
      toast({
        title: 'Lote aprovado com sucesso!',
        description: `${count} e-mail(s) aprovado(s) e prontos para o disparo respeitando o teto de envio.`,
      })
      await loadData()
    } catch (err: any) {
      toast({
        title: 'Erro na aprovação em lote',
        description: err?.message || 'Falha ao aprovar itens.',
        variant: 'destructive',
      })
    } finally {
      setIsApprovingAllDirect(false)
    }
  }

  const handleNavigateToQueue = () => {
    setActiveTab('automacao')
    setTimeout(() => {
      const el = document.getElementById('secao-fila-aprovacao')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Central de Comunicação</h1>
            {pendingApprovalCount > 0 && (
              <Badge
                variant="outline"
                className="bg-amber-100 text-amber-900 border-amber-300 font-bold px-2 py-0.5 text-xs animate-pulse"
              >
                ⚠️ {pendingApprovalCount} pendente{pendingApprovalCount > 1 ? 's' : ''} de aprovação
              </Badge>
            )}
          </div>
          <p className="text-slate-500 text-sm">
            Envie mensagens individuais, crie campanhas em massa e gerencie todo o histórico.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportClientsCSV}>
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Lista de Clientes (CSV)
        </Button>
      </div>

      {/* AVISO VISUAL GRANDE NO TOPO DA CENTRAL (visível ao entrar, independentemente da aba) */}
      {pendingApprovalCount > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="relative overflow-hidden rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-500/15 via-amber-50 to-orange-50/40 p-5 shadow-md transition-all animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm ring-4 ring-amber-200">
                <AlertTriangle className="h-6 w-6 text-white stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-amber-950 tracking-tight flex items-center gap-2">
                    ⚠️ Há {pendingApprovalCount}{' '}
                    {pendingApprovalCount === 1 ? 'e-mail aguardando' : 'e-mails aguardando'} sua
                    aprovação
                  </h3>
                  <Badge className="bg-amber-600 text-white hover:bg-amber-700 text-xs font-semibold px-2">
                    Ação necessária
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm font-medium text-amber-900 leading-snug">
                  <strong className="underline decoration-amber-500 underline-offset-2">
                    Nada será enviado até você aprovar.
                  </strong>{' '}
                  Os e-mails preparados pela rotina diária ficam aguardando na fila. Sem a sua
                  aprovação, nenhum cliente receberá mensagem.
                </p>
                <p className="text-[11px] text-amber-800/90">
                  Aprove com 1 clique para liberar os envios respeitando o teto de 100/dia e
                  3.000/mês.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleNavigateToQueue}
                className="bg-white hover:bg-amber-50 border-amber-300 text-amber-950 font-semibold text-xs h-9 shadow-xs"
              >
                <Eye className="w-3.5 h-3.5 mr-1.5 text-amber-700" />
                Ver Fila de Aprovação ({pendingApprovalCount})
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleApproveAllDirect}
                disabled={isApprovingAllDirect}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-4 shadow-sm hover:shadow"
              >
                {isApprovingAllDirect ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                )}
                Aprovar Todos ({pendingApprovalCount})
              </Button>
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="automacao" className="flex items-center gap-1.5">
            <span>Automação & Fila</span>
            {pendingApprovalCount > 0 && (
              <Badge className="h-4 px-1.5 text-[11px] font-bold bg-amber-500 text-white shadow-xs">
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
            onApproveAllDirect={handleApproveAllDirect}
            approvingAllExternal={isApprovingAllDirect}
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
