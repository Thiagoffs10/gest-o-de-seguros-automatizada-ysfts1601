import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { Client, Policy, TipoSeguro } from '@/types'
import {
  evaluateClientCrossSell,
  CrossSellOpportunity,
  normalizeProduct,
} from '@/services/cross-sell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Props {
  client: Client
  policies: Policy[]
  tiposSeguro?: TipoSeguro[]
  onOpenNewPolicy?: (initialTipo?: string) => void
}

export function ClientOpportunitiesCard({
  client,
  policies,
  tiposSeguro = [],
  onOpenNewPolicy,
}: Props) {
  const navigate = useNavigate()
  const opportunities = useMemo(() => {
    return evaluateClientCrossSell(client, policies, tiposSeguro)
  }, [client, policies, tiposSeguro])

  const ownedProducts = useMemo(() => {
    const prods = new Set<string>()
    policies.forEach((p) => {
      const nom = normalizeProduct(p.tipo_de_seguro || p.coverage_type || 'Outros')
      prods.add(nom)
    })
    return Array.from(prods)
  }, [policies])

  const activeProducts = useMemo(() => {
    const prods = new Set<string>()
    policies
      .filter((p) => p.status === 'Ativa')
      .forEach((p) => {
        const nom = normalizeProduct(p.tipo_de_seguro || p.coverage_type || 'Outros')
        prods.add(nom)
      })
    return Array.from(prods)
  }, [policies])

  const handleSendEmailForOpp = (opp: CrossSellOpportunity) => {
    let subject = `Oportunidade CRED10MIX - ${opp.product}`
    let body = `Olá, ${client.name}!\n\nIdentificamos uma excelente oportunidade de proteção para você em ${opp.product}.\n\nEntre em contato conosco para conhecer as condições especiais que preparamos para o seu perfil.\n\nAtenciosamente,\nEquipe CRED10MIX`

    if (opp.type === 'renovacao_proxima') {
      subject = `Lembrete de Renovação CRED10MIX - Apólice ${opp.matchedPolicyNumber || ''}`
      body = `Olá, ${client.name}!\n\nSua apólice ${opp.matchedPolicyNumber ? `nº ${opp.matchedPolicyNumber}` : ''} está próxima da data de vencimento/renovação.\n\nPodemos emitir a melhor proposta para manter seu patrimônio protegido com condições exclusivas.\n\nAtenciosamente,\nEquipe CRED10MIX`
    } else if (opp.type === 'auto_without_residencial') {
      subject = `Proteção completa para seu lar - CRED10MIX Residencial`
      body = `Olá, ${client.name}!\n\nNotamos que você já conta com nossa proteção para seu veículo (Seguro Auto) e queremos oferecer a tranquilidade que sua casa merece com o Seguro Residencial CRED10MIX com desconto especial.\n\nVamos fazer uma simulação sem compromisso?\n\nAtenciosamente,\nEquipe CRED10MIX`
    } else if (opp.type === 'sem_apolice_ativa') {
      subject = `Que tal reativar sua proteção com a CRED10MIX?`
      body = `Olá, ${client.name}!\n\nSentimos sua falta! Estamos com novas coberturas e condições diferenciadas para seguros Auto, Residencial e Vida.\n\nPodemos atualizar sua cotação?\n\nAtenciosamente,\nEquipe CRED10MIX`
    }

    navigate(
      `/comunicacao?clientId=${encodeURIComponent(client.id)}&canal=Email&assunto=${encodeURIComponent(
        subject,
      )}&corpo=${encodeURIComponent(body)}`,
    )
  }

  const handleAction = (opp: CrossSellOpportunity) => {
    if (opp.type === 'auto_without_residencial') {
      if (onOpenNewPolicy) {
        onOpenNewPolicy('Residencial')
      } else {
        handleSendEmailForOpp(opp)
      }
    } else {
      handleSendEmailForOpp(opp)
    }
  }

  return (
    <Card className="shadow-sm border-blue-100 bg-gradient-to-br from-white to-blue-50/20">
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Oportunidades para este cliente
            </CardTitle>
            <p className="text-xs text-slate-500">
              Inteligência de carteira: Quem contatar, por que e qual produto oferecer.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            opportunities.length > 0
              ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold'
              : 'bg-emerald-50 text-emerald-700 border-emerald-300'
          }
        >
          {opportunities.length === 0
            ? 'Carteira Blindada'
            : `${opportunities.length} oportunidade${opportunities.length > 1 ? 's' : ''}`}
        </Badge>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Resumo de ramos que o cliente possui */}
        <div className="p-3 bg-white rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold text-slate-700">Ramos Ativos:</span>
            {activeProducts.length === 0 ? (
              <span className="text-slate-400 italic">Nenhum ramo ativo no momento</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {activeProducts.map((p) => (
                  <Badge
                    key={p}
                    className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold"
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {ownedProducts.length > activeProducts.length && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <span>Histórico geral de ramos:</span>
              <span className="font-medium text-slate-700">{ownedProducts.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Lista de oportunidades */}
        {opportunities.length === 0 ? (
          <div className="p-5 text-center bg-emerald-50/60 rounded-lg border border-emerald-200">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
            <p className="text-sm font-bold text-emerald-900">
              Cliente com perfil bem atendido e protegido!
            </p>
            <p className="text-xs text-emerald-700 max-w-md mx-auto mt-1">
              Todas as apólices estão em dia e diversificadas. Mantenha o contato cordial e
              comunicações de relacionamento regulares.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {opportunities.map((opp) => (
              <div
                key={opp.id}
                className="p-3.5 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition-colors shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900">{opp.title}</span>
                    <Badge
                      className={
                        opp.type === 'recuperacao_cancelada'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : opp.type === 'renovacao_proxima'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-blue-100 text-blue-800 border-blue-300'
                      }
                    >
                      {opp.product}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600">
                    <strong className="text-slate-800">Por que contatar: </strong>
                    {opp.reason}
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 text-blue-700 border-blue-200 hover:bg-blue-50 w-full sm:w-auto"
                    onClick={() => handleSendEmailForOpp(opp)}
                    title="Enviar e-mail para este cliente com proposta pré-configurada"
                  >
                    <Mail className="w-3.5 h-3.5 mr-1" /> Enviar E-mail
                  </Button>
                  {opp.type === 'auto_without_residencial' && onOpenNewPolicy && (
                    <Button
                      size="sm"
                      className="text-xs h-8 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                      onClick={() => onOpenNewPolicy('Residencial')}
                    >
                      + Criar Residencial
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
