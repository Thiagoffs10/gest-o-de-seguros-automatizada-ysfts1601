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
  const cleaned = String(dateStr).trim()
  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`
  }
  return cleaned.split(/[ T]/)[0]
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
  if (!d) return '-'
  const dateOnly = extractDatePart(d)
  if (!dateOnly || !dateOnly.includes('-')) return d
  return dateOnly.split('-').reverse().join('/')
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

  const isMonthAll = !month || month === 'ALL' || month === 'todos' || month === ''
  const isYearAll = !year || year === 'ALL' || year === 'todos' || year === ''

  if (isMonthAll && isYearAll) {
    return {
      start: '1970-01-01',
      end: '2099-12-31',
      endInclusive: true,
      label: 'Período Total',
    }
  }

  if (isMonthAll && year && year !== 'ALL') {
    return {
      start: `${year}-01-01`,
      end: `${parseInt(year, 10) + 1}-01-01`,
      endInclusive: false,
      label: `Ano de ${year}`,
    }
  }

  if (month && month !== 'ALL' && isYearAll) {
    const currentYear = new Date().getFullYear()
    const m = String(month).padStart(2, '0')
    const monthIdx = parseInt(month, 10) - 1
    return {
      start: `${currentYear}-${m}-01`,
      end: computeFirstDayNextMonth(currentYear, parseInt(month, 10)),
      endInclusive: false,
      label: `${MONTH_NAMES[monthIdx] || ''} ${currentYear}`,
    }
  }

  if (month && month !== 'ALL' && year && year !== 'ALL') {
    const m = String(month).padStart(2, '0')
    const monthIdx = parseInt(month, 10) - 1
    return {
      start: `${year}-${m}-01`,
      end: computeFirstDayNextMonth(parseInt(year, 10), parseInt(month, 10)),
      endInclusive: false,
      label: `${MONTH_NAMES[monthIdx] || ''} ${year}`,
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

export function isDateInPeriod(period: DatePeriod, dateStr?: string): boolean {
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
  if (period.start === '1970-01-01' && period.end === '2099-12-31') {
    return ''
  }
  if (period.endInclusive) {
    return `${field} >= "${period.start}" && ${field} <= "${period.end}"`
  }
  return `${field} >= "${period.start}" && ${field} < "${period.end}"`
}
