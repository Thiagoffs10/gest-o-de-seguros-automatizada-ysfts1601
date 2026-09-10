import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  ArrowRight,
  Home,
  Layers,
  UserX,
  RotateCcw,
  Clock,
  Mail,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { Client, Policy, TipoSeguro } from '@/types'
import {
  computePortfolioOpportunities,
  CrossSellOpportunity,
  CrossSellType,
} from '@/services/cross-sell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface Props {
  clients: Client[]
  policies: Policy[]
  tiposSeguro?: TipoSeguro[]
}

export function PortfolioOpportunitiesCard({ clients, policies, tiposSeguro = [] }: Props) {
  const navigate = useNavigate()
  const [selectedGroup, setSelectedGroup] = useState<{
    title: string
    description: string
    type: CrossSellType | 'all'
    items: CrossSellOpportunity[]
  } | null>(null)

  const summary = useMemo(() => {
    return computePortfolioOpportunities(clients, policies, tiposSeguro)
  }, [clients, policies, tiposSeguro])

  const openGroupModal = (
    title: string,
    description: string,
    type: CrossSellType | 'all',
    items: CrossSellOpportunity[],
  ) => {
    setSelectedGroup({ title, description, type, items })
  }

  const handleGoToClient = (clientId: string) => {
    setSelectedGroup(null)
    navigate(`/clientes/${clientId}`)
  }

  const handleSendEmail = (opp: CrossSellOpportunity) => {
    setSelectedGroup(null)
    let subject = `Oportunidade Especial CRED10MIX - ${opp.product}`
    let body = `Olá, ${opp.clientName}!\n\nIdentificamos uma excelente oportunidade de proteção para você em ${opp.product}.\n\nEntre em contato conosco para conhecer as condições exclusivas que preparamos para você.\n\nAtenciosamente,\nEquipe CRED10MIX`

    if (opp.type === 'renovacao_proxima') {
      subject = `Lembrete de Renovação CRED10MIX - Apólice ${opp.matchedPolicyNumber || ''}`
      body = `Olá, ${opp.clientName}!\n\nSua apólice está próxima da renovação. Vamos garantir a continuidade da sua proteção?\n\nAtenciosamente,\nEquipe CRED10MIX`
    } else if (opp.type === 'auto_without_residencial') {
      subject = `Proteja seu lar com desconto especial - CRED10MIX Residencial`
      body = `Olá, ${opp.clientName}!\n\nVocê já é nosso cliente de Seguro Auto e pode proteger também sua residência com condições e descontos imperdíveis.\n\nPodemos fazer uma rápida cotação?\n\nAtenciosamente,\nEquipe CRED10MIX`
    }

    navigate(
      `/comunicacao?clientId=${encodeURIComponent(opp.clientId)}&canal=Email&assunto=${encodeURIComponent(
        subject,
      )}&corpo=${encodeURIComponent(body)}`,
    )
  }

  return (
    <>
      <Card className="shadow-sm border-blue-200 bg-gradient-to-br from-white via-white to-blue-50/30">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Oportunidades da Carteira
              </CardTitle>
              <p className="text-xs text-slate-500">
                Inteligência de cross-sell e retenção calculada em runtime sobre os segurados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 font-bold">
              {summary.allOpportunities.length} oportunidade(s)
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-blue-600 hover:text-blue-800 h-8"
              onClick={() =>
                openGroupModal(
                  'Todas as Oportunidades da Carteira',
                  'Lista completa de clientes com oportunidades ativas de cross-sell e retenção.',
                  'all',
                  summary.allOpportunities,
                )
              }
            >
              Ver todas <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Auto sem Residencial */}
            <div
              onClick={() =>
                openGroupModal(
                  'Possui Auto, sem Residencial',
                  'Clientes com apólice de Automóvel ativa que ainda não contrataram proteção Residencial.',
                  'auto_without_residencial',
                  summary.autoWithoutResidencial,
                )
              }
              className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-blue-400 hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-md">
                  <Home className="w-4 h-4" />
                </div>
                <span className="text-xl font-bold text-blue-700">
                  {summary.autoWithoutResidencial.length}
                </span>
              </div>
              <div className="mt-2">
                <p className="text-xs font-bold text-slate-800">Auto s/ Residencial</p>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                  Vender Residencial para segurados Auto
                </p>
              </div>
            </div>

            {/* Mono-produto */}
            <div
              onClick={() =>
                openGroupModal(
                  'Clientes Mono-produto',
                  'Clientes que possuem apenas 1 ramo de seguro ativo. Ideal para diversificação e fidelização.',
                  'mono_produto',
                  summary.monoProduto,
                )
              }
              className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-purple-400 hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-md">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="text-xl font-bold text-purple-700">
                  {summary.monoProduto.length}
                </span>
              </div>
              <div className="mt-2">
                <p className="text-xs font-bold text-slate-800">Clientes Mono-produto</p>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                  Apenas 1 produto ativo na corretora
                </p>
              </div>
            </div>

            {/* Sem apólice ativa */}
            <div
              onClick={() =>
                openGroupModal(
                  'Reativação de Clientes',
                  'Clientes cadastrados sem nenhuma apólice ativa atualmente. Excelente público para reativação.',
                  'sem_apolice_ativa',
                  summary.semApoliceAtiva,
                )
              }
              className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-md">
                  <UserX className="w-4 h-4" />
                </div>
                <span className="text-xl font-bold text-amber-700">
                  {summary.semApoliceAtiva.length}
                </span>
              </div>
              <div className="mt-2">
                <p className="text-xs font-bold text-slate-800">Sem Apólice Ativa</p>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                  Reativar segurados sem vigência
                </p>
              </div>
            </div>

            {/* Recuperação / Canceladas */}
            <div
              onClick={() =>
                openGroupModal(
                  'Recuperação de Apólices',
                  'Clientes que tiveram apólices canceladas ou vencidas sem renovação registrada.',
                  'recuperacao_cancelada',
                  summary.recuperacaoCancelada,
                )
              }
              className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-rose-400 hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-md">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <span className="text-xl font-bold text-rose-700">
                  {summary.recuperacaoCancelada.length}
                </span>
              </div>
              <div className="mt-2">
                <p className="text-xs font-bold text-slate-800">Recuperação de Carteira</p>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                  Apólices canceladas ou não renovadas
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Drill-down de Clientes por Oportunidade */}
      <Dialog open={!!selectedGroup} onOpenChange={(open) => !open && setSelectedGroup(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
              <DialogTitle className="text-base font-bold text-slate-900">
                {selectedGroup?.title} ({selectedGroup?.items.length || 0})
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              {selectedGroup?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2 mt-2">
            {!selectedGroup || selectedGroup.items.length === 0 ? (
              <p className="text-center py-10 text-xs text-slate-500">
                Nenhum cliente encontrado neste critério no momento.
              </p>
            ) : (
              selectedGroup.items.map((opp) => (
                <div
                  key={opp.id}
                  className="p-3 rounded-lg border bg-slate-50 hover:bg-blue-50/40 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-slate-900 text-sm font-bold truncate">
                        {opp.clientName}
                      </strong>
                      <Badge variant="outline" className="text-[10px] bg-white text-blue-700">
                        {opp.product}
                      </Badge>
                    </div>
                    <p className="text-slate-600">
                      <strong>Motivo:</strong> {opp.reason}
                    </p>
                    <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                      {opp.clientEmail && <span>E-mail: {opp.clientEmail}</span>}
                      {opp.clientPhone && <span>Tel: {opp.clientPhone}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 text-blue-700 border-blue-200 hover:bg-blue-50"
                      onClick={() => handleSendEmail(opp)}
                    >
                      <Mail className="w-3.5 h-3.5 mr-1" /> Enviar E-mail
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-7 bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleGoToClient(opp.clientId)}
                    >
                      Abrir Ficha 360º →
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
