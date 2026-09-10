import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createComissaoRecebimento,
  updateComissaoRecebimento,
  deleteComissaoRecebimento,
} from './comissao-recebimentos'
import pb from '@/lib/pocketbase/client'
import {
  computePendingCommissions,
  computeReceivedCommissions,
  computeReceivedGrossCommissions,
} from '@/lib/financial-calcs'
import { Policy } from '@/types'
import { computePeriod } from '@/lib/date-filter'

// Mocking pb client
vi.mock('@/lib/pocketbase/client', () => {
  return {
    default: {
      collection: vi.fn(),
    },
  }
})

describe('Validação Obrigatória do Caso R$ 553,71 (Comissão Prevista)', () => {
  const policyId = 'y929ragrt9gbgfc'
  let mockPolicy: any
  let receiptsInDb: any[] = []

  const mockComissaoCol = {
    create: vi.fn(async (payload: any) => {
      const newRec = {
        id: `rec_${Date.now()}_${Math.random()}`,
        ...payload,
      }
      receiptsInDb.push(newRec)
      return newRec
    }),
    getOne: vi.fn(async (id: string) => {
      const rec = receiptsInDb.find((r) => r.id === id)
      if (rec) return { ...rec }
      throw new Error(`Receipt ${id} not found`)
    }),
    update: vi.fn(async (id: string, updates: any) => {
      const idx = receiptsInDb.findIndex((r) => r.id === id)
      if (idx !== -1) {
        receiptsInDb[idx] = { ...receiptsInDb[idx], ...updates }
        return { ...receiptsInDb[idx] }
      }
      throw new Error(`Receipt ${id} not found`)
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
      policy_number: '140779933',
      commission: 553.71,
      start_date: '2026-09-12',
      comissao_recebida: false,
      data_recebimento_comissao: '2026-09-10',
    }

    vi.mocked(pb.collection).mockImplementation((colName: string) => {
      if (colName === 'comissao_recebimentos') return mockComissaoCol as any
      if (colName === 'policies') return mockPoliciesCol as any
      throw new Error(`Unexpected collection ${colName}`)
    })
  })

  it('Etapa 1: Validar lançamento usuário (Previsto 553,71 / Bruto 100 / Imposto 2 / Líquido 98)', async () => {
    const rec1 = await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-10',
      valor_bruto: 100,
      descontos_impostos: 2,
      valor_liquido: 98,
      origem: 'Manual',
      idempotency_key: 'rec_orig_1',
    })

    const pols: Policy[] = [mockPolicy as Policy]
    const period = computePeriod('9', '2026')

    const jaRecebidoBruto = computeReceivedGrossCommissions(pols, period, receiptsInDb)
    const saldoPendente = computePendingCommissions(pols, receiptsInDb)
    const receitaLiquida = computeReceivedCommissions(pols, period, receiptsInDb)

    expect(jaRecebidoBruto).toBe(100.0)
    expect(saldoPendente).toBe(453.71)
    expect(receitaLiquida).toBe(98.0)
    expect(mockPolicy.comissao_recebida).toBe(false) // Parcial
  })

  it('Etapa 2: Editar recebimento para bruto R$ 150 (imposto R$ 3, líquido R$ 147) e recalcular tudo', async () => {
    const rec1 = await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-10',
      valor_bruto: 100,
      descontos_impostos: 2,
      valor_liquido: 98,
      origem: 'Manual',
      idempotency_key: 'rec_orig_1',
    })

    // Edição
    await updateComissaoRecebimento(rec1.id, {
      valor_bruto: 150,
      descontos_impostos: 3,
      valor_liquido: 147,
      editor_info: 'Usuário Teste',
    })

    const pols: Policy[] = [mockPolicy as Policy]
    const period = computePeriod('9', '2026')

    const jaRecebidoBruto = computeReceivedGrossCommissions(pols, period, receiptsInDb)
    const saldoPendente = computePendingCommissions(pols, receiptsInDb)
    const receitaLiquida = computeReceivedCommissions(pols, period, receiptsInDb)

    expect(jaRecebidoBruto).toBe(150.0)
    expect(saldoPendente).toBe(403.71)
    expect(receitaLiquida).toBe(147.0)
    expect(mockPolicy.comissao_recebida).toBe(false) // Continua Parcial pois 150 < 553.71
  })

  it('Etapa 3: Excluir/desfazer e confirmar retorno para Pendente com saldo integral 553,71', async () => {
    const rec1 = await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-10',
      valor_bruto: 100,
      descontos_impostos: 2,
      valor_liquido: 98,
      origem: 'Manual',
      idempotency_key: 'rec_orig_1',
    })

    await deleteComissaoRecebimento(rec1.id, policyId)

    const pols: Policy[] = [mockPolicy as Policy]
    const period = computePeriod('9', '2026')

    const jaRecebidoBruto = computeReceivedGrossCommissions(pols, period, receiptsInDb)
    const saldoPendente = computePendingCommissions(pols, receiptsInDb)
    const receitaLiquida = computeReceivedCommissions(pols, period, receiptsInDb)

    expect(jaRecebidoBruto).toBe(0)
    expect(saldoPendente).toBe(553.71)
    expect(receitaLiquida).toBe(0)
    expect(mockPolicy.comissao_recebida).toBe(false)
    expect(mockPolicy.data_recebimento_comissao).toBeNull()
  })

  it('Etapa 4: Quitação total quando recebimento bruto atingir 553,71', async () => {
    // 1º recebimento bruto 100
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-10',
      valor_bruto: 100,
      descontos_impostos: 2,
      valor_liquido: 98,
    })

    // 2º recebimento bruto 453,71 (imposto 9,07, liquido 444,64)
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-09-15',
      valor_bruto: 453.71,
      descontos_impostos: 9.07,
      valor_liquido: 444.64,
    })

    const pols: Policy[] = [mockPolicy as Policy]
    const period = computePeriod('9', '2026')

    const jaRecebidoBruto = computeReceivedGrossCommissions(pols, period, receiptsInDb)
    const saldoPendente = computePendingCommissions(pols, receiptsInDb)
    const receitaLiquida = computeReceivedCommissions(pols, period, receiptsInDb)

    expect(jaRecebidoBruto).toBe(553.71)
    expect(saldoPendente).toBe(0)
    expect(receitaLiquida).toBe(542.64)
    expect(mockPolicy.comissao_recebida).toBe(true) // Quitado!
  })
})
