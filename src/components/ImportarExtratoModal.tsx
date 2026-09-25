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
  Archive,
  ArrowUpDown,
  History,
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
import {
  registrarRecebimentoLegado,
  registrarLinhasComoLegadoEmLote,
  RecebimentoLegado,
} from '@/services/importacao/recebimentos-legados'
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
    'aprovados' | 'divergentes' | 'semPrevisao' | 'legadosResolvidos' | 'outros'
  >('aprovados')
  const [executandoBaixa, setExecutandoBaixa] = useState(false)
  const [processandoLegado, setProcessandoLegado] = useState(false)

  // Seleções do usuário para baixa (Aprovados e Divergentes)
  const [selecoes, setSelecoes] = useState<Record<string, boolean>>({})

  // Seleções específicas para a fila Sem Previsão (para registrar como legado em lote)
  const [selecoesSemPrevisao, setSelecoesSemPrevisao] = useState<Record<string, boolean>>({})

  // Linhas resolvidas como legado durante a sessão atual
  const [linhasResolvidasLegado, setLinhasResolvidasLegado] = useState<
    Array<{ item: LinhaConferida; legado: RecebimentoLegado; dataHora: string }>
  >([])

  // ID do lote criado na sessão para vínculo das resoluções
  const [lotePersistidoId, setLotePersistidoId] = useState<string | null>(null)

  const resetState = () => {
    setArquivo(null)
    setCarregando(false)
    setLoteReconciliado(null)
    setSelecoes({})
    setSelecoesSemPrevisao({})
    setLinhasResolvidasLegado([])
    setLotePersistidoId(null)
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

  const toggleSelecaoSemPrevisao = (linhaId: string) => {
    setSelecoesSemPrevisao((prev) => ({
      ...prev,
      [linhaId]: !prev[linhaId],
    }))
  }

  const selecionarTodosSemPrevisao = (linhas: LinhaConferida[], valor: boolean) => {
    setSelecoesSemPrevisao((prev) => {
      const next = { ...prev }
      for (const l of linhas) {
        next[l.linha.id] = valor
      }
      return next
    })
  }

  // Ordenação decrescente por valor líquido (maior primeiro para resolver os grandes primeiro)
  const getSemPrevisaoOrdenado = (): LinhaConferida[] => {
    if (!loteReconciliado) return []
    return [...loteReconciliado.filas.semPrevisao].sort(
      (a, b) => (b.linha.liquidoPago || 0) - (a.linha.liquidoPago || 0),
    )
  }

  const handleRegistrarLinhaComoLegado = async (item: LinhaConferida) => {
    if (!loteReconciliado) return
    setProcessandoLegado(true)
    try {
      const docRef =
        item.linha.numeroExtrato || item.linha.numeroApolice || item.linha.numeroProposta || '-'
      const rec = await registrarRecebimentoLegado({
        seguradora_nome: item.linha.seguradoraNome || loteReconciliado.seguradoraNome,
        data_credito: item.linha.dataCredito,
        valor_liquido: item.linha.liquidoPago,
        valor_bruto: item.linha.comissaoBruta,
        impostos: item.linha.impostos,
        numero_documento: item.linha.numeroExtrato || '',
        numero_proposta: item.linha.numeroProposta || '',
        numero_apolice: item.linha.numeroApolice || '',
        parcela: item.linha.parcela || 1,
        segurado_nome: item.linha.seguradoNome || '',
        observacao: `[Registrado como Legado] Doc: ${docRef} | Seguradora: ${loteReconciliado.seguradoraNome}`,
        idempotency_hash: item.idempotencyHash,
        lote_id: lotePersistidoId || '',
        lote_nome: loteReconciliado.arquivoNome,
      })

      // Remover da fila semPrevisao e mover para linhasResolvidasLegado
      setLoteReconciliado((prev) => {
        if (!prev) return null
        return {
          ...prev,
          filas: {
            ...prev.filas,
            semPrevisao: prev.filas.semPrevisao.filter((i) => i.linha.id !== item.linha.id),
          },
        }
      })

      setLinhasResolvidasLegado((prev) => [
        { item, legado: rec, dataHora: new Date().toLocaleTimeString('pt-BR') },
        ...prev,
      ])

      setSelecoesSemPrevisao((prev) => {
        const next = { ...prev }
        delete next[item.linha.id]
        return next
      })

      toast({
        title: 'Registrado como legado!',
        description: `${formatCurrency(item.linha.liquidoPago)} gravado na contabilidade sem vínculo a apólice.`,
      })
      onSuccess?.()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar como legado',
        description: err.message || 'Falha ao gravar lançamento legado.',
        variant: 'destructive',
      })
    } finally {
      setProcessandoLegado(false)
    }
  }

  const handleRegistrarLoteComoLegado = async () => {
    if (!loteReconciliado) return
    const semPrevList = getSemPrevisaoOrdenado()
    const selecionados = semPrevList.filter((item) => selecoesSemPrevisao[item.linha.id])
    if (selecionados.length === 0) return

    setProcessandoLegado(true)
    try {
      const res = await registrarLinhasComoLegadoEmLote(selecionados, {
        loteId: lotePersistidoId || undefined,
        loteNome: loteReconciliado.arquivoNome,
        seguradoraNome: loteReconciliado.seguradoraNome,
      })

      const idsSucesso = new Set(
        selecionados
          .filter((s) => !res.falhas.some((f) => f.linhaId === s.linha.id))
          .map((s) => s.linha.id),
      )

      // Remover da fila os que tiveram sucesso
      setLoteReconciliado((prev) => {
        if (!prev) return null
        return {
          ...prev,
          filas: {
            ...prev.filas,
            semPrevisao: prev.filas.semPrevisao.filter((i) => !idsSucesso.has(i.linha.id)),
          },
        }
      })

      const novosResolvidos = selecionados
        .filter((s) => idsSucesso.has(s.linha.id))
        .map((s, idx) => ({
          item: s,
          legado: res.registros[idx] || ({} as RecebimentoLegado),
          dataHora: new Date().toLocaleTimeString('pt-BR'),
        }))

      setLinhasResolvidasLegado((prev) => [...novosResolvidos, ...prev])

      setSelecoesSemPrevisao((prev) => {
        const next = { ...prev }
        for (const id of idsSucesso) {
          delete next[id]
        }
        return next
      })

      toast({
        title: 'Lote registrado como legado!',
        description: `${res.sucessos} recebimentos gravados (${formatCurrency(res.totalValor)}).`,
      })

      if (res.falhas.length > 0) {
        toast({
          title: 'Algumas linhas falharam',
          description: `${res.falhas.length} lançamentos não puderam ser gravados.`,
          variant: 'destructive',
        })
      }
      onSuccess?.()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar lote',
        description: err.message || 'Falha ao processar registros legados.',
        variant: 'destructive',
      })
    } finally {
      setProcessandoLegado(false)
    }
  }

  // Contagem de itens selecionados para a baixa
  const getLinhasSelecionadas = (): LinhaConferida[] => {
    if (!loteReconciliado) return []
    const all = [...loteReconciliado.filas.aprovados, ...loteReconciliado.filas.divergentes]
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
              <TabsList className="grid grid-cols-5 h-9">
                <TabsTrigger value="aprovados" className="text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1" />
                  Casamento ({loteReconciliado.filas.aprovados.length})
                </TabsTrigger>
                <TabsTrigger value="divergentes" className="text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mr-1" />
                  Divergentes ({loteReconciliado.filas.divergentes.length})
                </TabsTrigger>
                <TabsTrigger value="semPrevisao" className="text-xs">
                  <HelpCircle className="h-3.5 w-3.5 text-rose-500 mr-1" />
                  Sem Previsão ({loteReconciliado.filas.semPrevisao.length})
                </TabsTrigger>
                <TabsTrigger value="legadosResolvidos" className="text-xs">
                  <Archive className="h-3.5 w-3.5 text-indigo-500 mr-1" />
                  Legados ({linhasResolvidasLegado.length})
                </TabsTrigger>
                <TabsTrigger value="outros" className="text-xs">
                  <FileX className="h-3.5 w-3.5 text-slate-400 mr-1" />
                  Outros (
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

              {/* Aba 3: Sem Previsão (Tornada 100% visível, ordenada por maior valor primeiro, com ação rápida de Registrar como Legado) */}
              <TabsContent
                value="semPrevisao"
                className="flex-1 overflow-y-auto mt-2 min-h-0 pr-1 space-y-2"
              >
                <div className="p-2.5 text-xs bg-rose-50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 rounded-md border border-rose-200 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Info className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>
                      Estes lançamentos constam no extrato bancário pago, mas sem apólice ativa no
                      sistema.
                    </span>
                  </div>
                  <div className="text-[11px] text-rose-700 dark:text-rose-300 pl-5">
                    <strong>Decisão de produto:</strong> em vez de cadastrar apólices antigas do
                    passado, registre como <strong>LEGADO</strong> com 1 clique (individual ou em
                    lote). O dinheiro entra no caixa contábil sem vínculo com apólices, e a linha
                    sai da fila de pendências.
                  </div>
                </div>

                {getSemPrevisaoOrdenado().length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg border text-xs">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="chk-sem-prev-all"
                        checked={
                          getSemPrevisaoOrdenado().length > 0 &&
                          getSemPrevisaoOrdenado().every((i) => selecoesSemPrevisao[i.linha.id])
                        }
                        onCheckedChange={(c) =>
                          selecionarTodosSemPrevisao(getSemPrevisaoOrdenado(), Boolean(c))
                        }
                      />
                      <label
                        htmlFor="chk-sem-prev-all"
                        className="cursor-pointer font-medium text-slate-700 dark:text-slate-300"
                      >
                        Selecionar todos ({getSemPrevisaoOrdenado().length})
                      </label>
                      <span className="text-slate-400 text-[11px] flex items-center gap-1">
                        <ArrowUpDown className="h-3 w-3" /> Ordenados do maior valor para o menor
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {Object.values(selecoesSemPrevisao).filter(Boolean).length > 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 dark:hover:bg-indigo-900"
                          disabled={processandoLegado}
                          onClick={handleRegistrarLoteComoLegado}
                        >
                          {processandoLegado ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Archive className="h-3 w-3 mr-1" />
                          )}
                          Registrar selecionados como Legado (
                          {Object.values(selecoesSemPrevisao).filter(Boolean).length})
                        </Button>
                      )}
                      <span className="text-slate-600 dark:text-slate-400 font-semibold">
                        Total sem previsão:{' '}
                        {formatCurrency(
                          getSemPrevisaoOrdenado().reduce(
                            (acc, it) => acc + (it.linha.liquidoPago || 0),
                            0,
                          ),
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {getSemPrevisaoOrdenado().length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    {linhasResolvidasLegado.length > 0 ? (
                      <div className="flex flex-col items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                        <span className="font-medium">
                          Todas as linhas sem previsão deste extrato foram resolvidas e registradas
                          como legado!
                        </span>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-xs text-indigo-600 underline"
                          onClick={() => setActiveTab('legadosResolvidos')}
                        >
                          Ver {linhasResolvidasLegado.length} registros arquivados na aba Legados
                        </Button>
                      </div>
                    ) : (
                      'Nenhum lançamento sem previsão neste extrato.'
                    )}
                  </div>
                ) : (
                  getSemPrevisaoOrdenado().map((item, index) => {
                    const l = item.linha
                    const docExibicao =
                      l.numeroExtrato || l.numeroApolice || l.numeroProposta || '-'
                    const seguradoraExibicao = l.seguradoraNome || loteReconciliado.seguradoraNome

                    return (
                      <div
                        key={item.linha.id}
                        className="p-3 rounded-lg border bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs hover:border-indigo-300 transition-colors"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Checkbox
                            checked={Boolean(selecoesSemPrevisao[item.linha.id])}
                            onCheckedChange={() => toggleSelecaoSemPrevisao(item.linha.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600">
                                #{index + 1}
                              </span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {l.seguradoNome || 'Segurado não identificado'}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] text-rose-600 border-rose-300"
                              >
                                ❌ Sem previsão
                              </Badge>
                            </div>

                            {/* Detalhes completos lidos do extrato */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40 p-2 rounded">
                              <div>
                                <span className="text-slate-400 block text-[10px]">
                                  Seguradora:
                                </span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  {seguradoraExibicao}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">
                                  Nº Proposta / Apólice:
                                </span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  {docExibicao}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">Parcela:</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  {l.parcela || 1}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">
                                  Data Crédito:
                                </span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  {formatBRDate(l.dataCredito)}
                                </span>
                              </div>
                            </div>

                            {/* Linha adicional com valores brutos e motivo */}
                            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                              <span>Bruto: {formatCurrency(l.comissaoBruta || l.liquidoPago)}</span>
                              {Boolean(l.impostos) && (
                                <span>Impostos: {formatCurrency(l.impostos)}</span>
                              )}
                              <span>•</span>
                              <span className="text-rose-500">{item.motivoFila}</span>
                            </div>
                          </div>
                        </div>

                        {/* Valor e Ação rápida de resolução */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 gap-2 shrink-0">
                          <div className="text-left sm:text-right">
                            <div className="text-[10px] text-slate-400 sm:hidden">
                              Líquido pago:
                            </div>
                            <div className="font-bold text-slate-900 dark:text-slate-100 text-base">
                              {formatCurrency(l.liquidoPago)}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 dark:border-indigo-800 dark:text-indigo-300 flex items-center gap-1"
                            disabled={processandoLegado}
                            onClick={() => handleRegistrarLinhaComoLegado(item)}
                            title="Lança contabilmente o valor recebido sem vínculo a nenhuma apólice"
                          >
                            <Archive className="h-3 w-3" />
                            Registrar como legado
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </TabsContent>

              {/* Aba 4: Legados já resolvidos na sessão (Preservados para auditoria) */}
              <TabsContent
                value="legadosResolvidos"
                className="flex-1 overflow-y-auto mt-2 min-h-0 pr-1 space-y-2"
              >
                <div className="p-2.5 text-xs bg-indigo-50 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-200 rounded-md border border-indigo-200 flex items-start gap-2">
                  <Archive className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Lançamentos Contábeis de Legado</div>
                    <div className="text-[11px] text-indigo-700 dark:text-indigo-300">
                      Estes valores já foram contabilizados no caixa da corretora sem vínculo com
                      apólices. Preservados para conferência e auditoria.
                    </div>
                  </div>
                </div>

                {linhasResolvidasLegado.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    Nenhum recebimento registrado como legado nesta sessão de importação.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs px-2 py-1 bg-slate-50 dark:bg-slate-900 rounded border">
                      <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <History className="h-3.5 w-3.5 text-indigo-600" />
                        {linhasResolvidasLegado.length} lançamento(s) arquivado(s) como legado
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        Total legado:{' '}
                        {formatCurrency(
                          linhasResolvidasLegado.reduce(
                            (acc, it) => acc + it.item.linha.liquidoPago,
                            0,
                          ),
                        )}
                      </span>
                    </div>

                    {linhasResolvidasLegado.map(({ item, legado, dataHora }) => (
                      <div
                        key={item.linha.id}
                        className="p-3 rounded-lg border bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-xs border-indigo-200/70"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {item.linha.seguradoNome ||
                                legado.segurado_nome ||
                                'Segurado do Extrato'}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] text-indigo-600 border-indigo-300 bg-indigo-50 dark:bg-indigo-950"
                            >
                              ✓ Contabilizado como Legado
                            </Badge>
                          </div>
                          <div className="text-slate-500 text-[11px] flex items-center gap-2 mt-1">
                            <span>
                              Seguradora:{' '}
                              {item.linha.seguradoraNome || loteReconciliado.seguradoraNome}
                            </span>
                            <span>•</span>
                            <span>
                              Doc: {item.linha.numeroExtrato || item.linha.numeroApolice || '-'}
                            </span>
                            <span>•</span>
                            <span>Crédito: {formatBRDate(item.linha.dataCredito)}</span>
                            <span>•</span>
                            <span className="text-slate-400 text-[10px]">
                              Registrado às {dataHora}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                            {formatCurrency(item.linha.liquidoPago)}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Sem vínculo com apólice
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
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
