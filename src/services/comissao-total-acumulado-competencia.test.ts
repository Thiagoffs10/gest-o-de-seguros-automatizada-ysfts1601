import { describe, it, expect } from 'vitest'
import {
  formatCompetenciaGroupLabel,
  compareCompetencias,
} from '../components/financial/RecebimentoDetailModal'

describe('RecebimentoDetailModal - Total Acumulado Agrupamento por Competência', () => {
  it('converte chaves MM/YYYY em rótulos amigáveis MMM/YY', () => {
    expect(formatCompetenciaGroupLabel('01/2025')).toBe('JAN/25')
    expect(formatCompetenciaGroupLabel('09/2026')).toBe('SET/26')
    expect(formatCompetenciaGroupLabel('10/2026')).toBe('OUT/26')
    expect(formatCompetenciaGroupLabel('12/2027')).toBe('DEZ/27')
    expect(formatCompetenciaGroupLabel('SEM_PREVISAO')).toBe('Sem Previsão')
    expect(formatCompetenciaGroupLabel(null)).toBe('Sem Previsão')
    expect(formatCompetenciaGroupLabel('')).toBe('Sem Previsão')
  })

  it('ordena competências em ordem cronológica com Sem Previsão no final', () => {
    const keys = ['SEM_PREVISAO', '11/2026', '01/2025', '10/2026', '02/2025', '09/2026']

    const sorted = [...keys].sort(compareCompetencias)

    expect(sorted).toEqual(['01/2025', '02/2025', '09/2026', '10/2026', '11/2026', 'SEM_PREVISAO'])
  })

  it('auditoria: soma dos subtotais dos grupos bate rigorosamente centavo a centavo com o total consolidado', () => {
    // Simula linhas com centavos complexos de comissões
    const mockRows = [
      { id: '1', competenciaKey: '09/2026', saldo: 125.43, previsto: 200, rec: 74.57 },
      { id: '2', competenciaKey: '09/2026', saldo: 312.18, previsto: 500, rec: 187.82 },
      { id: '3', competenciaKey: '10/2026', saldo: 89.99, previsto: 100, rec: 10.01 },
      { id: '4', competenciaKey: '10/2026', saldo: 450.77, previsto: 600, rec: 149.23 },
      { id: '5', competenciaKey: 'SEM_PREVISAO', saldo: 75.33, previsto: 75.33, rec: 0 },
    ]

    // Total consolidado
    const totalSaldoConsolidado =
      Math.round(mockRows.reduce((sum, r) => sum + r.saldo, 0) * 100) / 100

    // Agrupamento
    const map = new Map<string, typeof mockRows>()
    mockRows.forEach((r) => {
      const key = r.competenciaKey
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })

    const sortedKeys = Array.from(map.keys()).sort(compareCompetencias)
    const groups = sortedKeys.map((key) => {
      const rows = map.get(key) || []
      const subtotalSaldo = Math.round(rows.reduce((sum, r) => sum + r.saldo, 0) * 100) / 100
      return {
        key,
        label: formatCompetenciaGroupLabel(key),
        rows,
        subtotalSaldo,
      }
    })

    const somaSubtotais =
      Math.round(groups.reduce((sum, g) => sum + g.subtotalSaldo, 0) * 100) / 100

    expect(somaSubtotais).toBe(totalSaldoConsolidado)
    expect(totalSaldoConsolidado).toBe(1053.7) // 125.43 + 312.18 + 89.99 + 450.77 + 75.33 = 1053.70
    expect(groups[0].label).toBe('SET/26')
    expect(groups[1].label).toBe('OUT/26')
    expect(groups[2].label).toBe('Sem Previsão')
  })
})
