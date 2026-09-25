import { useState } from 'react'
import {
  Sparkles,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Eye,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { CampaignAutomation, CampaignQueueItem, CampaignSendLog } from '@/services/campaigns'
import {
  approveQueueItem,
  rejectQueueItem,
  approveAllQueueItems,
  dispatchCampaignQueue,
  prepareCampaignDaily,
} from '@/services/campaigns'
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
import { formatDateDisplay } from '@/lib/utils'
import { BANCO_MENSAGENS_EDUCATIVAS_E_OFERTAS } from '@/services/campanhas-educativas-banco'

interface Props {
  campaigns: CampaignAutomation[]
  queue: CampaignQueueItem[]
  logs: CampaignSendLog[]
  onRefresh: () => void
}

export function AutomacaoCampanhasTab({ campaigns, queue, logs, onRefresh }: Props) {
  const { toast } = useToast()
  const [subTab, setSubTab] = useState<'fila' | 'campanhas' | 'banco' | 'historico'>('fila')
  const [preparing, setPreparing] = useState(false)
  const [dispatching, setDispatching] = useState(false)
  const [approvingAll, setApprovingAll] = useState(false)
  const [selectedItem, setSelectedItem] = useState<CampaignQueueItem | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  // Cálculos do Teto Diário (100) e Mensal (3.000)
  const todayStr = new Date().toISOString().split('T')[0]
  const currentMonthStr = todayStr.substring(0, 7) // 'YYYY-MM'

  const dailySentCount = logs.filter(
    (l) => l.data_envio && l.data_envio.startsWith(todayStr) && l.status_envio === 'ENVIADO',
  ).length
  const monthlySentCount = logs.filter(
    (l) => l.data_envio && l.data_envio.startsWith(currentMonthStr) && l.status_envio === 'ENVIADO',
  ).length

  const dailyCap = 100
  const monthlyCap = 3000
  const dailyPercent = Math.min(100, Math.round((dailySentCount / dailyCap) * 100))
  const monthlyPercent = Math.min(100, Math.round((monthlySentCount / monthlyCap) * 100))
  const isNearMonthlyCap = monthlySentCount >= 2700

  // Contadores da Fila
  const aguardandoAprovacao = queue.filter((q) => q.status === 'AGUARDANDO_APROVACAO')
  const aprovadosParaDisparo = queue.filter(
    (q) => q.status === 'APROVADO' || q.status === 'ESGOTAMENTO_ESPERA',
  )
  const emEsperaEsgotamento = queue.filter((q) => q.status === 'ESGOTAMENTO_ESPERA')

  const filteredQueue = queue.filter((item) => {
    if (statusFilter === 'AGUARDANDO') return item.status === 'AGUARDANDO_APROVACAO'
    if (statusFilter === 'APROVADO')
      return item.status === 'APROVADO' || item.status === 'ESGOTAMENTO_ESPERA'
    if (statusFilter === 'ENVIADO') return item.status === 'ENVIADO'
    if (statusFilter === 'REJEITADO') return item.status === 'REJEITADO'
    return true
  })

  const handlePrepareDaily = async (campId?: string) => {
    setPreparing(true)
    try {
      const res = await prepareCampaignDaily(campId)
      if (res.success) {
        toast({
          title: 'Rotina de preparação concluída!',
          description: `${res.prepared_count} novo(s) e-mail(s) redigidos e colocados na fila de aprovação. (${res.skipped_count} já contatados ou em espera).`,
        })
        onRefresh()
      } else {
        toast({
          title: 'Aviso',
          description: res.message,
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao preparar fila',
        description: err?.message || 'Falha ao executar rotina.',
        variant: 'destructive',
      })
    } finally {
      setPreparing(false)
    }
  }

  const handleApprove = async (item: CampaignQueueItem) => {
    try {
      await approveQueueItem(item.id)
      toast({ title: 'E-mail aprovado para disparo!' })
      if (selectedItem?.id === item.id) {
        setSelectedItem(null)
      }
      onRefresh()
    } catch (err: any) {
      toast({ title: 'Erro ao aprovar', description: err.message, variant: 'destructive' })
    }
  }

  const handleReject = async (item: CampaignQueueItem) => {
    try {
      await rejectQueueItem(item.id)
      toast({ title: 'E-mail rejeitado.', description: 'Não será enviado ao cliente.' })
      if (selectedItem?.id === item.id) {
        setSelectedItem(null)
      }
      onRefresh()
    } catch (err: any) {
      toast({ title: 'Erro ao rejeitar', description: err.message, variant: 'destructive' })
    }
  }

  const handleApproveAll = async () => {
    if (aguardandoAprovacao.length === 0) return
    setApprovingAll(true)
    try {
      const ids = aguardandoAprovacao.map((q) => q.id)
      const count = await approveAllQueueItems(ids)
      toast({
        title: 'Lote aprovado com sucesso!',
        description: `${count} e-mail(s) aprovado(s) e prontos para o disparo respeitando o teto de envio.`,
      })
      onRefresh()
    } catch (err: any) {
      toast({
        title: 'Erro na aprovação em lote',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setApprovingAll(false)
    }
  }

  const handleDispatchQueue = async () => {
    setDispatching(true)
    try {
      const res = await dispatchCampaignQueue(100)
      if (res.success) {
        toast({
          title: 'Disparo executado com sucesso!',
          description: res.message,
        })
        onRefresh()
      } else {
        toast({
          title: 'Disparo não realizado',
          description: res.message,
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao disparar fila',
        description: err?.message || 'Falha ao enviar.',
        variant: 'destructive',
      })
    } finally {
      setDispatching(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* BARRA SUPERIOR: Painel de Controle de Tetos (100/dia e 3.000/mês) e Fila de Esgotamento */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50/40 border-blue-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-900">Teto Diário</span>
              <Badge variant="outline" className="text-[10px] bg-white text-blue-700">
                100/dia
              </Badge>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{dailySentCount}</span>
              <span className="text-xs text-slate-500">/ 100 enviados hoje</span>
            </div>
            <div className="w-full bg-blue-200/50 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${dailyPercent >= 90 ? 'bg-amber-500' : 'bg-blue-600'}`}
                style={{ width: `${dailyPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1">
              <span>Restante hoje:</span>
              <strong className="text-blue-700">{Math.max(0, dailyCap - dailySentCount)}</strong>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-50 to-emerald-50/40 border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">Teto Mensal</span>
              <Badge
                variant="outline"
                className={`text-[10px] bg-white ${isNearMonthlyCap ? 'text-amber-700 border-amber-300' : 'text-emerald-700'}`}
              >
                3.000/mês
              </Badge>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{monthlySentCount}</span>
              <span className="text-xs text-slate-500">/ 3.000 este mês</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${isNearMonthlyCap ? 'bg-amber-500' : 'bg-emerald-600'}`}
                style={{ width: `${monthlyPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-600 mt-1.5">
              {isNearMonthlyCap ? (
                <span className="text-amber-600 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Atenção: próximo ao teto mensal
                </span>
              ) : (
                <span>Controle anti-bloqueio ativo e saudável</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50/40 border-amber-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-900">Fila de Aprovação</span>
              <Badge className="bg-amber-500 text-white text-[10px]">
                {aguardandoAprovacao.length} pendente(s)
              </Badge>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-950">
                {aguardandoAprovacao.length}
              </span>
              <span className="text-xs text-slate-500">prontos para revisão</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-2">
              IA redige com dados reais; você aprova com 1 clique.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50/40 border-purple-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-900">Fila de Esgotamento</span>
              <Badge variant="outline" className="bg-white text-purple-700 text-[10px]">
                Prioridade Máxima
              </Badge>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-purple-950">
                {emEsperaEsgotamento.length}
              </span>
              <span className="text-xs text-slate-500">em espera p/ amanhã</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-2">
              Ninguém fica de fora: quem exceder 100 hoje vai primeiro amanhã.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AÇÕES DA ROTINA E FILA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-slate-50 border rounded-xl">
        <div className="space-y-0.5">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Automação de E-mail Marketing e Vendas (Agente Skip Cloud + Rotina Diária)
          </h2>
          <p className="text-xs text-slate-500">
            Ciclo estruturado (Educativo → Oferta Cross-sell) com intervalo inteligente para não
            repetir mensagens e não incomodar clientes recentes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePrepareDaily()}
            disabled={preparing}
            className="text-xs bg-white hover:bg-slate-50"
          >
            {preparing ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            )}
            Preparar Fila Diária Agora
          </Button>

          {aguardandoAprovacao.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleApproveAll}
              disabled={approvingAll}
              className="text-xs bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
            >
              {approvingAll ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              )}
              Aprovar Todos ({aguardandoAprovacao.length})
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleDispatchQueue}
            disabled={dispatching || aprovadosParaDisparo.length === 0}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            {dispatching ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 mr-1.5" />
            )}
            Disparar Fila Aprovada ({aprovadosParaDisparo.length})
          </Button>
        </div>
      </div>

      {/* NAVEGAÇÃO DE SUB-ABAS */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setSubTab('fila')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            subTab === 'fila'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Fila de Aprovação e Envio ({queue.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('campanhas')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            subTab === 'campanhas'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Campanhas e Públicos ({campaigns.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('banco')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            subTab === 'banco'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Banco de Mensagens e Ofertas ({BANCO_MENSAGENS_EDUCATIVAS_E_OFERTAS.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('historico')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            subTab === 'historico'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Histórico e Registro ({logs.length})
        </button>
      </div>

      {/* SUB-ABA 1: FILA DE APROVAÇÃO */}
      {subTab === 'fila' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-500 mr-1">Filtrar status:</span>
              <Button
                variant={statusFilter === 'todos' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setStatusFilter('todos')}
              >
                Todos ({queue.length})
              </Button>
              <Button
                variant={statusFilter === 'AGUARDANDO' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setStatusFilter('AGUARDANDO')}
              >
                Aguardando ({aguardandoAprovacao.length})
              </Button>
              <Button
                variant={statusFilter === 'APROVADO' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setStatusFilter('APROVADO')}
              >
                Aprovados/Espera ({aprovadosParaDisparo.length})
              </Button>
              <Button
                variant={statusFilter === 'ENVIADO' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setStatusFilter('ENVIADO')}
              >
                Enviados
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              Modo Fila de Aprovação (semiautomático): você tem controle total antes do disparo
              definitivo.
            </p>
          </div>

          <Card className="shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="p-3">Destinatário</th>
                    <th className="p-3">Campanha & Ciclo</th>
                    <th className="p-3">Assunto Redigido</th>
                    <th className="p-3">Tipo & Dados</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQueue.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-8 text-slate-500">
                        <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        Nenhum e-mail nesta etapa da fila.{' '}
                        <button
                          type="button"
                          onClick={() => handlePrepareDaily()}
                          className="text-blue-600 underline font-medium"
                        >
                          Clique aqui para rodar a rotina de preparação
                        </button>
                        .
                      </td>
                    </tr>
                  ) : (
                    filteredQueue.map((item) => {
                      const isWaiting = item.status === 'AGUARDANDO_APROVACAO'
                      const isApproved = item.status === 'APROVADO'
                      const isOverflow = item.status === 'ESGOTAMENTO_ESPERA'
                      const isSent = item.status === 'ENVIADO'
                      const clientName =
                        item.expand?.client?.name || item.dados_cliente_snapshot?.nome || 'Cliente'
                      const clientEmail =
                        item.expand?.client?.email || item.dados_cliente_snapshot?.email || ''

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50 ${isWaiting ? 'bg-amber-50/20' : ''}`}
                        >
                          <td className="p-3">
                            <p className="font-semibold text-slate-900">{clientName}</p>
                            <p className="text-[11px] text-slate-500">{clientEmail}</p>
                          </td>
                          <td className="p-3">
                            <p className="font-medium text-slate-800">
                              {item.expand?.campanha?.nome || 'Campanha'}
                            </p>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <span className="capitalize">{item.tipo_mensagem}</span> • Passo{' '}
                              {item.passo_ordem}
                            </p>
                          </td>
                          <td className="p-3 max-w-xs">
                            <p className="font-medium text-slate-900 truncate" title={item.assunto}>
                              {item.assunto}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate" title={item.corpo}>
                              {item.corpo}
                            </p>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.tipo_mensagem === 'oferta' ? (
                                <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px]">
                                  Cross-sell
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">
                                  Educativo
                                </Badge>
                              )}
                              {item.redigido_por_ia && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] bg-slate-50 text-slate-600 flex items-center gap-0.5"
                                >
                                  <Sparkles className="w-2.5 h-2.5 text-blue-500" /> IA
                                </Badge>
                              )}
                            </div>
                            {item.dados_cliente_snapshot?.veiculo && (
                              <p className="text-[10px] text-slate-500 mt-1">
                                🚗 {item.dados_cliente_snapshot.veiculo}
                              </p>
                            )}
                          </td>
                          <td className="p-3">
                            {isWaiting && (
                              <Badge className="bg-amber-500 text-white text-[10px]">
                                Aguardando Aprovação
                              </Badge>
                            )}
                            {isApproved && (
                              <Badge className="bg-emerald-600 text-white text-[10px]">
                                Aprovado (Pronto)
                              </Badge>
                            )}
                            {isOverflow && (
                              <Badge className="bg-purple-600 text-white text-[10px]">
                                Fila de Espera (Amanhã)
                              </Badge>
                            )}
                            {isSent && (
                              <Badge className="bg-slate-400 text-white text-[10px]">
                                Enviado em {formatDateDisplay(item.data_envio || '')}
                              </Badge>
                            )}
                            {item.status === 'REJEITADO' && (
                              <Badge variant="outline" className="text-red-600 border-red-200">
                                Rejeitado
                              </Badge>
                            )}
                            {item.status === 'FALHOU' && (
                              <Badge variant="destructive">Falhou</Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-blue-600 hover:text-blue-700"
                                onClick={() => setSelectedItem(item)}
                                title="Visualizar mensagem completa"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                              </Button>

                              {isWaiting && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-emerald-600 hover:bg-emerald-50"
                                    onClick={() => handleApprove(item)}
                                    title="Aprovar com 1 clique"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Aprovar
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-red-600 hover:bg-red-50"
                                    onClick={() => handleReject(item)}
                                    title="Rejeitar envio"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* SUB-ABA 2: CAMPANHAS E PÚBLICOS */}
      {subTab === 'campanhas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Campanhas Ativas e Ciclos de Nutrição
              </h3>
              <p className="text-xs text-slate-500">
                Filtros inteligentes salvos conectando diretamente a base real de clientes e
                apólices.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((camp) => {
              const passos = camp.ciclo_passos || []
              return (
                <Card key={camp.id} className="shadow-sm border hover:border-blue-200 transition">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge
                        className={
                          camp.ativo ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                        }
                      >
                        {camp.ativo ? 'Ativa' : 'Pausada'}
                      </Badge>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                        <Calendar className="w-3 h-3" /> A cada {camp.frequencia_dias} dias
                      </span>
                    </div>
                    <CardTitle className="text-sm font-bold mt-2 text-slate-900">
                      {camp.nome}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <p className="text-slate-600 text-[11px] line-clamp-2">{camp.descricao}</p>

                    <div className="p-2.5 bg-slate-50 rounded-lg border space-y-1">
                      <p className="font-semibold text-slate-800 flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-blue-600" />
                        Público:{' '}
                        <span className="font-normal text-slate-700">
                          {camp.tipo_publico === 'MONO_AUTO'
                            ? 'Clientes Monoproduto Auto (sem Residencial)'
                            : camp.tipo_publico === 'RENOVACOES_PROXIMAS'
                              ? 'Renovações Próximas (próx. 45 dias)'
                              : camp.tipo_publico === 'ENDOSSOS_RECENTES'
                                ? 'Endossos Recentes'
                                : camp.tipo_publico === 'SEM_APOLICE_ATIVA'
                                  ? 'Clientes Inativos / Sem Apólice Ativa'
                                  : 'Geral da Carteira'}
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Ciclo: {passos.length} passos alternados (Educativo & Ofertas)
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <p className="font-semibold text-[11px] text-slate-700">
                        Sequência do Ciclo:
                      </p>
                      {passos.map((p, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-1.5 text-[11px] text-slate-600 pl-1"
                        >
                          <ChevronRight className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-slate-800">
                              Passo {p.ordem || idx + 1} ({p.tipo}):
                            </span>{' '}
                            {p.tema}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between text-[11px] text-slate-500">
                      <span>Total enviados: {camp.total_enviados || 0}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => handlePrepareDaily(camp.id)}
                        disabled={preparing}
                      >
                        Preparar esta
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* SUB-ABA 3: BANCO DE MENSAGENS EDUCATIVAS & OFERTAS */}
      {subTab === 'banco' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Banco de Mensagens Educativas & Ofertas de Cross-Sell
            </h3>
            <p className="text-xs text-slate-500">
              Conteúdos pré-formatados que o agente Skip Cloud utiliza como base de conhecimento e
              personaliza com os dados reais de cada segurado.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {BANCO_MENSAGENS_EDUCATIVAS_E_OFERTAS.map((item) => (
              <Card key={item.id} className="shadow-sm border">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      className={
                        item.tipo === 'oferta'
                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                          : 'bg-blue-100 text-blue-800 border-blue-200'
                      }
                    >
                      {item.tipo === 'oferta' ? 'Oferta Cross-sell' : 'Educativo'}
                    </Badge>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Ramo: {item.ramo}
                    </span>
                  </div>
                  <CardTitle className="text-xs font-bold text-slate-900 mt-2">
                    {item.tema}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <p className="text-[11px] text-slate-600">
                    <strong>Objetivo:</strong> {item.objetivo}
                  </p>
                  <div className="p-2.5 bg-slate-50 rounded border">
                    <p className="text-[10px] font-semibold text-slate-700">Sugestão de Assunto:</p>
                    <p className="text-[11px] text-blue-700 font-medium mt-0.5 truncate">
                      {item.sugestaoAssunto}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-700 mt-2">
                      Corpo de Referência:
                    </p>
                    <p className="text-[10px] text-slate-600 line-clamp-3 whitespace-pre-line mt-0.5">
                      {item.sugestaoCorpo}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* SUB-ABA 4: HISTÓRICO E REGISTRO */}
      {subTab === 'historico' && (
        <Card className="shadow-sm border overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm font-bold">
              Registro Auditado de Envios por Campanha
            </CardTitle>
            <p className="text-xs text-slate-500">
              Garante que nenhum cliente receba mensagens repetidas fora do intervalo planejado.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="p-2.5">Data de Envio</th>
                    <th className="p-2.5">Cliente</th>
                    <th className="p-2.5">Campanha</th>
                    <th className="p-2.5">Passo & Tipo</th>
                    <th className="p-2.5">Assunto Enviado</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-6 text-slate-500">
                        Nenhum envio registrado até o momento.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-2.5">{formatDateDisplay(log.data_envio)}</td>
                        <td className="p-2.5 font-medium">
                          {log.expand?.client?.name || log.client}
                        </td>
                        <td className="p-2.5">{log.expand?.campanha?.nome || log.campanha}</td>
                        <td className="p-2.5">
                          Passo {log.passo_ordem} ({log.tipo_mensagem})
                        </td>
                        <td className="p-2.5 max-w-xs truncate" title={log.assunto}>
                          {log.assunto}
                        </td>
                        <td className="p-2.5">
                          <Badge
                            className={
                              log.status_envio === 'ENVIADO'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-red-600 text-white'
                            }
                          >
                            {log.status_envio}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL DE VISUALIZAÇÃO E APROVAÇÃO INDIVIDUAL */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base">
              <span>Detalhes do E-mail na Fila</span>
              {selectedItem?.redigido_por_ia && (
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 text-xs flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-blue-600" /> Redigido pelo Agente Skip Cloud
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-3 py-2 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded border">
                <div>
                  <span className="text-slate-500">Destinatário:</span>
                  <p className="font-semibold text-slate-900">
                    {selectedItem.expand?.client?.name || selectedItem.dados_cliente_snapshot?.nome}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {selectedItem.expand?.client?.email ||
                      selectedItem.dados_cliente_snapshot?.email}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Campanha & Etapa:</span>
                  <p className="font-semibold text-slate-900">
                    {selectedItem.expand?.campanha?.nome}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Passo {selectedItem.passo_ordem} • {selectedItem.tipo_mensagem}
                  </p>
                </div>
              </div>

              {selectedItem.dados_cliente_snapshot && (
                <div className="p-2 bg-blue-50/50 rounded border border-blue-100 text-[11px] text-blue-900 space-y-0.5">
                  <span className="font-bold">Dados reais utilizados na personalização:</span>
                  <p>
                    Veículo:{' '}
                    <strong>{selectedItem.dados_cliente_snapshot.veiculo || 'Nenhum'}</strong> |
                    Possui Residencial:{' '}
                    <strong>
                      {selectedItem.dados_cliente_snapshot.possui_residencial ? 'Sim' : 'Não'}
                    </strong>{' '}
                    | Possui Vida:{' '}
                    <strong>
                      {selectedItem.dados_cliente_snapshot.possui_vida ? 'Sim' : 'Não'}
                    </strong>
                  </p>
                </div>
              )}

              <div>
                <span className="font-semibold text-slate-800">Assunto:</span>
                <p className="p-2 bg-white rounded border mt-1 text-slate-900 font-medium">
                  {selectedItem.assunto}
                </p>
              </div>

              <div>
                <span className="font-semibold text-slate-800">Corpo da Mensagem:</span>
                <div className="p-3 bg-white rounded border mt-1 text-slate-800 whitespace-pre-line max-h-60 overflow-y-auto leading-relaxed">
                  {selectedItem.corpo}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            <Button variant="outline" size="sm" onClick={() => setSelectedItem(null)}>
              Fechar
            </Button>
            {selectedItem?.status === 'AGUARDANDO_APROVACAO' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => selectedItem && handleReject(selectedItem)}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  size="sm"
                  onClick={() => selectedItem && handleApprove(selectedItem)}
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Aprovar Agora
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
