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
import { Policy, ComissaoRecebimento } from '@/types'
import { formatCurrency, formatDateDisplay } from '@/lib/utils'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
} from 'lucide-react'

export type RecebimentoDetailType =
  | 'recebida'
  | 'parcial'
  | 'nao_recebida'
  | 'saldo_total'
  | 'sem_previsao'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: RecebimentoDetailType | null
  periodLabel: string
  // Dados de recebimentos do período (para tipo 'recebida')
  recsInPeriod: ComissaoRecebimento[]
  allPolicies: Policy[]
  // Dados das vendas do período para saldo parcial, pendente e saldo total
  periodStartPolicies: Policy[]
  receivedGrossByPolicy: Map<string, number>
  lastReceiptDateByPolicy: Map<string, string>
  // Breakdown oficial do card recebida
  systemReceivedCommissions: number
  legacyReceivedCommissions: number
}

const PAGE_SIZE = 10

export function RecebimentoDetailModal({
  open,
  onOpenChange,
  type,
  periodLabel,
  recsInPeriod,
  allPolicies,
  periodStartPolicies,
  receivedGrossByPolicy,
  lastReceiptDateByPolicy,
  systemReceivedCommissions,
  legacyReceivedCommissions,
}: Props) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const meta = useMemo(() => {
    switch (type) {
      case 'recebida':
        return {
          title: 'Detalhamento: Comissão Recebida no Período',
          subtitle: `Movimentações e recebimentos com data de baixa em ${periodLabel}`,
          mode: 'movimentos' as const,
        }
      case 'parcial':
        return {
          title: 'Detalhamento: Saldo de Comissões Parcialmente Recebidas',
          subtitle: `Vendas de ${periodLabel} com baixa parcial e saldo residual a receber`,
          mode: 'propostas' as const,
        }
      case 'nao_recebida':
        return {
          title: 'Detalhamento: Comissões Ainda Não Recebidas (Pendentes)',
          subtitle: `Vendas de ${periodLabel} para as quais ainda não ocorreu nenhum recebimento`,
          mode: 'propostas' as const,
        }
      case 'sem_previsao':
        return {
          title: 'Detalhamento: Saldo Sem Previsão Definida',
          subtitle: `Vendas de ${periodLabel} com saldo residual sem parcelas de comissão previstas`,
          mode: 'propostas' as const,
        }
      case 'saldo_total':
      default:
        return {
          title: 'Detalhamento: Saldo Total de Comissões a Receber',
          subtitle: `Total pendente das vendas de ${periodLabel} (Resíduos parciais + Pendentes integrais)`,
          mode: 'propostas' as const,
        }
    }
  }, [type, periodLabel])

  // Normalização para o modo MOVIMENTOS (Comissão Recebida)
  // Ordem de colunas requerida: Proposta | Cliente | Seguradora | Produção | Data do Recebimento | Valor Recebido | Saldo
  const movimentosRows = useMemo(() => {
    if (type !== 'recebida') return []
    const policyMap = new Map<string, Policy>()
    allPolicies.forEach((p) => policyMap.set(p.id, p))

    return recsInPeriod.map((r) => {
      const policy = policyMap.get(r.policy)
      const proposta = policy?.numero_proposta || policy?.policy_number || '-'
      const apolice = policy?.policy_number || ''
      const clienteNome = policy?.expand?.client?.name || 'Cliente Não Informado'
      const seguradoraNome = policy?.expand?.seguradora?.nome || policy?.insurance_company || '-'
      const valorBruto = Number(r.valor_bruto || 0)
      const deducoes = Number(r.descontos_impostos || 0)
      const valorLiquido = r.valor_liquido != null ? Number(r.valor_liquido) : valorBruto - deducoes

      // Produção da venda = mês/ano de início da vigência (start_date)
      let producaoLabel = '-'
      if (policy?.start_date) {
        const parts = policy.start_date.split('T')[0].split('-')
        if (parts.length >= 2) {
          const m = parseInt(parts[1], 10)
          const y = parts[0].slice(-2)
          const months = [
            'Jan',
            'Fev',
            'Mar',
            'Abr',
            'Mai',
            'Jun',
            'Jul',
            'Ago',
            'Set',
            'Out',
            'Nov',
            'Dez',
          ]
          producaoLabel = `${months[m - 1]}/${y}`
        }
      }

      // Saldo da apólice
      const previsto = policy
        ? policy.commission != null
          ? Number(policy.commission)
          : Math.round(
              (((policy.valor_liquido || policy.premium_amount || 0) *
                (policy.commission_percent || 0)) /
                100) *
                100,
            ) / 100
        : 0
      const recAcumulado = policy
        ? (receivedGrossByPolicy.get(policy.id) ?? (policy.comissao_recebida ? previsto : 0))
        : 0
      const saldoApolice = Math.max(0, Math.round((previsto - recAcumulado) * 100) / 100)

      return {
        id: r.id,
        proposta,
        apolice,
        clienteNome,
        seguradoraNome,
        producaoLabel,
        dataRecebimento: r.data_recebimento,
        competencia: r.competencia || '-',
        origem: r.origem || 'Sistema',
        isEstorno: Boolean(r.is_estorno),
        valorBruto,
        deducoes,
        valorLiquido,
        saldoApolice,
        observacao: r.observacao || '',
      }
    })
  }, [type, recsInPeriod, allPolicies, receivedGrossByPolicy])

  // Normalização para o modo PROPOSTAS (Parciais, Não Recebidas, Saldo Total)
  const propostasRows = useMemo(() => {
    if (type === 'recebida') return []

    return periodStartPolicies
      .map((p) => {
        const previsto =
          p.commission != null
            ? Number(p.commission)
            : Math.round(
                (((p.valor_liquido || p.premium_amount || 0) * (p.commission_percent || 0)) / 100) *
                  100,
              ) / 100
        const rec = receivedGrossByPolicy.get(p.id) ?? (p.comissao_recebida ? previsto : 0)
        const saldo = Math.max(0, Math.round((previsto - rec) * 100) / 100)
        const isSettled = saldo <= 0.009
        const isPartial = !isSettled && rec > 0.009
        const isPending = !isSettled && rec <= 0.009

        const proposta = p.numero_proposta || p.policy_number || '-'
        const apolice = p.policy_number || ''
        const clienteNome = p.expand?.client?.name || 'Cliente Não Informado'
        const seguradoraNome = p.expand?.seguradora?.nome || p.insurance_company || '-'
        const ultimoRecebimento = lastReceiptDateByPolicy.get(p.id) || p.data_recebimento_comissao

        let statusText: 'Pendente' | 'Parcial' | 'Recebida' = 'Pendente'
        if (isSettled) statusText = 'Recebida'
        else if (isPartial) statusText = 'Parcial'

        return {
          id: p.id,
          proposta,
          apolice,
          clienteNome,
          seguradoraNome,
          previsto,
          rec,
          saldo,
          statusText,
          isSettled,
          isPartial,
          isPending,
          ultimoRecebimento,
        }
      })
      .filter((row) => {
        if (type === 'parcial') return row.isPartial
        if (type === 'nao_recebida') return row.isPending
        if (type === 'saldo_total') return row.saldo > 0
        if (type === 'sem_previsao') return row.saldo > 0
        return true
      })
  }, [type, periodStartPolicies, receivedGrossByPolicy, lastReceiptDateByPolicy])

  // Totais do modo Movimentos
  const totalMovimentos = useMemo(() => {
    const totalLiquido =
      Math.round(movimentosRows.reduce((sum, r) => sum + r.valorLiquido, 0) * 100) / 100
    const totalBruto =
      Math.round(movimentosRows.reduce((sum, r) => sum + r.valorBruto, 0) * 100) / 100
    return { totalLiquido, totalBruto }
  }, [movimentosRows])

  // Totais do modo Propostas
  const totalPropostas = useMemo(() => {
    const totalPrevisto =
      Math.round(propostasRows.reduce((sum, r) => sum + r.previsto, 0) * 100) / 100
    const totalRecebido = Math.round(propostasRows.reduce((sum, r) => sum + r.rec, 0) * 100) / 100
    const totalSaldo = Math.round(propostasRows.reduce((sum, r) => sum + r.saldo, 0) * 100) / 100
    return { totalPrevisto, totalRecebido, totalSaldo }
  }, [propostasRows])

  // Filtro de busca local
  const filteredMovimentos = useMemo(() => {
    if (!search.trim()) return movimentosRows
    const q = search.trim().toLowerCase()
    return movimentosRows.filter(
      (r) =>
        r.proposta.toLowerCase().includes(q) ||
        r.apolice.toLowerCase().includes(q) ||
        r.clienteNome.toLowerCase().includes(q) ||
        r.seguradoraNome.toLowerCase().includes(q) ||
        r.origem.toLowerCase().includes(q),
    )
  }, [movimentosRows, search])

  const filteredPropostas = useMemo(() => {
    if (!search.trim()) return propostasRows
    const q = search.trim().toLowerCase()
    return propostasRows.filter(
      (r) =>
        r.proposta.toLowerCase().includes(q) ||
        r.apolice.toLowerCase().includes(q) ||
        r.clienteNome.toLowerCase().includes(q) ||
        r.seguradoraNome.toLowerCase().includes(q),
    )
  }, [propostasRows, search])

  const activeRowsCount =
    meta.mode === 'movimentos' ? filteredMovimentos.length : filteredPropostas.length
  const totalPages = Math.max(1, Math.ceil(activeRowsCount / PAGE_SIZE))

  const paginatedMovimentos = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredMovimentos.slice(start, start + PAGE_SIZE)
  }, [filteredMovimentos, page])

  const paginatedPropostas = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredPropostas.slice(start, start + PAGE_SIZE)
  }, [filteredPropostas, page])

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
            {type === 'recebida' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : type === 'parcial' ? (
              <Clock className="w-5 h-5 text-blue-600" />
            ) : type === 'nao_recebida' ? (
              <AlertCircle className="w-5 h-5 text-amber-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-amber-700" />
            )}
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">{meta.title}</DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">{meta.subtitle}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Resumo do cabeçalho */}
        {type === 'recebida' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <div className="p-2.5 rounded-lg border bg-emerald-50/80 border-emerald-300 shadow-xs">
              <span className="text-emerald-800 text-xs font-semibold block">
                Total Recebido no Mês
              </span>
              <strong className="text-emerald-900 text-lg">
                R${' '}
                {formatCurrency(
                  Math.round((systemReceivedCommissions + legacyReceivedCommissions) * 100) / 100,
                )}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg border bg-slate-50 border-slate-200 text-xs">
              <span className="text-slate-500 block">Baixado no Sistema</span>
              <strong className="text-slate-800 text-sm">
                R$ {formatCurrency(systemReceivedCommissions)}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg border bg-slate-50 border-slate-200 text-xs">
              <span className="text-slate-500 block">Histórico Legado Importado</span>
              <strong className="text-slate-800 text-sm">
                R$ {formatCurrency(legacyReceivedCommissions)}
              </strong>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <div className="p-2.5 rounded-lg border bg-slate-50 border-slate-200 text-xs">
              <span className="text-slate-500 block">Previsto Total das Vendas</span>
              <strong className="text-slate-800 text-sm">
                R$ {formatCurrency(totalPropostas.totalPrevisto)}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg border bg-emerald-50 border-emerald-200 text-xs">
              <span className="text-emerald-700 block">Já Recebido</span>
              <strong className="text-emerald-800 text-sm">
                R$ {formatCurrency(totalPropostas.totalRecebido)}
              </strong>
            </div>
            <div
              className={`p-2.5 rounded-lg border text-xs ${
                type === 'parcial' ? 'bg-blue-50 border-blue-300' : 'bg-amber-50 border-amber-300'
              }`}
            >
              <span
                className={`block font-semibold ${
                  type === 'parcial' ? 'text-blue-800' : 'text-amber-800'
                }`}
              >
                {type === 'parcial'
                  ? 'Saldo Parcial Residual'
                  : type === 'nao_recebida'
                    ? 'Total Não Recebido'
                    : 'Saldo Total a Receber'}
              </span>
              <strong
                className={`text-base ${type === 'parcial' ? 'text-blue-900' : 'text-amber-900'}`}
              >
                R$ {formatCurrency(totalPropostas.totalSaldo)}
              </strong>
            </div>
          </div>
        )}

        {/* Busca e contador */}
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
            Total de registros:{' '}
            <strong>
              {meta.mode === 'movimentos' ? movimentosRows.length : propostasRows.length}
            </strong>
          </span>
        </div>

        {/* TABELA MODO MOVIMENTOS (Comissão Recebida) */}
        {meta.mode === 'movimentos' ? (
          <div className="overflow-x-auto border rounded-lg flex-1 min-h-[220px]">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b sticky top-0 z-10">
                <tr>
                  <th className="p-2.5">Proposta</th>
                  <th className="p-2.5">Cliente</th>
                  <th className="p-2.5">Seguradora</th>
                  <th className="p-2.5">Produção</th>
                  <th className="p-2.5">Data do Recebimento</th>
                  <th className="p-2.5 text-right font-bold text-emerald-800 bg-emerald-100/60">
                    Valor Recebido
                  </th>
                  <th className="p-2.5 text-right font-bold text-amber-900 bg-amber-50/50">
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedMovimentos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-slate-500">
                      Nenhum recebimento registrado neste período.
                    </td>
                  </tr>
                ) : (
                  paginatedMovimentos.map((r) => (
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
                      <td className="p-2.5 text-slate-700">{r.seguradoraNome}</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-700">
                        {r.producaoLabel}
                      </td>
                      <td className="p-2.5 font-medium">{formatDateDisplay(r.dataRecebimento)}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-700 bg-emerald-50/50">
                        R$ {formatCurrency(r.valorLiquido)}
                      </td>
                      <td className="p-2.5 text-right font-semibold text-amber-800 bg-amber-50/30">
                        R$ {formatCurrency(r.saldoApolice)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t sticky bottom-0 z-10 text-slate-900">
                <tr>
                  <td className="p-2.5" colSpan={5}>
                    Total Consolidado ({movimentosRows.length} lançamentos)
                  </td>
                  <td className="p-2.5 text-right text-emerald-800 bg-emerald-200/70 text-sm font-extrabold">
                    R$ {formatCurrency(totalMovimentos.totalLiquido)}
                  </td>
                  <td className="p-2.5 text-right text-slate-500">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          /* TABELA MODO PROPOSTAS (Parcial, Não Recebida, Saldo Total) */
          <div className="overflow-x-auto border rounded-lg flex-1 min-h-[220px]">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b sticky top-0 z-10">
                <tr>
                  <th className="p-2.5">Proposta</th>
                  <th className="p-2.5">Cliente</th>
                  <th className="p-2.5">Seguradora</th>
                  <th className="p-2.5 text-right">Comissão Prevista</th>
                  <th className="p-2.5 text-right text-emerald-800">Já Recebido</th>
                  <th className="p-2.5 text-right font-bold text-amber-900 bg-amber-100/70">
                    Saldo a Receber
                  </th>
                  <th className="p-2.5">Último Recebimento</th>
                  <th className="p-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPropostas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-8 text-slate-500">
                      Nenhuma proposta com saldo encontrada para esta categoria.
                    </td>
                  </tr>
                ) : (
                  paginatedPropostas.map((r) => (
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
                      <td className="p-2.5 text-slate-700">{r.seguradoraNome}</td>
                      <td className="p-2.5 text-right font-medium text-slate-900">
                        R$ {formatCurrency(r.previsto)}
                      </td>
                      <td className="p-2.5 text-right font-semibold text-emerald-700">
                        R$ {formatCurrency(r.rec)}
                      </td>
                      <td className="p-2.5 text-right font-bold text-amber-800 bg-amber-50/60">
                        R$ {formatCurrency(r.saldo)}
                      </td>
                      <td className="p-2.5 text-slate-600">
                        {r.ultimoRecebimento ? formatDateDisplay(r.ultimoRecebimento) : '-'}
                      </td>
                      <td className="p-2.5 text-center">
                        <Badge
                          className={
                            r.statusText === 'Recebida'
                              ? 'bg-emerald-600 text-white'
                              : r.statusText === 'Parcial'
                                ? 'bg-blue-600 text-white'
                                : 'bg-amber-500 text-white'
                          }
                        >
                          {r.statusText}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t sticky bottom-0 z-10 text-slate-900">
                <tr>
                  <td className="p-2.5" colSpan={3}>
                    Total Consolidado ({propostasRows.length} propostas)
                  </td>
                  <td className="p-2.5 text-right">
                    R$ {formatCurrency(totalPropostas.totalPrevisto)}
                  </td>
                  <td className="p-2.5 text-right text-emerald-800">
                    R$ {formatCurrency(totalPropostas.totalRecebido)}
                  </td>
                  <td className="p-2.5 text-right text-amber-900 bg-amber-200/70 text-sm font-extrabold">
                    R$ {formatCurrency(totalPropostas.totalSaldo)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 pt-2">
            <span>
              Exibindo {(page - 1) * PAGE_SIZE + 1} a {Math.min(page * PAGE_SIZE, activeRowsCount)}{' '}
              de {activeRowsCount} registros
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
