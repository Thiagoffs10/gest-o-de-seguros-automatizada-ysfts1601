import { describe, it, expect, beforeEach, vi } from 'vitest'
import { calcularPrevisoesComissao } from './comissao-engine'
import {
  createComissaoRecebimento,
  recalcularStatusApolice,
  registrarEstornoComissao,
} from './comissao-recebimentos'
import pb from '@/lib/pocketbase/client'
import { Policy, ComissaoRecebimento, ComissaoPrevista } from '@/types'

describe('Regras exclusivas do tipo Por saldo/esgotamento', () => {
  const policyId = 'pol_esgotamento_001'
  let dbRecebimentos: ComissaoRecebimento[] = []
  let dbPrevisoes: ComissaoPrevista[] = []
  let mockPolicy: Policy

  beforeEach(() => {
    dbRecebimentos = []
    dbPrevisoes = []

    // Apólice com comissão bruta = 1000, ISS = 50 -> Comissão Líquida Prevista = 950
    mockPolicy = {
      id: policyId,
      policy_number: 'AP-ESG-2026',
      client: 'cli_1',
      seguradora: 'seg_1',
      valor_liquido: 10000,
      commission_percent: 10,
      commission: 1000,
      iss: 50,
      comissao_recebida: false,
      start_date: '2026-09-01',
      comissao_personalizada: true,
      comissao_personalizada_config: {
        tipo_modelo: 'POR_ESGOTAMENTO',
        total_bruto_previsto: 1000,
        total_liquido_previsto: 950,
        saldo_total: 950,
      },
      created: '2026-09-01',
      updated: '2026-09-01',
    } as any

    const mockRecebimentosCol = {
      create: vi.fn(async (payload: any) => {
        const id = `rec_${Date.now()}_${Math.random()}`
        const record = {
          id,
          ...payload,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        } as ComissaoRecebimento
        dbRecebimentos.push(record)
        return record
      }),
      getFullList: vi.fn(async ({ filter }: any = {}) => {
        if (filter?.includes('recebimento_original')) {
          const m = filter.match(/recebimento_original = "([^"]+)"/)
          const origId = m ? m[1] : null
          return dbRecebimentos.filter((r) => r.recebimento_original === origId)
        }
        return dbRecebimentos.filter((r) => r.policy === policyId)
      }),
      getOne: vi.fn(async (id: string) => {
        const r = dbRecebimentos.find((x) => x.id === id)
        if (!r) throw new Error('Não encontrado')
        return r
      }),
    }

    const mockPrevisoesCol = {
      getFullList: vi.fn(async () => dbPrevisoes),
      update: vi.fn(async (id: string, payload: any) => {
        const idx = dbPrevisoes.findIndex((p) => p.id === id)
        if (idx !== -1) {
          dbPrevisoes[idx] = { ...dbPrevisoes[idx], ...payload }
          return dbPrevisoes[idx]
        }
        throw new Error('Previsão não encontrada')
      }),
    }

    const mockPoliciesCol = {
      getOne: vi.fn(async (id: string) => {
        if (id === policyId) return mockPolicy
        throw new Error('Apólice não encontrada')
      }),
      update: vi.fn(async (id: string, payload: any) => {
        if (id === policyId) {
          mockPolicy = { ...mockPolicy, ...payload }
          return mockPolicy
        }
        throw new Error('Apólice não encontrada')
      }),
    }

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'comissao_recebimentos') return mockRecebimentosCol as any
      if (colName === 'comissoes_previstas') return mockPrevisoesCol as any
      if (colName === 'policies') return mockPoliciesCol as any
      return {} as any
    })
  })

  it('1. NÃO calcula estimativa de parcela e usa a Comissão Líquida Prevista como saldo total esperado', () => {
    const previsoes = calcularPrevisoesComissao(
      {
        start_date: mockPolicy.start_date,
        valor_liquido: mockPolicy.valor_liquido,
        commission_percent: mockPolicy.commission_percent,
        commission: mockPolicy.commission,
      },
      {
        tipo_modelo: 'POR_ESGOTAMENTO',
        config_json: {
          saldo_total: 950,
        },
      },
    )

    // Previsão única: sem série de competências fracionadas por estimativa
    expect(previsoes).toHaveLength(1)
    expect(previsoes[0].valor_previsto).toBe(950)
    expect(previsoes[0].parcela_numero).toBe(1)
    expect(previsoes[0].observacao).toContain('Por saldo/esgotamento')
  })

  it('2. A cada baixa manual no financeiro, atualiza total recebido e saldo (Comissão Líquida Prevista - total recebido)', async () => {
    // Registra previsão única no banco mock
    const prev = {
      id: 'prev_esg_1',
      policy: policyId,
      competencia: '09/2026',
      data_prevista: '2026-09-01',
      valor_previsto: 950, // Comissão líquida prevista
      status: 'Pendente',
    } as ComissaoPrevista
    dbPrevisoes.push(prev)

    // 1ª baixa manual: R$ 300
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-10',
      valor_bruto: 300,
      valor_liquido: 300,
      comissao_prevista: prev.id,
    })

    // Status da previsão vinculado deve estar Parcial
    const prevApos1 = dbPrevisoes.find((p) => p.id === prev.id)
    expect(prevApos1?.status).toBe('Parcial')

    // Saldo = 950 - 300 = 650
    const totalRecebido1 = dbRecebimentos.reduce((s, r) => s + Number(r.valor_bruto), 0)
    const saldo1 = prev.valor_previsto - totalRecebido1
    expect(totalRecebido1).toBe(300)
    expect(saldo1).toBe(650)

    // 2ª baixa manual: R$ 400
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-20',
      valor_bruto: 400,
      valor_liquido: 400,
      comissao_prevista: prev.id,
    })

    const prevApos2 = dbPrevisoes.find((p) => p.id === prev.id)
    expect(prevApos2?.status).toBe('Parcial')

    // Saldo = 950 - 700 = 250
    const totalRecebido2 = dbRecebimentos.reduce((s, r) => s + Number(r.valor_bruto), 0)
    const saldo2 = prev.valor_previsto - totalRecebido2
    expect(totalRecebido2).toBe(700)
    expect(saldo2).toBe(250)
  })

  it('3. Enquanto existir saldo, mantém a comissão como pendente/parcial; ao zerar o saldo, considera quitada/recebida', async () => {
    const prev = {
      id: 'prev_esg_2',
      policy: policyId,
      competencia: '09/2026',
      data_prevista: '2026-09-01',
      valor_previsto: 950,
      status: 'Pendente',
    } as ComissaoPrevista
    dbPrevisoes.push(prev)

    // Baixa parcial de 500
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-10',
      valor_bruto: 500,
      valor_liquido: 500,
      comissao_prevista: prev.id,
    })
    expect(dbPrevisoes[0].status).toBe('Parcial')

    // Baixa complementar que quita o saldo de 950 (450 restantes)
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-25',
      valor_bruto: 450,
      valor_liquido: 450,
      comissao_prevista: prev.id,
    })

    // Como atingiu o total de 950 previsto na previsão, status deve ser Recebida (quitada)
    expect(dbPrevisoes[0].status).toBe('Recebida')
  })

  it('4. Estorno reabre o saldo e retorna status para Parcial/Pendente', async () => {
    const prev = {
      id: 'prev_esg_3',
      policy: policyId,
      competencia: '09/2026',
      data_prevista: '2026-09-01',
      valor_previsto: 950,
      status: 'Pendente',
    } as ComissaoPrevista
    dbPrevisoes.push(prev)

    // Baixa que quita
    const rec = await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-10',
      valor_bruto: 950,
      valor_liquido: 950,
      comissao_prevista: prev.id,
    })
    expect(dbPrevisoes[0].status).toBe('Recebida')

    // Estorno parcial de 200
    await registrarEstornoComissao({
      recebimento_original_id: rec.id,
      valor_estorno: 200,
      data_estorno: '2026-09-15',
      motivo: 'Ajuste de estorno',
    })

    // Saldo reaberto: 950 - 750 = 200 restante
    const recsDaPrevisao = dbRecebimentos.filter((r) => r.comissao_prevista === prev.id)
    const recBrutoDesta = recsDaPrevisao.reduce((acc, r) => acc + Number(r.valor_bruto), 0)
    expect(recBrutoDesta).toBe(750)
    expect(dbPrevisoes[0].status).toBe('Parcial')
  })
})
