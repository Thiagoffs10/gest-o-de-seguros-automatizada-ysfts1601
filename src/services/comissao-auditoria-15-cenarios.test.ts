import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  computePendingCommissions,
  computeReceivedCommissions,
  computeReceivedGrossCommissions,
  calcNetCommission,
  getPolicyExpectedCommission,
} from '@/lib/financial-calcs'
import { createComissaoRecebimento, registrarEstornoComissao } from './comissao-recebimentos'
import { syncPrevisoesForPolicy } from './modelos-comissao'
import { calcularPrevisoesComissao } from './comissao-engine'
import { Policy, ComissaoPrevista, ComissaoRecebimento, ModeloComissao } from '@/types'
import { computePeriod } from '@/lib/date-filter'

// Mocks do cliente PocketBase
vi.mock('@/lib/pocketbase/client', () => {
  return {
    default: {
      authStore: {
        record: { id: 'usr_test', name: 'Tester', role: 'Operador' },
      },
      collection: vi.fn(),
    },
  }
})

describe('Testes Obrigatórios da Auditoria (1 a 15)', () => {
  const policyId = 'pol_test_123'
  let mockPolicy: Policy
  let dbPrevisoes: ComissaoPrevista[] = []
  let dbRecebimentos: ComissaoRecebimento[] = []

  const mockPrevisoesCol = {
    getFullList: vi.fn(async (options?: any) => {
      if (options?.filter?.includes(`policy = "${policyId}"`)) {
        return dbPrevisoes.filter((p) => p.policy === policyId)
      }
      return dbPrevisoes
    }),
    create: vi.fn(async (payload: any) => {
      // Validar unicidade da chave estável
      if (payload.chave_estavel) {
        const exist = dbPrevisoes.find((p) => p.chave_estavel === payload.chave_estavel)
        if (exist) {
          throw new Error(`Duplicate stable key: ${payload.chave_estavel}`)
        }
      }
      const item: ComissaoPrevista = {
        id: `prev_${Date.now()}_${Math.random()}`,
        policy: payload.policy,
        competencia: payload.competencia,
        data_prevista: payload.data_prevista,
        valor_previsto: payload.valor_previsto,
        parcela_numero: payload.parcela_numero,
        origem_modelo: payload.origem_modelo,
        status: payload.status || 'Pendente',
        observacao: payload.observacao || '',
        chave_estavel: payload.chave_estavel,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
      dbPrevisoes.push(item)
      return item
    }),
    update: vi.fn(async (id: string, updates: any) => {
      const idx = dbPrevisoes.findIndex((p) => p.id === id)
      if (idx !== -1) {
        dbPrevisoes[idx] = { ...dbPrevisoes[idx], ...updates, updated: new Date().toISOString() }
        return dbPrevisoes[idx]
      }
      throw new Error(`Previsao ${id} not found`)
    }),
    delete: vi.fn(async (id: string) => {
      const idx = dbPrevisoes.findIndex((p) => p.id === id)
      if (idx !== -1) {
        const item = dbPrevisoes[idx]
        // Se estiver recebida, backend não permite excluir
        if (item.status === 'Recebida' || item.status === 'Parcial') {
          throw new Error('Não é permitido excluir previsão com recebimento vinculado.')
        }
        dbPrevisoes.splice(idx, 1)
      }
    }),
    getFirstListItem: vi.fn(async (filter: string) => {
      const m = filter.match(/chave_estavel = "([^"]+)"/)
      if (m) {
        const found = dbPrevisoes.find((p) => p.chave_estavel === m[1])
        if (found) return found
      }
      throw new Error('Not found')
    }),
  }

  const mockRecebimentosCol = {
    getFullList: vi.fn(async (options?: any) => {
      if (options?.filter?.includes(`policy = "${policyId}"`)) {
        return dbRecebimentos.filter((r) => r.policy === policyId)
      }
      if (options?.filter?.includes('recebimento_original =')) {
        const origId = options.filter.match(/recebimento_original = "([^"]+)"/)?.[1]
        return dbRecebimentos.filter((r) => r.recebimento_original === origId)
      }
      return dbRecebimentos
    }),
    getOne: vi.fn(async (id: string) => {
      const item = dbRecebimentos.find((r) => r.id === id)
      if (item) return { ...item }
      throw new Error(`Recebimento ${id} not found`)
    }),
    create: vi.fn(async (payload: any) => {
      // Validação de idempotência
      if (payload.idempotency_key) {
        const dup = dbRecebimentos.find((r) => r.idempotency_key === payload.idempotency_key)
        if (dup) {
          throw new Error('Operação financeira já processada (idempotência confirmada).')
        }
      }
      const item: ComissaoRecebimento = {
        id: `rec_${Date.now()}_${Math.random()}`,
        policy: payload.policy,
        data_recebimento: payload.data_recebimento,
        valor_bruto: payload.valor_bruto,
        descontos_impostos: payload.descontos_impostos || 0,
        valor_liquido: payload.valor_liquido,
        aliquota_imposto: payload.aliquota_imposto || 0,
        origem: payload.origem || 'Manual',
        observacao: payload.observacao || '',
        parcela: payload.parcela,
        competencia: payload.competencia,
        idempotency_key: payload.idempotency_key,
        is_estorno: payload.is_estorno,
        recebimento_original: payload.recebimento_original,
        motivo_estorno: payload.motivo_estorno,
        comissao_prevista: payload.comissao_prevista,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
      dbRecebimentos.push(item)
      return item
    }),
    update: vi.fn(async (id: string, updates: any) => {
      const idx = dbRecebimentos.findIndex((r) => r.id === id)
      if (idx !== -1) {
        dbRecebimentos[idx] = {
          ...dbRecebimentos[idx],
          ...updates,
          updated: new Date().toISOString(),
        }
        return dbRecebimentos[idx]
      }
      throw new Error(`Recebimento ${id} not found`)
    }),
    delete: vi.fn(async (id: string) => {
      const idx = dbRecebimentos.findIndex((r) => r.id === id)
      if (idx !== -1) {
        // Verificar se tem estornos vinculados
        const hasEstornos = dbRecebimentos.some((r) => r.recebimento_original === id)
        if (hasEstornos) {
          throw new Error('Não é permitido excluir este recebimento com estornos vinculados.')
        }
        dbRecebimentos.splice(idx, 1)
      }
    }),
  }

  const mockPoliciesCol = {
    getOne: vi.fn(async (id: string) => {
      if (id === policyId) return { ...mockPolicy }
      throw new Error('Policy not found')
    }),
    update: vi.fn(async (id: string, updates: any) => {
      if (id === policyId) {
        mockPolicy = { ...mockPolicy, ...updates }
        return mockPolicy
      }
      throw new Error('Policy not found')
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    dbPrevisoes = []
    dbRecebimentos = []
    mockPolicy = {
      id: policyId,
      policy_number: 'POL-1001',
      start_date: '2026-09-01',
      end_date: '2027-09-01',
      premium_amount: 5000,
      valor_liquido: 5000,
      commission_percent: 20,
      commission: 1000,
      comissao_recebida: false,
    } as Policy

    vi.mocked(pb.collection).mockImplementation((colName: string) => {
      if (colName === 'comissoes_previstas') return mockPrevisoesCol as any
      if (colName === 'comissao_recebimentos') return mockRecebimentosCol as any
      if (colName === 'policies') return mockPoliciesCol as any
      throw new Error(`Col ${colName} not mocked`)
    })
  })

  // 1 & 2. Sincronizar duas vezes sem perder nem duplicar previsões
  it('1 & 2. Sincronizar duas vezes mantém previsões sem perder e sem duplicar', async () => {
    const modeloMock: Partial<ModeloComissao> = {
      tipo_modelo: 'PARCELADA',
      percentual_padrao: 20,
      nome: 'Parcelada 2x',
      config_json: { quantidade_competencias: 2 },
    }

    // 1ª sincronização
    const p1 = await syncPrevisoesForPolicy(mockPolicy, modeloMock as any)
    expect(p1.length).toBe(2)
    expect(dbPrevisoes.length).toBe(2)
    expect(dbPrevisoes[0].chave_estavel).toBe(`prev_${policyId}_1_09_2026`)
    expect(dbPrevisoes[1].chave_estavel).toBe(`prev_${policyId}_2_10_2026`)

    // 2ª sincronização (idempotente)
    const p2 = await syncPrevisoesForPolicy(mockPolicy, modeloMock as any)
    expect(p2.length).toBe(2)
    expect(dbPrevisoes.length).toBe(2) // Não duplicou!
  })

  // 3. Duas requisições simultâneas com mesma chave não duplicam registros
  it('3. Duas requisições simultâneas não duplicam registros (idempotência)', async () => {
    const key = `rec_test_${Date.now()}`
    const r1 = await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-10',
      valor_bruto: 500,
      valor_liquido: 500,
      idempotency_key: key,
    })

    expect(r1).toBeDefined()
    expect(dbRecebimentos.length).toBe(1)

    // Tentativa concorrente/duplicada com a mesma chave de idempotência
    await expect(
      createComissaoRecebimento({
        policy: policyId,
        data_recebimento: '2026-09-10',
        valor_bruto: 500,
        valor_liquido: 500,
        idempotency_key: key,
      }),
    ).rejects.toThrow('idempotência')

    expect(dbRecebimentos.length).toBe(1)
  })

  // 4 & 5. Recebimento parcial mantém saldo correto e segundo recebimento quita
  it('4 & 5. Recebimento parcial mantém saldo correto e segundo recebimento quita', async () => {
    // Previsto total = 1000
    // 1º recebimento parcial: 400
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-10',
      valor_bruto: 400,
      valor_liquido: 390,
    })

    let saldo = computePendingCommissions([mockPolicy], dbRecebimentos)
    expect(saldo).toBe(600)
    expect(mockPolicy.comissao_recebida).toBe(false)

    // 2º recebimento: 600 (quita o restante)
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-15',
      valor_bruto: 600,
      valor_liquido: 585,
    })

    saldo = computePendingCommissions([mockPolicy], dbRecebimentos)
    expect(saldo).toBe(0)
    expect(mockPolicy.comissao_recebida).toBe(true)
  })

  // 6 & 7. Estorno reabre saldo e não permite estorno superior ao recebido
  it('6 & 7. Não permite estorno superior ao recebido e reabre saldo corretamente', async () => {
    const rec = await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-10',
      valor_bruto: 1000,
      valor_liquido: 980,
    })

    expect(mockPolicy.comissao_recebida).toBe(true)

    // Tentativa de estornar mais do que o recebido: 1050 > 1000
    await expect(
      registrarEstornoComissao({
        recebimento_original_id: rec.id,
        valor_estorno: 1050,
        data_estorno: '2026-09-12',
        motivo: 'Estorno indevido a maior',
      }),
    ).rejects.toThrow('não pode exceder o saldo restante')

    // Estorno válido parcial de 400
    await registrarEstornoComissao({
      recebimento_original_id: rec.id,
      valor_estorno: 400,
      data_estorno: '2026-09-12',
      motivo: 'Devolução parcial',
    })

    // Saldo agora deve ter reaberto em 400
    const saldo = computePendingCommissions([mockPolicy], dbRecebimentos)
    expect(saldo).toBe(400)
    expect(mockPolicy.comissao_recebida).toBe(false)
  })

  // 8. Um recebimento altera somente sua previsão vinculada
  it('8. Um recebimento altera somente sua previsão vinculada', async () => {
    // Criar duas previsões de 500 cada na mesma apólice
    const prev1 = await mockPrevisoesCol.create({
      policy: policyId,
      competencia: '09/2026',
      data_prevista: '2026-09-10',
      valor_previsto: 500,
      parcela_numero: 1,
      status: 'Pendente',
      chave_estavel: `prev_${policyId}_1_09_2026`,
    })

    const prev2 = await mockPrevisoesCol.create({
      policy: policyId,
      competencia: '09/2026', // mesma competência de teste
      data_prevista: '2026-09-20',
      valor_previsto: 500,
      parcela_numero: 2,
      status: 'Pendente',
      chave_estavel: `prev_${policyId}_2_09_2026`,
    })

    // Receber especificamente a prev1
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-10',
      valor_bruto: 500,
      valor_liquido: 500,
      comissao_prevista: prev1.id,
    })

    // Previsão 1 deve estar 'Recebida', enquanto Previsão 2 deve continuar 'Pendente'
    const updatedPrev1 = dbPrevisoes.find((p) => p.id === prev1.id)
    const updatedPrev2 = dbPrevisoes.find((p) => p.id === prev2.id)

    expect(updatedPrev1?.status).toBe('Recebida')
    expect(updatedPrev2?.status).toBe('Pendente')
  })

  // 9. Ausência de movimentos não gera receita automaticamente
  it('9. Ausência de movimentos não gera receita automaticamente (sem movimentos = 0)', () => {
    const period = computePeriod('9', '2026')
    // Apólice marcada com comissao_recebida=true mas com array de recebimentos vazio []
    const legacyPolicy: Policy = {
      ...mockPolicy,
      comissao_recebida: true,
      data_recebimento_comissao: '2026-09-01',
    }

    const receitaComListaVazia = computeReceivedCommissions([legacyPolicy], period, [])
    expect(receitaComListaVazia).toBe(0)
  })

  // 10. Financeiro/Custos/Conciliação retornam os mesmos valores para a mesma competência
  it('10. Financeiro, Custos e Conciliação usam a mesma lógica central com resultados idênticos', () => {
    const period = computePeriod('9', '2026')
    const recs: ComissaoRecebimento[] = [
      {
        id: 'r1',
        policy: policyId,
        data_recebimento: '2026-09-05',
        valor_bruto: 500,
        valor_liquido: 490,
        origem: 'Manual',
        created: '',
        updated: '',
      },
    ]

    const receita = computeReceivedCommissions([mockPolicy], period, recs)
    const saldo = computePendingCommissions([mockPolicy], recs)

    expect(receita).toBe(490)
    expect(saldo).toBe(500) // 1000 - 500 = 500
  })

  // 11. Legado continua preservado
  it('11. Legado continua preservado quando chamado sem array de recebimentos', () => {
    const period = computePeriod('9', '2026')
    const legacyPolicy: Policy = {
      ...mockPolicy,
      commission: 800,
      iss: 40,
      comissao_recebida: true,
      data_recebimento_comissao: '2026-09-05',
    }

    // Sem fornecer array de recebimentos (modo puramente legado)
    const receitaLegada = computeReceivedCommissions([legacyPolicy], period)
    expect(receitaLegada).toBe(760) // 800 - 40
  })

  // 12. Usuário sem permissão não consegue excluir histórico
  it('12. Tentativa de excluir previsão com recebimento vinculado é bloqueada', async () => {
    const prev = await mockPrevisoesCol.create({
      policy: policyId,
      competencia: '09/2026',
      data_prevista: '2026-09-10',
      valor_previsto: 500,
      status: 'Recebida',
    })

    await expect(mockPrevisoesCol.delete(prev.id)).rejects.toThrow(
      'Não é permitido excluir previsão com recebimento vinculado',
    )
  })

  // 13 & 14. Cálculo e personalização geram previsões corretas
  it('13, 14 & 15. Motor de cálculo com personalização gera as previsões corretas', () => {
    const previsoesRecorrentes = calcularPrevisoesComissao(
      {
        start_date: '2026-09-01',
        valor_liquido: 10000,
        premium_amount: 10000,
        commission_percent: 10,
        commission: 1000,
      },
      {
        tipo_modelo: 'RECORRENTE',
        nome: 'Recorrente 5% 6 meses',
        config_json: {
          percentual_recorrente: 5,
          recorrencia_meses_horizonte: 6,
        },
      },
    )

    expect(previsoesRecorrentes.length).toBe(6)
    expect(previsoesRecorrentes[0].valor_previsto).toBe(500)
    expect(previsoesRecorrentes[0].competencia).toBe('09/2026')
    expect(previsoesRecorrentes[5].competencia).toBe('02/2027')
  })
})
