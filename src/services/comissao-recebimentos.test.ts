import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createComissaoRecebimento, deleteComissaoRecebimento } from './comissao-recebimentos'
import pb from '@/lib/pocketbase/client'

// Mocking pb client
vi.mock('@/lib/pocketbase/client', () => {
  return {
    default: {
      collection: vi.fn(),
    },
  }
})

describe('Validação do Fluxo de Recebimento de Comissão — Caso R$ 250,00', () => {
  const policyId = 'pol_test_250'
  let mockPolicy = {
    id: policyId,
    policy_number: 'TESTE-250',
    commission: 250,
    comissao_recebida: false,
    data_recebimento_comissao: null,
  }
  let receiptsInDb: any[] = []

  const mockComissaoCol = {
    create: vi.fn(async (payload: any) => {
      // Checar idempotency_key única
      if (payload.idempotency_key) {
        const dup = receiptsInDb.find((r) => r.idempotency_key === payload.idempotency_key)
        if (dup) {
          throw new Error(
            `UNIQUE constraint failed: idx_comissao_rec_idempotency (${payload.idempotency_key})`,
          )
        }
      }
      const newRec = {
        id: `rec_${Date.now()}_${Math.random()}`,
        ...payload,
      }
      receiptsInDb.push(newRec)
      return newRec
    }),
    getFullList: vi.fn(async (options?: any) => {
      if (options?.filter?.includes(`policy = "${policyId}"`)) {
        return receiptsInDb.filter((r) => r.policy === policyId)
      }
      return receiptsInDb
    }),
    delete: vi.fn(async (id: string) => {
      receiptsInDb = receiptsInDb.filter((r) => r.id !== id)
    }),
  }

  const mockPoliciesCol = {
    getOne: vi.fn(async (id: string) => {
      if (id === policyId) return { ...mockPolicy }
      throw new Error('Not found')
    }),
    update: vi.fn(async (id: string, updates: any) => {
      if (id === policyId) {
        mockPolicy = { ...mockPolicy, ...updates }
        return mockPolicy
      }
      throw new Error('Not found')
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    receiptsInDb = []
    mockPolicy = {
      id: policyId,
      policy_number: 'TESTE-250',
      commission: 250,
      comissao_recebida: false,
      data_recebimento_comissao: null,
    }

    vi.mocked(pb.collection).mockImplementation((colName: string) => {
      if (colName === 'comissao_recebimentos') return mockComissaoCol as any
      if (colName === 'policies') return mockPoliciesCol as any
      throw new Error(`Unexpected collection ${colName}`)
    })
  })

  it('Cenário R$ 250: 1ª baixa de R$ 100 mantém status pendente/parcial (já recebido 100, saldo 150)', async () => {
    // 1ª baixa de R$ 100
    const rec1 = await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-10',
      valor_bruto: 100,
      valor_liquido: 100,
      descontos_impostos: 0,
      origem: 'Manual',
      idempotency_key: 'idemp_key_1',
    })

    expect(rec1.valor_liquido).toBe(100)

    // Verificar se a apólice NÃO foi quitada
    expect(mockPoliciesCol.update).toHaveBeenCalledWith(policyId, {
      comissao_recebida: false,
      data_recebimento_comissao: '2026-09-10',
    })
    expect(mockPolicy.comissao_recebida).toBe(false)

    // Cálculos de saldo na regra de negócio
    const allRecs = await mockComissaoCol.getFullList({ filter: `policy = "${policyId}"` })
    const totalRecebido = allRecs.reduce((sum, r) => sum + r.valor_liquido, 0)
    const saldo = mockPolicy.commission - totalRecebido

    expect(totalRecebido).toBe(100)
    expect(saldo).toBe(150)
  })

  it('Cenário R$ 250: 2ª baixa de R$ 150 completa R$ 250, saldo R$ 0 e comissao_recebida = true', async () => {
    // 1ª baixa R$ 100
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-10',
      valor_bruto: 100,
      valor_liquido: 100,
      descontos_impostos: 0,
      origem: 'Manual',
      idempotency_key: 'idemp_key_1',
    })

    expect(mockPolicy.comissao_recebida).toBe(false)

    // 2ª baixa R$ 150
    const rec2 = await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-11',
      valor_bruto: 150,
      valor_liquido: 150,
      descontos_impostos: 0,
      origem: 'Manual',
      idempotency_key: 'idemp_key_2',
    })

    expect(rec2.valor_liquido).toBe(150)

    // Verificar que agora a apólice foi marcada com comissao_recebida = true
    expect(mockPoliciesCol.update).toHaveBeenLastCalledWith(policyId, {
      comissao_recebida: true,
      data_recebimento_comissao: '2026-09-11',
    })
    expect(mockPolicy.comissao_recebida).toBe(true)

    // Verificar soma e saldo
    const allRecs = await mockComissaoCol.getFullList({ filter: `policy = "${policyId}"` })
    const totalRecebido = allRecs.reduce((sum, r) => sum + r.valor_liquido, 0)
    const saldo = mockPolicy.commission - totalRecebido

    expect(totalRecebido).toBe(250)
    expect(saldo).toBe(0)
  })

  it('Idempotency Key: previne baixa duplicada com a mesma chave', async () => {
    const payload = {
      policy: policyId,
      data_recebimento: '2026-09-10',
      valor_bruto: 100,
      valor_liquido: 100,
      origem: 'Manual',
      idempotency_key: 'idemp_key_duplicate_test',
    }

    await createComissaoRecebimento(payload)

    // Tentar criar novamente com a mesma idempotency_key deve falhar
    await expect(createComissaoRecebimento(payload)).rejects.toThrow(/UNIQUE constraint failed/)
  })

  it('Exclusão de recebimento reverte status se saldo ficar em aberto', async () => {
    // Criar baixa integral de 250
    const rec = await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-10',
      valor_bruto: 250,
      valor_liquido: 250,
      origem: 'Manual',
      idempotency_key: 'idemp_full',
    })

    expect(mockPolicy.comissao_recebida).toBe(true)

    // Excluir recebimento
    await deleteComissaoRecebimento(rec.id, policyId)

    // Deve voltar para false
    expect(mockPolicy.comissao_recebida).toBe(false)
    expect(mockPolicy.data_recebimento_comissao).toBeNull()
  })
})
