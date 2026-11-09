import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrencyDisplay } from '@/lib/utils'
import {
  Clock,
  AlertTriangle,
  ArrowDownCircle,
  Users,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'

export interface FinanceiroOverviewCardsProps {
  // A Receber do mês corrente
  saldoAReceberMes: number
  countAReceberMes?: number
  onNavigateAReceberMes: () => void

  // Contas a receber de competências fechadas
  saldoContasFechadas: number
  countContasFechadas: number
  onNavigateContasFechadas: () => void

  // Alerta comissões sem baixa há mais de 60 dias
  countAlertas60: number
  saldoAlertas60?: number
  onNavigateAlertas60: () => void

  // Repasses pendentes de parceiros
  saldoRepassesPendentes: number
  countRepassesPendentes?: number
  onNavigateRepasses: () => void

  // Total recebido no mês (informativo complementar)
  comissaoRecebidaMes?: number
  onNavigateRecebidos?: () => void
}

/**
 * Cards compactos da Visão Geral do Financeiro.
 * Totalmente clicáveis: direcionam para a aba correta com os filtros correspondentes.
 */
export function FinanceiroOverviewCards({
  saldoAReceberMes,
  countAReceberMes,
  onNavigateAReceberMes,
  saldoContasFechadas,
  countContasFechadas,
  onNavigateContasFechadas,
  countAlertas60,
  saldoAlertas60,
  onNavigateAlertas60,
  saldoRepassesPendentes,
  countRepassesPendentes,
  onNavigateRepasses,
  comissaoRecebidaMes,
  onNavigateRecebidos,
}: FinanceiroOverviewCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. A Receber do Mês */}
      <Card
        onClick={onNavigateAReceberMes}
        className="cursor-pointer border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group bg-white"
      >
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-600">A Receber no Período</span>
            </div>
            {countAReceberMes != null && countAReceberMes > 0 && (
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-[11px]">
                {countAReceberMes}
              </Badge>
            )}
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              {formatCurrencyDisplay(saldoAReceberMes) || 'R$ 0,00'}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Saldo pendente do período selecionado
            </p>
          </div>
          <div className="pt-1 flex items-center justify-between text-[11px] text-blue-600 font-medium border-t border-slate-100">
            <span>Ver comissões a receber</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Contas a Receber de Competências Fechadas */}
      <Card
        onClick={onNavigateContasFechadas}
        className="cursor-pointer border-slate-200 hover:border-amber-400 hover:shadow-md transition-all group bg-white"
      >
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <ArrowDownCircle className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-600">Competências Fechadas</span>
            </div>
            <Badge
              variant="secondary"
              className={
                countContasFechadas > 0
                  ? 'bg-amber-100 text-amber-800 border-amber-200 text-[11px]'
                  : 'bg-slate-100 text-slate-600 text-[11px]'
              }
            >
              {countContasFechadas}
            </Badge>
          </div>
          <div>
            <div className="text-xl font-bold text-amber-800 group-hover:text-amber-600 transition-colors">
              {formatCurrencyDisplay(saldoContasFechadas) || 'R$ 0,00'}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Saldo FIFO de meses já fechados</p>
          </div>
          <div className="pt-1 flex items-center justify-between text-[11px] text-amber-700 font-medium border-t border-slate-100">
            <span>Ver pendências fechadas</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </CardContent>
      </Card>

      {/* 3. Alerta 60+ dias sem baixa */}
      <Card
        onClick={onNavigateAlertas60}
        className="cursor-pointer border-slate-200 hover:border-red-400 hover:shadow-md transition-all group bg-white"
      >
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-600">Atrasadas (+60 dias)</span>
            </div>
            <Badge
              variant="secondary"
              className={
                countAlertas60 > 0
                  ? 'bg-red-100 text-red-800 border-red-200 text-[11px]'
                  : 'bg-emerald-100 text-emerald-800 text-[11px]'
              }
            >
              {countAlertas60 > 0 ? `${countAlertas60} pendentes` : 'Em dia'}
            </Badge>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 group-hover:text-red-600 transition-colors">
              {saldoAlertas60 != null && saldoAlertas60 > 0
                ? formatCurrencyDisplay(saldoAlertas60)
                : `${countAlertas60} apólices`}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Sem baixa recente há mais de 60 dias
            </p>
          </div>
          <div className="pt-1 flex items-center justify-between text-[11px] text-red-600 font-medium border-t border-slate-100">
            <span>Filtrar atrasadas na lista</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </CardContent>
      </Card>

      {/* 4. Repasses Pendentes */}
      <Card
        onClick={onNavigateRepasses}
        className="cursor-pointer border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all group bg-white"
      >
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-600">Repasses Pendentes</span>
            </div>
            {countRepassesPendentes != null && countRepassesPendentes > 0 && (
              <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 text-[11px]">
                {countRepassesPendentes}
              </Badge>
            )}
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
              {formatCurrencyDisplay(saldoRepassesPendentes) || 'R$ 0,00'}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Comissões devidas a parceiros</p>
          </div>
          <div className="pt-1 flex items-center justify-between text-[11px] text-indigo-600 font-medium border-t border-slate-100">
            <span>Acessar aba de Repasses</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </CardContent>
      </Card>

      {/* Opcional: Total Recebido se fornecido */}
      {comissaoRecebidaMes != null && onNavigateRecebidos && (
        <Card
          onClick={onNavigateRecebidos}
          className="cursor-pointer border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all group bg-white sm:col-span-2 lg:col-span-4"
        >
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-600 block">
                  Total Recebido no Período (Caixa Realizado)
                </span>
                <div className="text-xl font-bold text-emerald-700">
                  {formatCurrencyDisplay(comissaoRecebidaMes) || 'R$ 0,00'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
              <span>Abrir detalhamento de recebimentos</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
