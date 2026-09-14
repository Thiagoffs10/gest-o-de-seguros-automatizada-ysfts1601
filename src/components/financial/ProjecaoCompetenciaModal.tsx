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
import { formatCurrency } from '@/lib/utils'
import { Calendar, Search, ChevronLeft, ChevronRight } from 'lucide-react'

export interface CompetenciaProjecaoItem {
  id: string
  propostaNumero: string
  apoliceNumero?: string
  clienteNome: string
  seguradoraNome: string
  produtoNome: string
  competencia: string
  valorPrevisto: number
  valorRecebido: number
  saldoPrevisto: number
  origem: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  competencia: string | null
  items: CompetenciaProjecaoItem[]
  totalPrevistoCompetencia: number
}

const PAGE_SIZE = 10

export function ProjecaoCompetenciaModal({
  open,
  onOpenChange,
  competencia,
  items,
  totalPrevistoCompetencia,
}: Props) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const rows = useMemo(() => {
    if (!competencia) return []
    return items.filter((it) => it.competencia === competencia)
  }, [competencia, items])

  const totals = useMemo(() => {
    const totalPrev = Math.round(rows.reduce((sum, r) => sum + r.valorPrevisto, 0) * 100) / 100
    const totalRec = Math.round(rows.reduce((sum, r) => sum + r.valorRecebido, 0) * 100) / 100
    const totalSaldo = Math.round(rows.reduce((sum, r) => sum + r.saldoPrevisto, 0) * 100) / 100
    return { totalPrev, totalRec, totalSaldo }
  }, [rows])

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        r.propostaNumero.toLowerCase().includes(q) ||
        (r.apoliceNumero || '').toLowerCase().includes(q) ||
        r.clienteNome.toLowerCase().includes(q) ||
        r.seguradoraNome.toLowerCase().includes(q) ||
        r.produtoNome.toLowerCase().includes(q),
    )
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
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Projeção de Recebimentos — Competência {competencia}
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Previsões de comissão em aberto com vencimento/competência prevista para{' '}
                {competencia}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
          <div className="p-2.5 rounded-lg border bg-slate-50 border-slate-200 text-xs">
            <span className="text-slate-500 block">Total Previsto na Competência</span>
            <strong className="text-slate-900 text-sm">
              R$ {formatCurrency(totals.totalPrev)}
            </strong>
          </div>
          <div className="p-2.5 rounded-lg border bg-emerald-50 border-emerald-200 text-xs">
            <span className="text-emerald-700 block">Já Recebido</span>
            <strong className="text-emerald-800 text-sm">
              R$ {formatCurrency(totals.totalRec)}
            </strong>
          </div>
          <div className="p-2.5 rounded-lg border bg-blue-50/80 border-blue-300 shadow-xs text-xs">
            <span className="text-blue-800 font-semibold block">Saldo Previsto a Receber</span>
            <strong className="text-blue-900 text-base">
              R$ {formatCurrency(totals.totalSaldo)}
            </strong>
          </div>
        </div>

        {/* Busca */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
            <Input
              placeholder="Buscar por Proposta, Cliente, Seguradora..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-8 text-xs h-8 bg-white"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Previsões encontradas: <strong>{rows.length}</strong> registro(s)
          </span>
        </div>

        {/* Tabela de Previsões da Competência */}
        <div className="overflow-x-auto border rounded-lg flex-1 min-h-[220px]">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b sticky top-0 z-10">
              <tr>
                <th className="p-2.5">Proposta</th>
                <th className="p-2.5">Cliente</th>
                <th className="p-2.5">Seguradora</th>
                <th className="p-2.5">Produto</th>
                <th className="p-2.5 text-right">Previsão</th>
                <th className="p-2.5 text-right text-emerald-800">Já Recebido</th>
                <th className="p-2.5 text-right font-bold text-blue-900 bg-blue-100/60">
                  Saldo Previsto
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-slate-500">
                    Nenhuma previsão cadastrada para esta competência.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="p-2.5 font-bold text-slate-900">
                      <div className="flex flex-col">
                        <span>{r.propostaNumero}</span>
                        {r.apoliceNumero && r.apoliceNumero !== r.propostaNumero && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            Apólice: {r.apoliceNumero}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5 font-medium text-slate-900 max-w-[160px] truncate">
                      {r.clienteNome}
                    </td>
                    <td className="p-2.5 text-slate-700">{r.seguradoraNome}</td>
                    <td className="p-2.5 text-slate-700">{r.produtoNome}</td>
                    <td className="p-2.5 text-right font-medium text-slate-900">
                      R$ {formatCurrency(r.valorPrevisto)}
                    </td>
                    <td className="p-2.5 text-right font-semibold text-emerald-700">
                      R$ {formatCurrency(r.valorRecebido)}
                    </td>
                    <td className="p-2.5 text-right font-bold text-blue-800 bg-blue-50/50">
                      R$ {formatCurrency(r.saldoPrevisto)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t sticky bottom-0 z-10 text-slate-900">
              <tr>
                <td className="p-2.5" colSpan={4}>
                  Total da Competência ({rows.length} previsões)
                </td>
                <td className="p-2.5 text-right">R$ {formatCurrency(totals.totalPrev)}</td>
                <td className="p-2.5 text-right text-emerald-800">
                  R$ {formatCurrency(totals.totalRec)}
                </td>
                <td className="p-2.5 text-right text-blue-900 bg-blue-200/70 text-sm font-extrabold">
                  R$ {formatCurrency(totals.totalSaldo)}
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
