import { describe, it, expect } from 'vitest'
import {
  computePendenciasComissao60,
  getFirstDayFromCompetencia,
  calculateElapsedDays,
} from '@/lib/financial-calcs'
import { Policy, ComissaoPrevista, ComissaoRecebimento } from '@/types'

describe('Comissão sem baixa há mais de 60 dias (computePendenciasComissao60)', () => {
  const todaySimulado = '2026-06-01'

  it('normaliza competência MM/AAAA para o 1º dia do mês', () => {
    expect(getFirstDayFromCompetencia('03/2026')).toBe('2026-03-01')
    expect(getFirstDayFromCompetencia('1/2026')).toBe('2026-01-01')
    expect(getFirstDayFromCompetencia('12/2025')).toBe('2025-12-01')
    expect(getFirstDayFromCompetencia('invalido')).toBeNull()
    expect(getFirstDayFromCompetencia(undefined)).toBeNull()
  })

  it('calcula dias corridos corretamente', () => {
    // 2026-06-01 - 2026-04-02: abril tem 30 dias -> do dia 2/4 até 1/6 são 28 + 31 + 1 = 60 dias
    expect(calculateElapsedDays('2026-04-02', todaySimulado)).toBe(60)
    // 2026-04-01 -> 61 dias
    expect(calculateElapsedDays('2026-04-01', todaySimulado)).toBe(61)
  })

  it('edge case de dias: exatamente 60 dias NÃO alerta; 61 alerta', () => {
    // Referência em 2026-04-02 -> exatamente 60 dias em 2026-06-01
    const pol60: Policy = {
      id: 'p-60',
      policy_code: 101,
      start_date: '2026-04-02',
      commission: 500,
      status: 'Ativa',
    } as any

    // Referência em 2026-04-01 -> 61 dias em 2026-06-01
    const pol61: Policy = {
      id: 'p-61',
      policy_code: 102,
      start_date: '2026-04-01',
      commission: 600,
      status: 'Ativa',
    } as any

    const res = computePendenciasComissao60([pol60, pol61], [], [], todaySimulado)
    expect(res.countApolices).toBe(1)
    expect(res.itens[0].policy.id).toBe('p-61')
    expect(res.itens[0].diasParados).toBe(61)
    expect(res.itens[0].saldoPendente).toBe(600)
    expect(res.totalValorPendente).toBe(600)
  })

  it('apólice com competência MM/AAAA usa o 1º dia do mês como referência', () => {
    // Competência 03/2026 -> 1º dia é 2026-03-01. Em 2026-06-01 decorreram 92 dias.
    const pol: Policy = {
      id: 'p-comp',
      policy_code: 200,
      start_date: '2026-05-15', // start_date recente (17 dias), mas parcela é de 03/2026
      status: 'Ativa',
    } as any

    const prev: ComissaoPrevista = {
      id: 'prev-1',
      policy: 'p-comp',
      competencia: '03/2026',
      valor_previsto: 1200,
      status: 'Pendente',
    } as any

    const res = computePendenciasComissao60([pol], [], [prev], todaySimulado)
    expect(res.countApolices).toBe(1)
    expect(res.itens[0].origemReferencia).toBe('competencia')
    expect(res.itens[0].dataReferencia).toBe('2026-03-01')
    expect(res.itens[0].diasParados).toBe(92)
    expect(res.itens[0].saldoPendente).toBe(1200)
  })

  it('apólice cancelada NUNCA alerta, mesmo com atraso longo', () => {
    const polCancelada: Policy = {
      id: 'p-canc',
      policy_code: 300,
      start_date: '2025-01-01', // mais de 500 dias
      commission: 2000,
      status: 'Cancelada',
    } as any

    const res = computePendenciasComissao60([polCancelada], [], [], todaySimulado)
    expect(res.countApolices).toBe(0)
    expect(res.itens).toHaveLength(0)
    expect(res.totalValorPendente).toBe(0)
  })

  it('apólice com comissão já recebida/quitada NÃO alerta', () => {
    const polQuitada: Policy = {
      id: 'p-quit',
      policy_code: 400,
      start_date: '2026-01-01',
      commission: 800,
      comissao_recebida: true,
      status: 'Ativa',
    } as any

    const polQuitadaPorMovimento: Policy = {
      id: 'p-mov',
      policy_code: 401,
      start_date: '2026-01-01',
      commission: 800,
      status: 'Ativa',
    } as any

    const rec: ComissaoRecebimento = {
      id: 'rec-1',
      policy: 'p-mov',
      valor_bruto: 800,
      valor_liquido: 800,
      data_recebimento: '2026-01-10',
    } as any

    const res = computePendenciasComissao60(
      [polQuitada, polQuitadaPorMovimento],
      [rec],
      [],
      todaySimulado,
    )
    expect(res.countApolices).toBe(0)
  })

  it('ordena as pendências da mais antiga para a mais recente', () => {
    const pol1: Policy = {
      id: 'p-1',
      policy_code: 1,
      start_date: '2026-02-01', // ~120 dias
      commission: 100,
      status: 'Ativa',
    } as any

    const pol2: Policy = {
      id: 'p-2',
      policy_code: 2,
      start_date: '2026-01-01', // ~151 dias (mais antiga)
      commission: 200,
      status: 'Ativa',
    } as any

    const pol3: Policy = {
      id: 'p-3',
      policy_code: 3,
      start_date: '2026-03-15', // ~78 dias
      commission: 300,
      status: 'Ativa',
    } as any

    const res = computePendenciasComissao60([pol1, pol2, pol3], [], [], todaySimulado)
    expect(res.countApolices).toBe(3)
    expect(res.itens[0].policy.id).toBe('p-2') // 151 dias
    expect(res.itens[1].policy.id).toBe('p-1') // 120 dias
    expect(res.itens[2].policy.id).toBe('p-3') // 78 dias
    expect(res.totalValorPendente).toBe(600)
  })

  it('fallback para created quando start_date e competência estão ausentes', () => {
    const polCreated: Policy = {
      id: 'p-created',
      policy_code: 500,
      created: '2026-01-15T10:00:00Z',
      commission: 450,
      status: 'Ativa',
    } as any

    const res = computePendenciasComissao60([polCreated], [], [], todaySimulado)
    expect(res.countApolices).toBe(1)
    expect(res.itens[0].origemReferencia).toBe('created')
    expect(res.itens[0].dataReferencia).toBe('2026-01-15')
    expect(res.itens[0].diasParados).toBe(137)
  })
})
