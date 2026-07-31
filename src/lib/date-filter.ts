import type { FilterState } from '@/types'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function extractDatePart(dateStr?: string): string {
  if (!dateStr) return ''
  return String(dateStr).split(/[ T]/)[0]
}

export interface DatePeriod {
  start: string
  end: string
  endInclusive: boolean
  label: string
}

function computeFirstDayNextMonth(year: number, month: number): string {
  if (month === 12) {
    return `${year + 1}-01-01`
  }
  return `${year}-${String(month + 1).padStart(2, '0')}-01`
}

export function formatBRDate(d: string): string {
  return d.split('-').reverse().join('/')
}

export function computePeriod(
  month?: string,
  year?: string,
  dateFrom?: string,
  dateTo?: string,
): DatePeriod {
  if (dateFrom && dateTo) {
    return {
      start: dateFrom,
      end: dateTo,
      endInclusive: true,
      label: `${formatBRDate(dateFrom)} a ${formatBRDate(dateTo)}`,
    }
  }
  if (dateFrom) {
    return {
      start: dateFrom,
      end: dateFrom,
      endInclusive: true,
      label: formatBRDate(dateFrom),
    }
  }
  if (dateTo) {
    return {
      start: dateTo,
      end: dateTo,
      endInclusive: true,
      label: formatBRDate(dateTo),
    }
  }
  if (month && year) {
    const m = String(month).padStart(2, '0')
    return {
      start: `${year}-${m}-01`,
      end: computeFirstDayNextMonth(parseInt(year), parseInt(month)),
      endInclusive: false,
      label: `${MONTH_NAMES[parseInt(month) - 1]} ${year}`,
    }
  }
  if (year) {
    return {
      start: `${year}-01-01`,
      end: `${parseInt(year) + 1}-01-01`,
      endInclusive: false,
      label: `Ano de ${year}`,
    }
  }
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return {
    start: `${now.getFullYear()}-${m}-01`,
    end: computeFirstDayNextMonth(now.getFullYear(), now.getMonth() + 1),
    endInclusive: false,
    label: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`,
  }
}

export function computePeriodFromFilters(filters: FilterState): DatePeriod {
  return computePeriod(filters.month, filters.year, filters.dateFrom, filters.dateTo)
}

export function isDateInPeriod(dateStr?: string, period: DatePeriod): boolean {
  if (!dateStr) return false
  const d = extractDatePart(dateStr)
  if (!d) return false
  if (d < period.start) return false
  if (period.endInclusive) {
    return d <= period.end
  }
  return d < period.end
}

export function buildPocketBaseDateFilter(field: string, period: DatePeriod): string {
  if (period.endInclusive) {
    return `${field} >= "${period.start}" && ${field} <= "${period.end}"`
  }
  return `${field} >= "${period.start}" && ${field} < "${period.end}"`
}
