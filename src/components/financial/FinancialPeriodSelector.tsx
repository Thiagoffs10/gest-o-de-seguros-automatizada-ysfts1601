import { useState } from 'react'
import { Calendar, Filter, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FilterState } from '@/types'
import { DatePeriod, formatBRDate } from '@/lib/date-filter'

export interface FinancialPeriodSelectorProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
  period?: DatePeriod
  titulo?: string
  subtitulo?: string
  className?: string
  /** Atalhos rápidos opcionais: 'mes_atual', 'ultimos_3_meses', 'ano_atual', 'tudo' */
  mostrarAtalhos?: boolean
}

const ANOS = ['2024', '2025', '2026', '2027']

const MESES = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]

/**
 * Seletor de período reutilizável no padrão visual das abas do Financeiro.
 * Permite filtrar por Ano, Mês, Atalhos rápidos e Intervalo de datas personalizado (De/Até).
 * Sincroniza diretamente com o estado `filters` global da página Financial.
 */
export function FinancialPeriodSelector({
  filters,
  onFilterChange,
  period,
  titulo = 'Período de Consulta',
  subtitulo,
  className = '',
  mostrarAtalhos = true,
}: FinancialPeriodSelectorProps) {
  const [modoPersonalizado, setModoPersonalizado] = useState<boolean>(
    Boolean(filters.dateFrom || filters.dateTo),
  )

  const agora = new Date()
  const anoAtual = String(agora.getFullYear())
  const mesAtual = String(agora.getMonth() + 1)

  // Aplica atalho rápido
  const aplicarAtalho = (tipo: 'mes_atual' | 'ultimos_3_meses' | 'ano_atual' | 'todos') => {
    if (tipo === 'mes_atual') {
      setModoPersonalizado(false)
      onFilterChange({
        ...filters,
        year: anoAtual,
        month: mesAtual,
        dateFrom: undefined,
        dateTo: undefined,
      })
    } else if (tipo === 'ano_atual') {
      setModoPersonalizado(false)
      onFilterChange({
        ...filters,
        year: anoAtual,
        month: 'ALL',
        dateFrom: undefined,
        dateTo: undefined,
      })
    } else if (tipo === 'ultimos_3_meses') {
      // Data de 90 dias atrás até hoje
      setModoPersonalizado(true)
      const d3 = new Date(agora)
      d3.setMonth(d3.getMonth() - 2)
      d3.setDate(1)
      const pad = (n: number) => String(n).padStart(2, '0')
      const df = `${d3.getFullYear()}-${pad(d3.getMonth() + 1)}-01`
      const dt = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(
        new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate(),
      )}`
      onFilterChange({
        ...filters,
        year: undefined,
        month: undefined,
        dateFrom: df,
        dateTo: dt,
      })
    } else if (tipo === 'todos') {
      setModoPersonalizado(false)
      onFilterChange({
        ...filters,
        year: 'ALL',
        month: 'ALL',
        dateFrom: undefined,
        dateTo: undefined,
      })
    }
  }

  const handleYearChange = (v: string) => {
    onFilterChange({
      ...filters,
      year: v,
      dateFrom: undefined,
      dateTo: undefined,
    })
  }

  const handleMonthChange = (v: string) => {
    onFilterChange({
      ...filters,
      month: v,
      dateFrom: undefined,
      dateTo: undefined,
    })
  }

  const handleDateFromChange = (df: string) => {
    onFilterChange({
      ...filters,
      dateFrom: df || undefined,
      year: undefined,
      month: undefined,
    })
  }

  const handleDateToChange = (dt: string) => {
    onFilterChange({
      ...filters,
      dateTo: dt || undefined,
      year: undefined,
      month: undefined,
    })
  }

  const isMesAtual = filters.year === anoAtual && filters.month === mesAtual && !filters.dateFrom
  const isAnoAtual = filters.year === anoAtual && filters.month === 'ALL' && !filters.dateFrom
  const isTodos = filters.year === 'ALL' && filters.month === 'ALL' && !filters.dateFrom

  return (
    <div
      className={`bg-slate-50/80 p-3 rounded-lg border border-slate-200/90 space-y-2.5 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              {titulo}
              {period && (
                <span className="text-[11px] font-normal text-slate-500">
                  ({formatBRDate(period.start)} até {formatBRDate(period.end)})
                </span>
              )}
            </span>
            {subtitulo && <p className="text-[11px] text-slate-500">{subtitulo}</p>}
          </div>
        </div>

        {/* Atalhos rápidos */}
        {mostrarAtalhos && (
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant={isMesAtual ? 'default' : 'outline'}
              size="sm"
              className={`h-7 text-[11px] px-2.5 ${
                isMesAtual ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white'
              }`}
              onClick={() => aplicarAtalho('mes_atual')}
            >
              Mês Atual
            </Button>
            <Button
              type="button"
              variant={isAnoAtual ? 'default' : 'outline'}
              size="sm"
              className={`h-7 text-[11px] px-2.5 ${
                isAnoAtual ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white'
              }`}
              onClick={() => aplicarAtalho('ano_atual')}
            >
              Ano {anoAtual}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2.5 bg-white text-slate-700 hover:text-blue-600"
              onClick={() => aplicarAtalho('ultimos_3_meses')}
            >
              Últimos 3 meses
            </Button>
            <Button
              type="button"
              variant={isTodos ? 'default' : 'outline'}
              size="sm"
              className={`h-7 text-[11px] px-2.5 ${
                isTodos ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white'
              }`}
              onClick={() => aplicarAtalho('todos')}
            >
              Tudo
            </Button>
          </div>
        )}
      </div>

      {/* Controles de seleção */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {!modoPersonalizado ? (
          <>
            <div>
              <Select value={filters.year || 'ALL'} onValueChange={handleYearChange}>
                <SelectTrigger className="w-[115px] h-8 text-xs bg-white">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os anos</SelectItem>
                  {ANOS.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={filters.month || 'ALL'} onValueChange={handleMonthChange}>
                <SelectTrigger className="w-[140px] h-8 text-xs bg-white">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os meses</SelectItem>
                  {MESES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-[11px] text-slate-600 font-medium">De:</Label>
              <Input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleDateFromChange(e.target.value)}
                className="w-[140px] h-8 text-xs bg-white"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-[11px] text-slate-600 font-medium">Até:</Label>
              <Input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleDateToChange(e.target.value)}
                className="w-[140px] h-8 text-xs bg-white"
              />
            </div>
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-[11px] text-slate-600 hover:text-blue-700 hover:bg-slate-100 gap-1 ml-auto"
          onClick={() => {
            const novoModo = !modoPersonalizado
            setModoPersonalizado(novoModo)
            if (!novoModo && (filters.dateFrom || filters.dateTo)) {
              onFilterChange({
                ...filters,
                year: anoAtual,
                month: mesAtual,
                dateFrom: undefined,
                dateTo: undefined,
              })
            }
          }}
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>{modoPersonalizado ? 'Filtrar por Ano/Mês' : 'Datas personalizadas'}</span>
        </Button>

        {(filters.year !== anoAtual ||
          filters.month !== mesAtual ||
          filters.dateFrom ||
          filters.dateTo) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-[11px] text-slate-500 hover:text-red-600 gap-1"
            title="Voltar ao mês atual"
            onClick={() => aplicarAtalho('mes_atual')}
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Mês atual</span>
          </Button>
        )}
      </div>
    </div>
  )
}
