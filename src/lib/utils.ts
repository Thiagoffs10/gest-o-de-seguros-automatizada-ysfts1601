/* General utility functions (exposes cn) */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges multiple class names into a single string
 * @param inputs - Array of class names
 * @returns Merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a numeric value into Brazilian Real string with exactly two decimal places.
 * Example: 1592.885 -> "1.592,89"
 */
export function formatCurrency(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') return '0,00'
  const num = typeof value === 'number' ? value : Number(value)
  if (isNaN(num)) return '0,00'
  const rounded = Math.round(num * 100) / 100
  return rounded.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Formats a raw number or digits into Brazilian currency input format (e.g. "R$ 1.500,00").
 */
export function formatCurrencyDisplay(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') return ''
  const num = typeof value === 'number' ? value : Number(value)
  if (isNaN(num)) return ''
  return `R$ ${formatCurrency(num)}`
}

/**
 * Parses a currency input string (e.g. "R$ 1.500,00" or "1500" or digits from typing) into pure numeric float.
 * Keeps standard cent-based typing: 1500 -> 15.00, or handles typed numbers gracefully.
 */
export function parseCurrencyInput(value: string): number {
  if (!value) return 0
  const digits = value.replace(/\D/g, '')
  if (!digits) return 0
  return Number(digits) / 100
}

/**
 * Formats a date string into YYYY-MM-DD for native HTML date inputs.
 */
/**
 * Extracts the YYYY-MM-DD portion from any date string or ISO string
 * without suffering time-zone shifts.
 */
export function extractDateOnly(dateStr?: string | null): string {
  if (!dateStr) return ''
  const cleaned = String(dateStr).trim()
  // Matches "YYYY-MM-DD..."
  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`
  }
  // Matches "DD/MM/YYYY..."
  const brMatch = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
  }
  return ''
}

/**
 * Formats a date string into YYYY-MM-DD for native HTML date inputs.
 */
export function formatDateForInput(dateStr?: string | null): string {
  if (!dateStr) return ''
  const direct = extractDateOnly(dateStr)
  if (direct) return direct
  const dateObj = new Date(dateStr)
  if (isNaN(dateObj.getTime())) return ''
  return toLocalDate(dateObj)
}

export function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayLocalDate(): string {
  return toLocalDate(new Date())
}

/**
 * Formats any date string (ISO UTC, YYYY-MM-DD, PocketBase datetime) to DD/MM/YYYY
 * safely without timezone conversion regressions.
 */
export function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const dateOnly = extractDateOnly(dateStr)
  if (dateOnly && dateOnly.includes('-')) {
    const [y, m, d] = dateOnly.split('-')
    return `${d}/${m}/${y}`
  }
  // Fallback for non-standard formats
  const d = String(dateStr).split('T')[0].split(' ')[0]
  if (d && d.includes('-')) {
    return d.split('-').reverse().join('/')
  }
  return '-'
}

/**
 * Formats a timestamp (created/updated) into DD/MM/YYYY HH:mm for display.
 */
export function formatDateTimeDisplay(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const dateObj = new Date(dateStr)
  if (isNaN(dateObj.getTime())) return formatDateDisplay(dateStr)
  return dateObj.toLocaleString('pt-BR')
}
