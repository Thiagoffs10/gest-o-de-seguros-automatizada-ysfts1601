import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContaAReceberFechada } from '@/services/contas-a-receber-fechadas'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatIsoDate = (d?: string) => {
  if (!d) return '-'
  return d.split('T')[0].split(' ')[0].split('-').reverse().join('/')
}

interface Props {
  contas: ContaAReceberFechada[]
  loading?: boolean
  confirmingId?: string | null
  onConfirmar: (conta: ContaAReceberFechada) => void | Promise<void>
  /**
   * Se o card começa minimizado (exibindo apenas cabeçalho com título, badge, total e botão Expandir).
   * Padrão: true (minimizado) conforme solicitação do usuário.
   */
  defaultMinimizado?: boolean
  /**
   * Estado controlado opcional de minimização (true = minimizado / recolhido, false = aberto).
   */
  minimizado?: boolean
  /**
   * Callback quando o usuário clica no botão de minimizar / expandir o card.
   */
  onToggleMinimizado?: (novoMinimizado: boolean) => void
}

const LIMITE_INICIAL = 10

/**
 * Card "Contas a receber de competências fechadas" (Financeiro):
 * comissões pendentes de competências já fechadas na Conciliação Mensal.
 *
 * Requisitos do usuário:
 * 1. Por padrão fica MINIMIZADA: mostra apenas o cabeçalho (título, badge, valor total e botão Expandir/Recolher).
 *    Nenhum item da lista é exibido enquanto estiver minimizada.
 * 2. Ao expandir: exibe a lista com limite inicial de 10 itens e botão "Ver mais / Ver menos".
 * 3. Total do card continua sempre visível no cabeçalho.
 * 4. Apólices com baixa parcial recente mostram dias desde a última baixa e data da baixa.
 * 5. Suporta estado persistente ao trocar de abas.
 */
export function ContasAReceberFechadasCard({
  contas,
  loading,
  confirmingId,
  onConfirmar,
  defaultMinimizado = true,
  minimizado: minimizadoProp,
  onToggleMinimizado,
}: Props) {
  // Minimização do card inteiro (mostrar somente cabeçalho vs corpo visível)
  const [minimizadoInterno, setMinimizadoInterno] = useState(defaultMinimizado)
  const isMinimizado = minimizadoProp !== undefined ? minimizadoProp : minimizadoInterno

  const handleToggleCardMinimizado = () => {
    const nextVal = !isMinimizado
    if (minimizadoProp === undefined) {
      setMinimizadoInterno(nextVal)
    }
    onToggleMinimizado?.(nextVal)
  }

  // Paginação interna ("Ver mais / Ver menos" dentro da lista quando expandida além de 10 itens)
  const [expandido, setExpandido] = useState(false)
  const total = Math.round(contas.reduce((s, c) => s + c.valor, 0) * 100) / 100

  const itensExibidos = expandido ? contas : contas.slice(0, LIMITE_INICIAL)
  const temMais = contas.length > LIMITE_INICIAL

  return (
    <Card className="border-slate-200 shadow-sm transition-all">
      <CardHeader
        className="flex flex-row items-center justify-between pb-3 pt-3.5 px-4 space-y-0 cursor-pointer select-none hover:bg-slate-50/70 transition-colors rounded-t-lg"
        onClick={handleToggleCardMinimizado}
      >
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-bold text-slate-800">
            Contas a receber de competências fechadas
          </CardTitle>
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-800 border-amber-200 font-semibold text-xs"
          >
            {contas.length}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-amber-700">R$ {fmt(total)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation()
              handleToggleCardMinimizado()
            }}
            aria-expanded={!isMinimizado}
            title={isMinimizado ? 'Expandir lista' : 'Minimizar lista'}
          >
            <span>{isMinimizado ? 'Expandir' : 'Minimizar'}</span>
            {isMinimizado ? (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            )}
          </Button>
        </div>
      </CardHeader>

      {!isMinimizado && (
        <CardContent className="space-y-2 pt-0 px-4 pb-4 border-t border-slate-100 mt-1">
          <p className="text-xs text-slate-500">
            Comissões vencidas em aberto de meses já fechados na Conciliação. Ao confirmar o
            recebimento, o valor entra no <strong>caixa do mês da baixa</strong> (o lucro previsto
            do mês fechado não muda).
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando pendências...
            </div>
          ) : contas.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Nenhuma pendência de competências fechadas.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="divide-y divide-slate-100 rounded-md border border-slate-100">
                {itensExibidos.map((c) => {
                  const comBaixaRecente =
                    c.origemDias === 'ultimo_recebimento' && Boolean(c.ultimoRecebimento)

                  return (
                    <div
                      key={`${c.policyId}-${c.comissaoPrevistaId ?? 'avulsa'}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 hover:bg-amber-50/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800 truncate">
                            {c.policyNumber}
                          </span>
                          <span className="text-sm text-slate-600 truncate">{c.segurado}</span>
                          <Badge
                            variant="outline"
                            className="text-[11px] text-slate-500 border-slate-300"
                          >
                            {c.seguradora}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[11px] border-blue-200 bg-blue-50 text-blue-700"
                          >
                            Competência {c.competencia}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 mt-0.5 flex-wrap">
                          {comBaixaRecente ? (
                            <>
                              <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                              <span className="text-blue-700 font-medium">
                                {c.diasVencidos > 0
                                  ? `Sem baixa há ${c.diasVencidos} dia(s)`
                                  : 'Baixa recente hoje'}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-600">
                                última baixa em {formatIsoDate(c.ultimoRecebimento)}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-400 text-[11px]">
                                venc. original {formatIsoDate(c.vencimento)}
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>
                                {c.diasVencidos > 0
                                  ? `Vencida há ${c.diasVencidos} dia(s)`
                                  : 'Vence hoje'}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-500">{formatIsoDate(c.vencimento)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-bold text-slate-900">R$ {fmt(c.valor)}</span>
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={
                            confirmingId === `${c.policyId}-${c.comissaoPrevistaId ?? 'avulsa'}`
                          }
                          onClick={() => onConfirmar(c)}
                        >
                          {confirmingId === `${c.policyId}-${c.comissaoPrevistaId ?? 'avulsa'}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          )}
                          Confirmar recebimento
                          <ChevronRight className="w-3.5 h-3.5 ml-0.5 opacity-70" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Botão de Expandir / Recolher quando há mais de 10 itens */}
              {temMais && (
                <div className="flex items-center justify-between pt-1 px-1">
                  <span className="text-xs text-slate-500">
                    Mostrando {itensExibidos.length} de {contas.length} pendências
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-amber-800 hover:text-amber-900 hover:bg-amber-50 font-medium flex items-center gap-1"
                    onClick={() => setExpandido((prev) => !prev)}
                  >
                    {expandido ? (
                      <>
                        <span>Ver menos</span>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <span>Ver mais ({contas.length - LIMITE_INICIAL} restantes)</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
