import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileX,
  ArrowRight,
  Loader2,
  Info,
  Check,
  ShieldCheck,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { parseXlsxBuffer, parseCsvText } from '@/services/importacao/spreadsheet-reader'
import { parseExtratoSeguradora } from '@/services/importacao/extrato-parsers'
import {
  reconciliarExtratoComBanco,
  executarBaixaEmLote,
  ReconciliacaoExtratoLote,
  LinhaConferida,
} from '@/services/importacao/extrato-service'
import { formatCurrency, formatBRDate } from '@/lib/utils'

interface ImportarExtratoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const ImportarExtratoModal: React.FC<ImportarExtratoModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [arquivo, setArquivo] = useState<File | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [loteReconciliado, setLoteReconciliado] = useState<ReconciliacaoExtratoLote | null>(null)
  const [activeTab, setActiveTab] = useState<
    'aprovados' | 'divergentes' | 'semPrevisao' | 'outros'
  >('aprovados')
  const [executandoBaixa, setExecutandoBaixa] = useState(false)

  // Seleções do usuário para baixa
  const [selecoes, setSelecoes] = useState<Record<string, boolean>>({})

  const resetState = () => {
    setArquivo(null)
    setCarregando(false)
    setLoteReconciliado(null)
    setSelecoes({})
    setActiveTab('aprovados')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setArquivo(file)
    setCarregando(true)

    try {
      let rows: string[][] = []
      const ext = file.name.split('.').pop()?.toLowerCase()

      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer()
        const parsed = await parseXlsxBuffer(buffer)
        rows = parsed.rows
      } else {
        const text = await file.text()
        rows = parseCsvText(text)
      }

      if (rows.length === 0) {
        throw new Error('O arquivo está vazio ou não pôde ser lido.')
      }

      // Parser determinístico de formato
      const parseResult = parseExtratoSeguradora(rows, file.name)

      // Reconciliar com banco de dados
      const resultadoLote = await reconciliarExtratoComBanco(parseResult, file.name)
      setLoteReconciliado(resultadoLote)

      // Inicializa seleções: todos os Aprovados começam selecionados
      const initialMap: Record<string, boolean> = {}
      for (const item of resultadoLote.filas.aprovados) {
        initialMap[item.linha.id] = true
      }
      setSelecoes(initialMap)

      toast({
        title: 'Extrato processado com sucesso',
        description: `Formato identificado: ${resultadoLote.seguradoraNome}. ${resultadoLote.filas.aprovados.length} linhas pré-aprovadas.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao processar arquivo',
        description: err.message || 'Falha na leitura da planilha de extrato.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  const toggleSelecao = (linhaId: string) => {
    setSelecoes((prev) => ({
      ...prev,
      [linhaId]: !prev[linhaId],
    }))
  }

  const selecionarTodos = (linhas: LinhaConferida[], valor: boolean) => {
    setSelecoes((prev) => {
      const next = { ...prev }
      for (const l of linhas) {
        next[l.linha.id] = valor
      }
      return next
    })
  }

  // Contagem de itens selecionados para a baixa
  const getLinhasSelecionadas = (): LinhaConferida[] => {
    if (!loteReconciliado) return []
    const all = [
      ...loteReconciliado.filas.aprovados,
      ...loteReconciliado.filas.divergentes,
      ...loteReconciliado.filas.semPrevisao,
    ]
    return all.filter((item) => selecoes[item.linha.id] && item.policyCorrespondente)
  }

  const linhasSelecionadas = getLinhasSelecionadas()
  const valorTotalSelecionado = linhasSelecionadas.reduce(
    (acc, it) => acc + it.linha.liquidoPago,
    0,
  )

  const handleConfirmarBaixaEmLote = async () => {
    if (!loteReconciliado || linhasSelecionadas.length === 0) return

    setExecutandoBaixa(true)
    try {
      const res = await executarBaixaEmLote(
        loteReconciliado,
        linhasSelecionadas,
        arquivo || undefined,
      )

      toast({
        title: 'Baixa em lote concluída!',
        description: `${res.sucessos} comissões baixadas com sucesso. ${res.apolicesAtualizadas > 0 ? `${res.apolicesAtualizadas} números de apólice completados.` : ''}`,
      })

      if (res.falhas.length > 0) {
        toast({
          title: 'Algumas linhas não puderam ser baixadas',
          description: `${res.falhas.length} lançamentos reportaram erro transacional.`,
          variant: 'destructive',
        })
      }

      onOpenChange(false)
      resetState()
      onSuccess?.()
    } catch (err: any) {
      toast({
        title: 'Falha na baixa em lote',
        description: err.message || 'Ocorreu um erro ao registrar as comissões.',
        variant: 'destructive',
      })
    } finally {
      setExecutandoBaixa(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/50 rounded-lg text-emerald-700 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Importar Extrato de Comissões</DialogTitle>
              <DialogDescription>
                Upload de planilha da seguradora, cruzamento automático com previsões e baixa em
                lote 100% segura.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Upload State */}
        {!loteReconciliado ? (
          <div className="py-8">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                carregando
                  ? 'border-emerald-300 bg-emerald-50/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-900/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
                disabled={carregando}
              />
              {carregando ? (
                <div className="flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Lendo arquivo e cruzando previsões...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400">
                    <Upload className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                      Clique para selecionar o extrato (XLSX ou CSV)
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Formatos calibrados: Porto Seguro, Bradesco, Tokio Marine, MAPFRE, SUSEP
                      Detalhado e Consolidado
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Regra de Segurança:
                </span>{' '}
                Apenas linhas com pagamento realizado e data de crédito entram para baixa. Linhas
                zeradas ou informativas são descartadas automaticamente. Nenhuma apólice existente é
                alterada.
              </div>
            </div>
          </div>
        ) : (
          /* Reconciled Lot View */
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Header com Totais e Checksum */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border text-xs">
              <div>
                <span className="text-slate-500 block">Seguradora</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                  {loteReconciliado.seguradoraNome}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Líquido no Extrato</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                  {formatCurrency(loteReconciliado.totais.liquidoGeral)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Pré-aprovados</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
                  {loteReconciliado.filas.aprovados.length} lançamentos
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Checksum</span>
                {loteReconciliado.checksum.status === 'OK' ? (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                    <Check className="h-3 w-3 mr-1" /> Bateu 100%
                  </Badge>
                ) : loteReconciliado.checksum.status === 'DIVERGENTE' ? (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Divergente
                  </Badge>
                ) : (
                  <span className="text-slate-400">Sem rodapé</span>
                )}
              </div>
            </div>

            {/* Três Filas de Conferência */}
            <Tabs
              value={activeTab}
              onValueChange={(v: any) => setActiveTab(v)}
              className="flex-1 flex flex-col min-h-0"
            >
              <TabsList className="grid grid-cols-4 h-9">
                <TabsTrigger value="aprovados" className="text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1.5" />
                  Casamento Exato ({loteReconciliado.filas.aprovados.length})
                </TabsTrigger>
                <TabsTrigger value="divergentes" className="text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mr-1.5" />
                  Divergentes ({loteReconciliado.filas.divergentes.length})
                </TabsTrigger>
                <TabsTrigger value="semPrevisao" className="text-xs">
                  <HelpCircle className="h-3.5 w-3.5 text-rose-500 mr-1.5" />
                  Sem Previsão ({loteReconciliado.filas.semPrevisao.length})
                </TabsTrigger>
                <TabsTrigger value="outros" className="text-xs">
                  <FileX className="h-3.5 w-3.5 text-slate-400 mr-1.5" />
                  Já Baixados / Info (
                  {loteReconciliado.filas.jaBaixados.length +
                    loteReconciliado.filas.ignorados.length}
                  )
                </TabsTrigger>
              </TabsList>

              {/* Aba 1: Aprovados (Casamento 100%) */}
              <TabsContent
                value="aprovados"
                className="flex-1 overflow-y-auto mt-2 min-h-0 pr-1 space-y-2"
              >
                <div className="flex items-center justify-between text-xs py-1 px-2 text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={
                        loteReconciliado.filas.aprovados.length > 0 &&
                        loteReconciliado.filas.aprovados.every((i) => selecoes[i.linha.id])
                      }
                      onCheckedChange={(c) =>
                        selecionarTodos(loteReconciliado.filas.aprovados, Boolean(c))
                      }
                    />
                    <span>Selecionar todos ({loteReconciliado.filas.aprovados.length})</span>
                  </div>
                  <span>
                    Total pré-aprovado: {formatCurrency(loteReconciliado.totais.liquidoAprovado)}
                  </span>
                </div>

                {loteReconciliado.filas.aprovados.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    Nenhum lançamento com casamento 100% automático. Veja as abas de Divergentes e
                    Sem Previsão.
                  </div>
                ) : (
                  loteReconciliado.filas.aprovados.map((item) => (
                    <div
                      key={item.linha.id}
                      className="p-3 rounded-lg border bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-xs hover:border-emerald-400 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={Boolean(selecoes[item.linha.id])}
                          onCheckedChange={() => toggleSelecao(item.linha.id)}
                        />
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.linha.seguradoNome ||
                              item.policyCorrespondente?.expand?.client?.name ||
                              'Cliente'}
                          </div>
                          <div className="text-slate-500 text-[11px] flex items-center gap-2 mt-0.5">
                            <span>
                              Apólice/Prop:{' '}
                              {item.linha.numeroApolice || item.linha.numeroProposta || '-'}
                            </span>
                            <span>•</span>
                            <span>Parcela {item.linha.parcela}</span>
                            <span>•</span>
                            <span>Crédito: {formatBRDate(item.linha.dataCredito)}</span>
                          </div>
                          {item.propostaParaAtualizarApolice &&
                            !item.propostaParaAtualizarApolice.divergente && (
                              <Badge
                                variant="outline"
                                className="mt-1 text-[10px] text-blue-600 border-blue-200"
                              >
                                Vai completar nº apólice:{' '}
                                {item.propostaParaAtualizarApolice.novoNumeroApolice}
                              </Badge>
                            )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatCurrency(item.linha.liquidoPago)}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Bruto: {formatCurrency(item.linha.comissaoBruta)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Aba 2: Divergentes */}
              <TabsContent
                value="divergentes"
                className="flex-1 overflow-y-auto mt-2 min-h-0 pr-1 space-y-2"
              >
                <div className="p-2 text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 rounded-md border border-amber-200">
                  <Info className="h-3.5 w-3.5 inline mr-1" />
                  Estes lançamentos possuem apólice correspondente, mas com valor ou parcela
                  divergente do previsto. Marque a caixa para autorizar a baixa com o valor do
                  extrato.
                </div>
                {loteReconciliado.filas.divergentes.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    Nenhuma divergência encontrada.
                  </div>
                ) : (
                  loteReconciliado.filas.divergentes.map((item) => (
                    <div
                      key={item.linha.id}
                      className="p-3 rounded-lg border bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-xs border-amber-200/80"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={Boolean(selecoes[item.linha.id])}
                          onCheckedChange={() => toggleSelecao(item.linha.id)}
                        />
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.linha.seguradoNome ||
                              item.policyCorrespondente?.expand?.client?.name ||
                              'Cliente'}
                          </div>
                          <div className="text-amber-700 dark:text-amber-300 font-medium text-[11px] mt-0.5">
                            {item.motivoFila}
                          </div>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            Extrato: {formatCurrency(item.linha.comissaoBruta)} | Previsto:{' '}
                            {formatCurrency(
                              item.previsaoCorrespondente?.valor_previsto ||
                                item.policyCorrespondente?.commission ||
                                0,
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                          {formatCurrency(item.linha.liquidoPago)}
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] text-amber-600 border-amber-300"
                        >
                          Exige decisão
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Aba 3: Sem Previsão */}
              <TabsContent
                value="semPrevisao"
                className="flex-1 overflow-y-auto mt-2 min-h-0 pr-1 space-y-2"
              >
                <div className="p-2 text-xs bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200 rounded-md border border-rose-200">
                  <Info className="h-3.5 w-3.5 inline mr-1" />
                  Estes lançamentos não possuem contrato cadastrado correspondente. Você pode
                  cadastrar a apólice depois ou ignorar com registro.
                </div>
                {loteReconciliado.filas.semPrevisao.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    Todas as linhas do extrato possuem contratos correspondentes.
                  </div>
                ) : (
                  loteReconciliado.filas.semPrevisao.map((item) => (
                    <div
                      key={item.linha.id}
                      className="p-3 rounded-lg border bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.linha.seguradoNome || 'Segurado não identificado'}
                        </div>
                        <div className="text-rose-600 dark:text-rose-400 text-[11px] mt-0.5">
                          {item.motivoFila}
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          Extrato: {item.linha.numeroExtrato} | Data:{' '}
                          {formatBRDate(item.linha.dataCredito)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                          {formatCurrency(item.linha.liquidoPago)}
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] text-rose-600 border-rose-300"
                        >
                          Sem cadastro
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Aba 4: Já Baixados e Informativos */}
              <TabsContent
                value="outros"
                className="flex-1 overflow-y-auto mt-2 min-h-0 pr-1 space-y-2"
              >
                {loteReconciliado.filas.jaBaixados.map((item) => (
                  <div
                    key={item.linha.id}
                    className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-3 text-xs text-slate-500"
                  >
                    <div>
                      <div className="font-medium text-slate-700 dark:text-slate-300">
                        {item.linha.seguradoNome ||
                          item.policyCorrespondente?.expand?.client?.name ||
                          'Apólice'}
                      </div>
                      <div className="text-emerald-700 dark:text-emerald-300 text-[11px]">
                        {item.motivoFila}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      Já quitado
                    </Badge>
                  </div>
                ))}
                {loteReconciliado.filas.ignorados.map((item) => (
                  <div
                    key={item.linha.id}
                    className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-3 text-xs text-slate-400"
                  >
                    <div>
                      <div>
                        Linha informativa / zerada ({item.linha.seguradoNome || 'Sem segurado'})
                      </div>
                      <div className="text-[11px] text-slate-400">{item.motivoFila}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      Informativo
                    </Badge>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
          {loteReconciliado ? (
            <>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Selecionados:{' '}
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {linhasSelecionadas.length} lançamentos ({formatCurrency(valorTotalSelecionado)})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={resetState} disabled={executandoBaixa}>
                  Trocar arquivo
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleConfirmarBaixaEmLote}
                  disabled={linhasSelecionadas.length === 0 || executandoBaixa}
                >
                  {executandoBaixa ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      Baixando comissões...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Confirmar Baixa em Lote ({linhasSelecionadas.length})
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
