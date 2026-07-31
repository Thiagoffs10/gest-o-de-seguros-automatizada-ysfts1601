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
  return dateObj.toISOString().split('T')[0]
}
