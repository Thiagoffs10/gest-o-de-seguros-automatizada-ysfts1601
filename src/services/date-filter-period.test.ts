import { describe, it, expect } from 'vitest'
import { computePeriod, isDateInPeriod } from '@/lib/date-filter'

describe('computePeriod — último dia do mês (fix "01/10 a 01/11")', () => {
  it('outubro/2026 termina em 31/10/2026 e é inclusivo', () => {
    const p = computePeriod('10', '2026')
    expect(p.start).toBe('2026-10-01')
    expect(p.end).toBe('2026-10-31')
    expect(p.endInclusive).toBe(true)
    expect(p.label).toBe('Outubro 2026')
  })

  it('setembro (30 dias) termina em 30/09', () => {
    const p = computePeriod('9', '2026')
    expect(p.end).toBe('2026-09-30')
  })

  it('fevereiro termina em 28 (ano comum) e 29 (bissexto)', () => {
    expect(computePeriod('2', '2026').end).toBe('2026-02-28')
    expect(computePeriod('2', '2024').end).toBe('2024-02-29')
  })

  it('dezembro fecha no próprio ano (31/12, inclusive)', () => {
    const p = computePeriod('12', '2026')
    expect(p.end).toBe('2026-12-31')
    expect(p.endInclusive).toBe(true)
  })

  it('ano inteiro termina em 31/12 (inclusive)', () => {
    const p = computePeriod('ALL', '2026')
    expect(p.start).toBe('2026-01-01')
    expect(p.end).toBe('2026-12-31')
    expect(p.endInclusive).toBe(true)
  })

  it('mês sem ano usa o ano corrente e também fecha no último dia', () => {
    const ano = String(new Date().getFullYear())
    const p = computePeriod('10')
    expect(p.start).toBe(`${ano}-10-01`)
    expect(p.end).toBe(`${ano}-10-31`)
  })

  it('fronteira: 31/10 entra, 01/11 não entra no período de outubro', () => {
    const p = computePeriod('10', '2026')
    expect(isDateInPeriod(p, '2026-10-31')).toBe(true)
    expect(isDateInPeriod(p, '2026-10-31 18:00:00.000Z')).toBe(true)
    expect(isDateInPeriod(p, '2026-11-01')).toBe(false)
    expect(isDateInPeriod(p, '2026-11-01 00:00:00.000Z')).toBe(false)
  })
})
