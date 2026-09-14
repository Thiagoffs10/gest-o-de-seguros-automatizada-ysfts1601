import { useMemo, useState } from 'react'
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
import { FileText, Search, ChevronLeft, ChevronRight } from 'lucide-react'

export type ProducaoDetailType =
  | 'premio_liquido'
  | 'comissao_bruta'
  | 'iss_deducoes'
  | 'comissao_liquida'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: ProducaoDetailType | null
  policies: Policy[]
  periodLabel: string
}

const PAGE_SIZE = 10

export function ProducaoDetailModal({ open, onOpenChange, type, policies, periodLabel }: Props) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const meta = useMemo(() => {
    switch (type) {
      case 'premio_liquido':
        return {
          title: 'Detalhamento: Prêmio Líquido Vendido',
          subtitle: `Vendas correspondentes ao período (${periodLabel})`,
          highlightCol: 'premio',
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
    const totalBruta = Math.round(rows.reduce((sum, r) => sum + r.comissaoBruta, 0) * 100) / 100
    const totalIss = Math.round(rows.reduce((sum, r) => sum + r.iss, 0) * 100) / 100
    const totalLiquida = Math.round(rows.reduce((sum, r) => sum + r.comissaoLiquida, 0) * 100) / 100
    return { totalPremio, totalBruta, totalIss, totalLiquida }
  }, [rows])

  // Filtro de busca local
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
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
  }, [rows, search])

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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[88vh] flex flex-col p-6">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">{meta.title}</DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">{meta.subtitle}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Resumo Consolidado com destaque */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          <div
            className={`p-2.5 rounded-lg border text-xs ${
              meta.highlightCol === 'premio'
                ? 'bg-blue-50/80 border-blue-300 shadow-xs'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-slate-500 block">Prêmio Líquido Vendido</span>
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
            <span className="text-slate-500 block">Comissão Bruta Prevista</span>
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
              meta.highlightCol === 'liquida'
                ? 'bg-emerald-50/80 border-emerald-400 shadow-xs ring-1 ring-emerald-300'
                : 'bg-emerald-50/40 border-emerald-200'
            }`}
          >
            <span className="text-slate-500 block font-medium">Comissão Líquida Prevista</span>
            <strong className="text-emerald-700 text-base">
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
                  <td colSpan={9} className="text-center p-8 text-slate-500">
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
