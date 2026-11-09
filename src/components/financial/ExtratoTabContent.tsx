import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ArrowRight,
  Upload,
  History,
  FileCheck2,
} from 'lucide-react'
import { formatCurrencyDisplay } from '@/lib/utils'
import { parseExtratoSeguradora } from '@/services/importacao/extrato-parsers'
import {
  reconciliarExtratoComBanco,
  executarBaixaEmLote,
  ReconciliacaoExtratoLote,
  LinhaConferida,
} from '@/services/importacao/extrato-service'
import { parseXlsxBuffer, parseCsvText } from '@/services/importacao/spreadsheet-reader'
import { useToast } from '@/hooks/use-toast'

export interface ExtratoTabContentProps {
  onAbrirImportador?: () => void
}

export const ExtratoTabContent: React.FC<ExtratoTabContentProps> = ({ onAbrirImportador }) => {
  const { toast } = useToast()
  const [reconciliacao, setReconciliacao] = useState<ReconciliacaoExtratoLote | null>(null)
  const [loading, setLoading] = useState(false)
  const [executandoBaixa, setExecutandoBaixa] = useState(false)
  const [filaAtiva, setFilaAtiva] = useState<'aprovados' | 'divergentes' | 'semPrevisao'>(
    'aprovados',
  )

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      let linhasRaw: any[] = []
      const ext = file.name.split('.').pop()?.toLowerCase()

      if (ext === 'csv') {
        const text = await file.text()
        linhasRaw = parseCsvText(text)
      } else {
        const buffer = await file.arrayBuffer()
        const parsed = await parseXlsxBuffer(buffer)
        linhasRaw = parsed.rows
      }

      const parseResult = parseExtratoSeguradora(linhasRaw, file.name)
      const resultadoLote = await reconciliarExtratoComBanco(parseResult, file.name)

      setReconciliacao(resultadoLote)
      toast({
        title: 'Extrato processado com sucesso',
        description: `${resultadoLote.totalLinhas} linhas analisadas. ${resultadoLote.filas.aprovados.length} aprovadas.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao processar extrato',
        description: err?.message || 'Arquivo com formato desconhecido ou corrompido.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const handleConfirmarBaixaEmLote = async () => {
    if (!reconciliacao) return
    const linhasParaBaixar = reconciliacao.filas.aprovados.filter((l) => l.selecionadoParaBaixa)
    if (linhasParaBaixar.length === 0) {
      toast({
        title: 'Nenhuma linha selecionada',
        description: 'Selecione pelo menos uma linha aprovada para baixa.',
      })
      return
    }

    setExecutandoBaixa(true)
    try {
      const res = await executarBaixaEmLote(reconciliacao, linhasParaBaixar)
      toast({
        title: 'Baixa em lote concluída',
        description: `${res.sucessos} comissões baixadas com sucesso.${res.falhas.length > 0 ? ` ${res.falhas.length} falhas.` : ''}`,
      })
      setReconciliacao(null)
    } catch (err: any) {
      toast({
        title: 'Erro na baixa em lote',
        description: err?.message || 'Falha ao gravar baixas no banco.',
        variant: 'destructive',
      })
    } finally {
      setExecutandoBaixa(false)
    }
  }

  const linhasExibidas: LinhaConferida[] = reconciliacao ? reconciliacao.filas[filaAtiva] : []

  return (
    <div className="space-y-6">
      {/* CARD PRINCIPAL DE ENTRADA DO EXTRATO */}
      <Card className="border shadow-xs bg-linear-to-r from-emerald-50/50 via-white to-blue-50/40">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Importação e Conciliação de Extratos
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Conferência automática por apólice, proposta e parcela. Apenas pagamentos com
                crédito realizado são baixados.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="hidden"
                />
                <Button
                  asChild
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 cursor-pointer"
                  disabled={loading}
                >
                  <span>
                    <Upload className="w-4 h-4 mr-1.5" />
                    {loading ? 'Analisando...' : 'Carregar Extrato (.xlsx / .csv)'}
                  </span>
                </Button>
              </label>
              {onAbrirImportador && (
                <Button
                  variant="outline"
                  onClick={onAbrirImportador}
                  className="text-xs h-9 bg-white"
                >
                  <FileCheck2 className="w-4 h-4 mr-1.5 text-blue-600" />
                  Abrir Assistente Completo
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
            <div className="p-3 bg-white border rounded-lg flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900 block">Fila Aprovados (✅)</span>
                Vínculo com apólice/proposta localizado e valores correspondentes. Pronto para baixa
                em lote.
              </div>
            </div>
            <div className="p-3 bg-white border rounded-lg flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900 block">Fila Divergentes (⚠️)</span>
                Valor líquido ou parcela diferente do previsto no cadastro para conferência do
                corretor.
              </div>
            </div>
            <div className="p-3 bg-white border rounded-lg flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900 block">
                  Sem Previsão / Legado (❌)
                </span>
                Comissões sem apólice ativa no sistema podem ser registradas como comissão legada.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RESULTADO DA CONFERÊNCIA ATUAL (SE HOUVER EXTRATO CARREGADO) */}
      {reconciliacao && (
        <Card className="border shadow-xs">
          <CardHeader className="pb-3 border-b bg-slate-50/70">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-white font-mono text-[11px]">
                    {reconciliacao.formato}
                  </Badge>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    {reconciliacao.arquivoNome}
                  </CardTitle>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Seguradora detectada: <strong>{reconciliacao.seguradoraNome}</strong> — Total de{' '}
                  {reconciliacao.totalLinhas} linhas conferidas.
                </p>
              </div>

              {reconciliacao.filas.aprovados.length > 0 && (
                <Button
                  onClick={handleConfirmarBaixaEmLote}
                  disabled={executandoBaixa}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  {executandoBaixa
                    ? 'Baixando comissões...'
                    : `Confirmar Baixa em Lote (${reconciliacao.filas.aprovados.filter((l) => l.selecionadoParaBaixa).length} itens)`}
                </Button>
              )}
            </div>

            {/* SELETORES DE FILAS */}
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <Button
                size="sm"
                variant={filaAtiva === 'aprovados' ? 'default' : 'outline'}
                onClick={() => setFilaAtiva('aprovados')}
                className={`text-xs h-8 ${filaAtiva === 'aprovados' ? 'bg-emerald-600 text-white' : ''}`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Aprovados ({reconciliacao.filas.aprovados.length}) — R${' '}
                {formatCurrencyDisplay(reconciliacao.totais.liquidoAprovado)}
              </Button>
              <Button
                size="sm"
                variant={filaAtiva === 'divergentes' ? 'default' : 'outline'}
                onClick={() => setFilaAtiva('divergentes')}
                className={`text-xs h-8 ${filaAtiva === 'divergentes' ? 'bg-amber-600 text-white' : ''}`}
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Divergentes ({reconciliacao.filas.divergentes.length})
              </Button>
              <Button
                size="sm"
                variant={filaAtiva === 'semPrevisao' ? 'default' : 'outline'}
                onClick={() => setFilaAtiva('semPrevisao')}
                className={`text-xs h-8 ${filaAtiva === 'semPrevisao' ? 'bg-slate-700 text-white' : ''}`}
              >
                <HelpCircle className="w-3.5 h-3.5 mr-1" />
                Sem Previsão / Legado ({reconciliacao.filas.semPrevisao.length})
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="p-2.5">Proposta / Apólice</th>
                    <th className="p-2.5">Segurado</th>
                    <th className="p-2.5 text-center">Parcela</th>
                    <th className="p-2.5 text-center">Data Crédito</th>
                    <th className="p-2.5 text-right">Bruto (R$)</th>
                    <th className="p-2.5 text-right">Líquido (R$)</th>
                    <th className="p-2.5">Status / Vínculo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linhasExibidas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-6 text-slate-500">
                        Nenhuma linha nesta fila.
                      </td>
                    </tr>
                  ) : (
                    linhasExibidas.map((item, idx) => (
                      <tr key={item.idempotencyHash || idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-medium">
                          {item.linha.numeroProposta || item.linha.numeroApolice || '-'}
                        </td>
                        <td className="p-2.5 max-w-[200px] truncate">
                          {item.linha.seguradoNome ||
                            item.policyCorrespondente?.expand?.client?.name ||
                            '-'}
                        </td>
                        <td className="p-2.5 text-center">{item.linha.parcela || 1}</td>
                        <td className="p-2.5 text-center">{item.linha.dataCredito || '-'}</td>
                        <td className="p-2.5 text-right">
                          {formatCurrencyDisplay(item.linha.comissaoBruta || 0)}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-emerald-700">
                          {formatCurrencyDisplay(item.linha.liquidoPago || 0)}
                        </td>
                        <td className="p-2.5">
                          <span className="text-[11px] text-slate-600">{item.motivoFila}</span>
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

      {/* INSTRUÇÕES E DICAS DE USO */}
      <Card className="border bg-slate-50/50">
        <CardContent className="p-4 text-xs text-slate-600 space-y-2">
          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
            <History className="w-4 h-4 text-slate-500" />
            Regras de conciliação bancária de extratos:
          </div>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Pagamentos realizados:</strong> Apenas linhas com data de crédito confirmada e
              líquido &gt; R$ 0,00 geram lançamentos na comissão recebida.
            </li>
            <li>
              <strong>Idempotência garantida:</strong> Nenhuma linha de extrato é baixada em
              duplicidade, mesmo se o arquivo for enviado repetidamente.
            </li>
            <li>
              <strong>Comissões legadas:</strong> Caso receba comissões de apólices não cadastradas,
              o sistema permite registrar como receita legada sem necessidade de cadastros
              retroativos.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
