import { useMemo, useState } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Policy } from '@/types'
import { formatCurrency, formatDateDisplay } from '@/lib/utils'
import { formatClientDocument } from '@/lib/document-validators'
import { FileText, Search, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react'
import {
  exportFinancialListingPDF,
  slugifyFilename,
  ActiveFiltersContext,
} from '@/lib/financial-pdf'

export type ProducaoDetailType =
  | 'premio_liquido'
  | 'premio_bruto'
  | 'comissao_bruta'
  | 'iss_deducoes'
  | 'comissao_liquida'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: ProducaoDetailType | null
  policies: Policy[]
  periodLabel: string
  filtersContext?: ActiveFiltersContext
}

const PAGE_SIZE = 10

export function ProducaoDetailModal({
  open,
  onOpenChange,
  type,
  policies,
  periodLabel,
  filtersContext,
}: Props) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [page, setPage] = useState(1)
  const [isExporting, setIsExporting] = useState(false)

  const meta = useMemo(() => {
    switch (type) {
      case 'premio_liquido':
        return {
          title: 'Detalhamento: Prêmio Líquido Vendido',
          subtitle: `Vendas correspondentes ao período (${periodLabel}) — Base líquida de cálculo`,
          highlightCol: 'premio',
        }
      case 'premio_bruto':
        return {
          title: 'Detalhamento: Prêmio Bruto Vendido',
          subtitle: `Vendas correspondentes ao período (${periodLabel}) — Valor total bruto comercializado`,
          highlightCol: 'premio_bruto',
        }
      case 'comissao_bruta':
        return {
          title: 'Detalhamento: Comissão Bruta Prevista',
          subtitle: `Comissão bruta gerada pelas vendas do período (${periodLabel}) antes de deduções`,
          highlightCol: 'bruta',
        }
      case 'iss_deducoes':
        return {
          title: 'Detalhamento: ISS / Deduções Previstas',
          subtitle: `Total das deduções aplicáveis sobre a comissão do período (${periodLabel})`,
          highlightCol: 'iss',
        }
      case 'comissao_liquida':
      default:
        return {
          title: 'Detalhamento: Comissão Líquida Prevista',
          subtitle: `Comissão líquida prevista (Bruta - ISS/Deduções) das vendas do período (${periodLabel})`,
          highlightCol: 'liquida',
        }
    }
  }, [type, periodLabel])

  // Normalização das linhas com os mesmos cálculos que o card
  const rows = useMemo(() => {
    return policies.map((p) => {
      const premioLiquido = Number(p.valor_liquido || p.premium_amount || 0)
      const premioBruto = Number(p.valor_bruto != null ? p.valor_bruto : p.premium_amount || 0)
      const commissionPercent = Number(p.commission_percent || 0)
      const comissaoBruta =
        p.commission != null
          ? Number(p.commission)
          : Math.round(((premioLiquido * commissionPercent) / 100) * 100) / 100
      const iss = Number(p.iss || 0)
      const comissaoLiquida = Math.max(0, Math.round((comissaoBruta - iss) * 100) / 100)

      const cliente = p.expand?.client
      const clienteNome = cliente?.name || 'Cliente Não Informado'
      const doc = cliente ? formatClientDocument(cliente) : '-'
      const seguradoraNome = p.expand?.seguradora?.nome || p.insurance_company || '-'
      const produtoNome =
        (p as any).expand?.produto?.nome || p.tipo_de_seguro || p.coverage_type || '-'
      const proposta = p.numero_proposta || p.policy_number || '-'
      const apolice = p.policy_number || ''

      return {
        id: p.id,
        proposta,
        apolice,
        clienteNome,
        documento: doc,
        seguradoraNome,
        produtoNome,
        premioLiquido,
        premioBruto,
        comissaoBruta,
        iss,
        comissaoLiquida,
        startDate: p.start_date,
      }
    })
  }, [policies])

  // Totais exatos da lista completa (sem filtro de busca)
  const totals = useMemo(() => {
    const totalPremio = Math.round(rows.reduce((sum, r) => sum + r.premioLiquido, 0) * 100) / 100
    const totalPremioBruto = Math.round(rows.reduce((sum, r) => sum + r.premioBruto, 0) * 100) / 100
    const totalBruta = Math.round(rows.reduce((sum, r) => sum + r.comissaoBruta, 0) * 100) / 100
    const totalIss = Math.round(rows.reduce((sum, r) => sum + r.iss, 0) * 100) / 100
    const totalLiquida = Math.round(rows.reduce((sum, r) => sum + r.comissaoLiquida, 0) * 100) / 100
    return { totalPremio, totalPremioBruto, totalBruta, totalIss, totalLiquida }
  }, [rows])

  // Filtro de busca local com debounce
  const filteredRows = useMemo(() => {
    if (!debouncedSearch.trim()) return rows
    const q = debouncedSearch.trim().toLowerCase()
    return rows.filter((r) => {
      return (
        r.proposta.toLowerCase().includes(q) ||
        r.apolice.toLowerCase().includes(q) ||
        r.clienteNome.toLowerCase().includes(q) ||
        r.documento.toLowerCase().includes(q) ||
        r.seguradoraNome.toLowerCase().includes(q) ||
        r.produtoNome.toLowerCase().includes(q)
      )
    })
  }, [rows, debouncedSearch])

  // Totais das linhas filtradas (para refletir a busca no consolidado)
  const filteredTotals = useMemo(() => {
    return {
      totalPremio:
        Math.round(filteredRows.reduce((sum, r) => sum + r.premioLiquido, 0) * 100) / 100,
      totalPremioBruto:
        Math.round(filteredRows.reduce((sum, r) => sum + r.premioBruto, 0) * 100) / 100,
      totalBruta: Math.round(filteredRows.reduce((sum, r) => sum + r.comissaoBruta, 0) * 100) / 100,
      totalIss: Math.round(filteredRows.reduce((sum, r) => sum + r.iss, 0) * 100) / 100,
      totalLiquida:
        Math.round(filteredRows.reduce((sum, r) => sum + r.comissaoLiquida, 0) * 100) / 100,
    }
  }, [filteredRows])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredRows.slice(start, start + PAGE_SIZE)
  }, [filteredRows, page])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearch('')
      setPage(1)
    }
    onOpenChange(nextOpen)
  }

  const handleExportPDF = async () => {
    try {
      setIsExporting(true)
      const isFiltered = Boolean(search.trim())
      const baseTotals = isFiltered ? filteredTotals : totals

      const filenameMap: Record<ProducaoDetailType, string> = {
        premio_liquido: 'producao-premio-liquido-vendido',
        premio_bruto: 'producao-premio-bruto-vendido',
        comissao_bruta: 'producao-comissao-bruta-prevista',
        iss_deducoes: 'producao-iss-deducoes-previstas',
        comissao_liquida: 'producao-comissao-liquida-prevista',
      }
      const filePrefix = type ? filenameMap[type] : 'producao-detalhamento'

      await exportFinancialListingPDF({
        title: meta.title,
        subtitle: meta.subtitle,
        periodLabel,
        orientation: 'landscape',
        filename: slugifyFilename(filePrefix, periodLabel),
        filters: {
          periodo: periodLabel,
          ...filtersContext,
          busca: search.trim() || undefined,
        },
        summaryCards: [
          {
            label: 'Prêmio Líquido Vendido',
            value: `R$ ${formatCurrency(baseTotals.totalPremio)}`,
            highlight: meta.highlightCol === 'premio',
            variant: meta.highlightCol === 'premio' ? 'blue' : 'default',
          },
          {
            label: 'Comissão Bruta Prevista',
            value: `R$ ${formatCurrency(baseTotals.totalBruta)}`,
            highlight: meta.highlightCol === 'bruta',
            variant: meta.highlightCol === 'bruta' ? 'blue' : 'default',
          },
          {
            label: 'ISS / Deduções',
            value: `R$ ${formatCurrency(baseTotals.totalIss)}`,
            highlight: meta.highlightCol === 'iss',
            variant: meta.highlightCol === 'iss' ? 'amber' : 'default',
          },
          {
            label: 'Prêmio Bruto Vendido',
            value: `R$ ${formatCurrency(baseTotals.totalPremioBruto)}`,
            highlight: meta.highlightCol === 'premio_bruto',
            variant: meta.highlightCol === 'premio_bruto' ? 'blue' : 'default',
          },
          {
            label: 'Comissão Líquida Prevista',
            value: `R$ ${formatCurrency(baseTotals.totalLiquida)}`,
            highlight: meta.highlightCol === 'liquida',
            variant: 'green',
          },
        ],
        columns: [
          { header: 'Proposta', dataKey: 'propostaFormatada', align: 'left' },
          { header: 'Cliente', dataKey: 'clienteNome', align: 'left' },
          { header: 'CPF / CNPJ', dataKey: 'documento', align: 'left' },
          { header: 'Seguradora', dataKey: 'seguradoraNome', align: 'left' },
          { header: 'Produto', dataKey: 'produtoNome', align: 'left' },
          { header: 'Prêmio Líquido', dataKey: 'premioLiquidoFmt', align: 'right' },
          { header: 'Prêmio Bruto', dataKey: 'premioBrutoFmt', align: 'right' },
          { header: 'Comissão Bruta', dataKey: 'comissaoBrutaFmt', align: 'right' },
          { header: 'ISS / Deduções', dataKey: 'issFmt', align: 'right' },
          { header: 'Comissão Líquida', dataKey: 'comissaoLiquidaFmt', align: 'right' },
        ],
        rows: filteredRows.map((r) => ({
          propostaFormatada:
            r.apolice && r.apolice !== r.proposta
              ? `${r.proposta}\n(Ap: ${r.apolice})`
              : r.proposta,
          clienteNome: r.clienteNome,
          documento: r.documento,
          seguradoraNome: r.seguradoraNome,
          produtoNome: r.produtoNome,
          premioLiquidoFmt: `R$ ${formatCurrency(r.premioLiquido)}`,
          premioBrutoFmt: `R$ ${formatCurrency(r.premioBruto)}`,
          comissaoBrutaFmt: `R$ ${formatCurrency(r.comissaoBruta)}`,
          issFmt: r.iss > 0 ? `R$ ${formatCurrency(r.iss)}` : '-',
          comissaoLiquidaFmt: `R$ ${formatCurrency(r.comissaoLiquida)}`,
        })),
        totalRow: {
          propostaFormatada: `Total Consolidado (${filteredRows.length} ${filteredRows.length === 1 ? 'venda' : 'vendas'})`,
          clienteNome: '',
          documento: '',
          seguradoraNome: '',
          produtoNome: '',
          premioLiquidoFmt: `R$ ${formatCurrency(baseTotals.totalPremio)}`,
          premioBrutoFmt: `R$ ${formatCurrency(baseTotals.totalPremioBruto)}`,
          comissaoBrutaFmt: `R$ ${formatCurrency(baseTotals.totalBruta)}`,
          issFmt: `R$ ${formatCurrency(baseTotals.totalIss)}`,
          comissaoLiquidaFmt: `R$ ${formatCurrency(baseTotals.totalLiquida)}`,
        },
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[88vh] flex flex-col p-6">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {meta.title}
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">{meta.subtitle}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={isExporting || rows.length === 0}
              className="h-8 px-2.5 text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-blue-600 shrink-0 gap-1.5 shadow-2xs"
              title="Exportar listagem completa em PDF para conferência e auditoria"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>Exportar PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Resumo Consolidado com destaque */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
          <div
            className={`p-2.5 rounded-lg border text-xs ${
              meta.highlightCol === 'premio'
                ? 'bg-blue-50/80 border-blue-300 shadow-xs'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-slate-500 block">Prêmio Líquido</span>
            <strong className="text-slate-900 text-sm">
              R$ {formatCurrency(totals.totalPremio)}
            </strong>
          </div>
          <div
            className={`p-2.5 rounded-lg border text-xs ${
              meta.highlightCol === 'bruta'
                ? 'bg-blue-50/80 border-blue-300 shadow-xs'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-slate-500 block">Comissão Bruta</span>
            <strong className="text-slate-900 text-sm">
              R$ {formatCurrency(totals.totalBruta)}
            </strong>
          </div>
          <div
            className={`p-2.5 rounded-lg border text-xs ${
              meta.highlightCol === 'iss'
                ? 'bg-amber-50/80 border-amber-300 shadow-xs'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-slate-500 block">ISS / Deduções</span>
            <strong className="text-amber-700 text-sm">R$ {formatCurrency(totals.totalIss)}</strong>
          </div>
          <div
            className={`p-2.5 rounded-lg border text-xs ${
              meta.highlightCol === 'premio_bruto'
                ? 'bg-blue-50/80 border-blue-300 shadow-xs'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-slate-500 block">Prêmio Bruto</span>
            <strong className="text-slate-900 text-sm">
              R$ {formatCurrency(totals.totalPremioBruto)}
            </strong>
          </div>
          <div
            className={`p-2.5 rounded-lg border text-xs ${
              meta.highlightCol === 'liquida'
                ? 'bg-emerald-50/80 border-emerald-400 shadow-xs ring-1 ring-emerald-300'
                : 'bg-emerald-50/40 border-emerald-200'
            }`}
          >
            <span className="text-slate-500 block font-medium">Comissão Líquida</span>
            <strong className="text-emerald-700 text-sm sm:text-base">
              R$ {formatCurrency(totals.totalLiquida)}
            </strong>
          </div>
        </div>

        {/* Barra de busca e totalizador */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
            <Input
              placeholder="Buscar por Proposta, Cliente, Documento, Seguradora..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-8 text-xs h-8 bg-white"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total de vendas no período: <strong>{rows.length}</strong> registro(s)
          </span>
        </div>

        {/* Tabela de composição exata da Produção */}
        <div className="overflow-x-auto border rounded-lg flex-1 min-h-[220px]">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b sticky top-0 z-10">
              <tr>
                <th className="p-2.5">Proposta</th>
                <th className="p-2.5">Cliente</th>
                <th className="p-2.5">CPF / CNPJ</th>
                <th className="p-2.5">Seguradora</th>
                <th className="p-2.5">Produto</th>
                <th
                  className={`p-2.5 text-right ${
                    meta.highlightCol === 'premio' ? 'bg-blue-100/60 font-bold' : ''
                  }`}
                >
                  Prêmio Líquido
                </th>
                <th
                  className={`p-2.5 text-right ${
                    meta.highlightCol === 'premio_bruto' ? 'bg-blue-100/60 font-bold' : ''
                  }`}
                >
                  Prêmio Bruto
                </th>
                <th
                  className={`p-2.5 text-right ${
                    meta.highlightCol === 'bruta' ? 'bg-blue-100/60 font-bold' : ''
                  }`}
                >
                  Comissão Bruta
                </th>
                <th
                  className={`p-2.5 text-right ${
                    meta.highlightCol === 'iss' ? 'bg-amber-100/60 font-bold' : ''
                  }`}
                >
                  ISS / Deduções
                </th>
                <th
                  className={`p-2.5 text-right ${
                    meta.highlightCol === 'liquida'
                      ? 'bg-emerald-100/70 font-bold text-emerald-800'
                      : ''
                  }`}
                >
                  Comissão Líquida
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center p-8 text-slate-500">
                    Nenhum registro encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="p-2.5 font-bold text-slate-900">
                      <div className="flex flex-col">
                        <span>{r.proposta}</span>
                        {r.apolice && r.apolice !== r.proposta && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            Apólice: {r.apolice}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5 font-medium text-slate-900 max-w-[160px] truncate">
                      {r.clienteNome}
                    </td>
                    <td className="p-2.5 font-mono text-[11px] text-slate-600">{r.documento}</td>
                    <td className="p-2.5 text-slate-700">{r.seguradoraNome}</td>
                    <td className="p-2.5 text-slate-700">{r.produtoNome}</td>
                    <td
                      className={`p-2.5 text-right font-medium ${
                        meta.highlightCol === 'premio'
                          ? 'bg-blue-50/50 font-bold text-blue-900'
                          : ''
                      }`}
                    >
                      R$ {formatCurrency(r.premioLiquido)}
                    </td>
                    <td
                      className={`p-2.5 text-right font-medium ${
                        meta.highlightCol === 'premio_bruto'
                          ? 'bg-blue-50/50 font-bold text-blue-900'
                          : ''
                      }`}
                    >
                      R$ {formatCurrency(r.premioBruto)}
                    </td>
                    <td
                      className={`p-2.5 text-right font-medium ${
                        meta.highlightCol === 'bruta'
                          ? 'bg-blue-50/50 font-bold text-blue-900'
                          : 'text-slate-800'
                      }`}
                    >
                      R$ {formatCurrency(r.comissaoBruta)}
                    </td>
                    <td
                      className={`p-2.5 text-right ${
                        meta.highlightCol === 'iss'
                          ? 'bg-amber-50/60 font-bold text-amber-800'
                          : 'text-slate-500'
                      }`}
                    >
                      {r.iss > 0 ? `R$ ${formatCurrency(r.iss)}` : '-'}
                    </td>
                    <td
                      className={`p-2.5 text-right font-bold ${
                        meta.highlightCol === 'liquida'
                          ? 'bg-emerald-50/70 text-emerald-800 font-extrabold'
                          : 'text-emerald-700'
                      }`}
                    >
                      R$ {formatCurrency(r.comissaoLiquida)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-100/90 font-bold border-t sticky bottom-0 z-10 text-slate-900">
              <tr>
                <td className="p-2.5" colSpan={5}>
                  Total Consolidado ({rows.length} vendas do período)
                </td>
                <td
                  className={`p-2.5 text-right ${
                    meta.highlightCol === 'premio' ? 'bg-blue-200/60 font-extrabold' : ''
                  }`}
                >
                  R$ {formatCurrency(totals.totalPremio)}
                </td>
                <td
                  className={`p-2.5 text-right ${
                    meta.highlightCol === 'premio_bruto' ? 'bg-blue-200/60 font-extrabold' : ''
                  }`}
                >
                  R$ {formatCurrency(totals.totalPremioBruto)}
                </td>
                <td
                  className={`p-2.5 text-right ${
                    meta.highlightCol === 'bruta' ? 'bg-blue-200/60 font-extrabold' : ''
                  }`}
                >
                  R$ {formatCurrency(totals.totalBruta)}
                </td>
                <td
                  className={`p-2.5 text-right text-amber-800 ${
                    meta.highlightCol === 'iss' ? 'bg-amber-200/60 font-extrabold' : ''
                  }`}
                >
                  R$ {formatCurrency(totals.totalIss)}
                </td>
                <td
                  className={`p-2.5 text-right text-emerald-800 ${
                    meta.highlightCol === 'liquida'
                      ? 'bg-emerald-200/70 font-extrabold text-sm'
                      : ''
                  }`}
                >
                  R$ {formatCurrency(totals.totalLiquida)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 pt-2">
            <span>
              Exibindo {(page - 1) * PAGE_SIZE + 1} a{' '}
              {Math.min(page * PAGE_SIZE, filteredRows.length)} de {filteredRows.length} registros
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Anterior
              </Button>
              <span className="font-semibold px-1">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="pt-2 border-t mt-2">
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
