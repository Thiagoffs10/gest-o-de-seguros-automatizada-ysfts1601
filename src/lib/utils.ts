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
export function formatDateForInput(dateStr?: string | null): string {
  if (!dateStr) return ''
  const cleaned = String(dateStr).trim()
  if (cleaned.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned.slice(0, 10)
  }
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

export function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const d = String(dateStr).split('T')[0].split(' ')[0]
  if (!d || !d.includes('-')) return '-'
  return d.split('-').reverse().join('/')
}
