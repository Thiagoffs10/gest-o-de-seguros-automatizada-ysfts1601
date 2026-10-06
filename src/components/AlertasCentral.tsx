import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Archive,
} from 'lucide-react'
import {
  SistemaAlerta,
  getSistemaAlertas,
  resolverSistemaAlerta,
} from '@/services/importacao/sistema-alertas'
import { getRecebimentosLegados } from '@/services/importacao/recebimentos-legados'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { PendenciaComissao60Item, PendenciasComissao60Result } from '@/lib/financial-calcs'
import { Clock, ArrowDownCircle, ChevronDown, ChevronUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Policy } from '@/types'

interface AlertasCentralProps {
  modulo?: 'FINANCEIRO' | 'APOLICES' | 'CLIENTES' | 'EXTRATO'
  onVerApolice?: (policyId: string) => void
  pendencias60?: PendenciasComissao60Result
  onRegistrarRecebimento?: (
    policy: Policy,
    competencia?: string,
    prevId?: string,
    saldo?: number,
  ) => void
}

export const AlertasCentral: React.FC<AlertasCentralProps> = ({
  modulo,
  onVerApolice,
  pendencias60,
  onRegistrarRecebimento,
}) => {
  const [alertas, setAlertas] = useState<SistemaAlerta[]>([])
  const [loading, setLoading] = useState(false)
  const [legadosInfo, setLegadosInfo] = useState<{ count: number; totalLiquido: number } | null>(
    null,
  )
  const [modalLista60Open, setModalLista60Open] = useState(false)
  const { toast } = useToast()

  const carregarAlertas = async () => {
    setLoading(true)
    try {
      const filter = modulo ? `modulo = "${modulo}" && resolvido = false` : 'resolvido = false'
      const promises: [Promise<SistemaAlerta[]>, Promise<any[]>?] = [getSistemaAlertas(filter)]

      if (modulo === 'FINANCEIRO' || !modulo) {
        promises.push(getRecebimentosLegados())
      }

      const [dataAlertas, dataLegados] = await Promise.all(promises)
      setAlertas(dataAlertas)

      if (dataLegados) {
        const count = dataLegados.length
        const totalLiquido =
          Math.round(
            dataLegados.reduce((sum, r) => sum + (Number(r.valor_liquido) || 0), 0) * 100,
          ) / 100
        setLegadosInfo({ count, totalLiquido })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarAlertas()
  }, [modulo])

  const handleResolver = async (alerta: SistemaAlerta) => {
    const ok = await resolverSistemaAlerta(alerta.id)
    if (ok) {
      toast({
        title: 'Alerta resolvido',
        description: 'O alerta foi marcado como resolvido.',
      })
      setAlertas((prev) => prev.filter((a) => a.id !== alerta.id))
    }
  }

  const hasAlertas = alertas.length > 0
  const hasLegados = Boolean(legadosInfo && legadosInfo.count > 0)
  const hasPendencias60 = Boolean(pendencias60 && pendencias60.countApolices > 0)

  if (!hasAlertas && !hasLegados && !hasPendencias60 && !loading) {
    return null
  }

  return (
    <div className="space-y-3 mb-6">
      {/* BANNER DE ALERTA: COMISSÕES SEM BAIXA HÁ MAIS DE 60 DIAS */}
      {hasPendencias60 && pendencias60 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-lg border border-rose-300 dark:border-rose-900/60 bg-rose-50/90 dark:bg-rose-950/30 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-md shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-rose-950 dark:text-rose-100 text-sm">
                  R$ {formatCurrency(pendencias60.totalValorPendente)} em comissões sem baixa há
                  mais de 60 dias
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-rose-400 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 font-semibold"
                >
                  {pendencias60.countApolices}{' '}
                  {pendencias60.countApolices === 1 ? 'apólice' : 'apólices'}
                </Badge>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                Valores pendentes com mais de 60 dias corridos desde a competência/início de
                vigência.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Button
              size="sm"
              variant="default"
              onClick={() => setModalLista60Open(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-8 px-3 shadow-xs font-medium"
            >
              Ver lista ({pendencias60.countApolices})
            </Button>
          </div>
        </div>
      )}

      {/* MODAL DE LISTAGEM DAS APÓLICES COM PENDÊNCIA 60+ DIAS */}
      {hasPendencias60 && pendencias60 && (
        <Dialog open={modalLista60Open} onOpenChange={setModalLista60Open}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-5 pb-3 border-b">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-100 text-rose-700 rounded-md">
                  <Clock className="h-4 w-4" />
                </div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Comissões sem Baixa há mais de 60 Dias
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                Total acumulado de{' '}
                <strong className="text-rose-700">
                  R$ {formatCurrency(pendencias60.totalValorPendente)}
                </strong>{' '}
                em <strong>{pendencias60.countApolices}</strong>{' '}
                {pendencias60.countApolices === 1 ? 'apólice pendente' : 'apólices pendentes'}.
                Ordenadas da mais antiga para a mais recente.
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-y-auto flex-1 p-5 pt-3">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="p-2.5">Cliente / Apólice</th>
                    <th className="p-2.5">Seguradora</th>
                    <th className="p-2.5 text-center">Ref. Base</th>
                    <th className="p-2.5 text-center">Dias Parados</th>
                    <th className="p-2.5 text-right">Valor Pendente</th>
                    <th className="p-2.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendencias60.itens.map((item) => {
                    const clientName =
                      item.policy.expand?.client?.name || 'Cliente não identificado'
                    const segNome =
                      item.policy.expand?.seguradora?.nome || item.policy.insurance_company || '-'
                    const docNumber =
                      item.policy.numero_proposta || item.policy.policy_number || '-'

                    return (
                      <tr key={item.policy.id} className="hover:bg-slate-50/80">
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-900">{clientName}</div>
                          <div className="text-[11px] text-slate-500">Doc: {docNumber}</div>
                        </td>
                        <td className="p-2.5 font-medium">{segNome}</td>
                        <td className="p-2.5 text-center">
                          {item.competenciaSugerida ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-blue-200 bg-blue-50/60 text-blue-700"
                            >
                              Comp. {item.competenciaSugerida}
                            </Badge>
                          ) : item.origemReferencia === 'start_date' ? (
                            <span className="text-[11px] text-slate-600">
                              Vigência {item.dataReferencia}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-600">
                              Cadastro {item.dataReferencia}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <Badge
                            className={`text-[10px] font-bold ${
                              item.diasParados > 90
                                ? 'bg-rose-600 text-white'
                                : 'bg-amber-500 text-white'
                            }`}
                          >
                            {item.diasParados} dias
                          </Badge>
                        </td>
                        <td className="p-2.5 text-right font-bold text-rose-700">
                          R$ {formatCurrency(item.saldoPendente)}
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {onRegistrarRecebimento && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2 shadow-xs"
                                onClick={() => {
                                  setModalLista60Open(false)
                                  onRegistrarRecebimento(
                                    item.policy,
                                    item.competenciaSugerida,
                                    item.comissaoPrevistaId,
                                    item.saldoPendente,
                                  )
                                }}
                              >
                                <ArrowDownCircle className="w-3.5 h-3.5 mr-1" />
                                Baixar
                              </Button>
                            )}
                            {onVerApolice && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2"
                                onClick={() => {
                                  setModalLista60Open(false)
                                  onVerApolice(item.policy.id)
                                }}
                              >
                                Ver
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Resumo Enxuto de Recebimentos Legados (Importação Contábil sem Apólice) */}
      {hasLegados && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-md">
              <Archive className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-indigo-950 dark:text-indigo-200">
                  Recebimentos Legados Registrados
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-indigo-300 text-indigo-700 dark:text-indigo-300 font-medium"
                >
                  {legadosInfo?.count} {legadosInfo?.count === 1 ? 'lançamento' : 'lançamentos'}
                </Badge>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                Comissões de extratos anteriores sem apólice ativa no sistema, integradas à
                contabilidade financeira.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <span className="text-slate-500 text-[11px]">Soma líquido:</span>
            <span className="font-bold text-sm text-indigo-900 dark:text-indigo-100">
              R$ {formatCurrency(legadosInfo?.totalLiquido || 0)}
            </span>
          </div>
        </div>
      )}

      {/* Painel de Alertas de Inconsistência e Duplicidade */}
      {hasAlertas && (
        <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Alertas de Inconsistência e Duplicidade ({alertas.length})
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={carregarAlertas}
              disabled={loading}
              className="h-8 px-2 text-xs text-amber-800 hover:text-amber-950 dark:text-amber-300"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0 space-y-2">
            {alertas.map((alerta) => (
              <div
                key={alerta.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-md bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-900/40 text-xs shadow-sm"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {alerta.titulo}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1 py-0 border-amber-300 text-amber-700 dark:text-amber-300"
                      >
                        {alerta.tipo.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">{alerta.motivo}</p>
                    {alerta.acao_sugerida && (
                      <p className="text-slate-500 dark:text-slate-400 italic text-[11px] mt-0.5">
                        Sugestão: {alerta.acao_sugerida}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  {alerta.referencia_id && onVerApolice && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onVerApolice(alerta.referencia_id!)}
                      className="h-7 text-xs px-2"
                    >
                      Ver apólice
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleResolver(alerta)}
                    className="h-7 text-xs text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 px-2"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Dispensar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
