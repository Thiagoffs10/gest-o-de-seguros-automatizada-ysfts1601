import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { calcularPrevisoesComissao } from './comissao-engine'
import { createComissaoRecebimento, registrarEstornoComissao } from './comissao-recebimentos'
import { syncPrevisoesForPolicy } from './modelos-comissao'
import { computePendingCommissions, computeReceivedGrossCommissions } from '@/lib/financial-calcs'
import { Policy, ModeloComissao } from '@/types'

vi.mock('@/lib/pocketbase/client', () => {
  return {
    default: {
      authStore: { record: { id: 'usr_test', name: 'Tester' } },
      collection: vi.fn(),
    },
  }
})

describe('POR_ESGOTAMENTO (Por saldo/esgotamento) — Regra Nova e Garantias', () => {
  let dbComissaoRecebimentos: any[] = []
  let dbComissoesPrevistas: any[] = []
  let dbPolicies: any[] = []

  const mockComissaoRecCol = {
    create: vi.fn(async (payload: any) => {
      const rec = { id: `rec_${Date.now()}_${Math.random()}`, ...payload }
      dbComissaoRecebimentos.push(rec)
      return rec
    }),
    getOne: vi.fn(async (id: string) => {
      const found = dbComissaoRecebimentos.find((r) => r.id === id)
      if (found) return { ...found }
      throw new Error(`Receipt ${id} not found`)
    }),
    getFullList: vi.fn(async (options?: any) => {
      let res = [...dbComissaoRecebimentos]
      if (options?.filter) {
        if (options.filter.includes('recebimento_original = "')) {
          const match = options.filter.match(/recebimento_original = "([^"]+)"/)
          if (match) res = res.filter((r) => r.recebimento_original === match[1])
        } else if (options.filter.includes('policy = "')) {
          const match = options.filter.match(/policy = "([^"]+)"/)
          if (match) res = res.filter((r) => r.policy === match[1])
        }
      }
      return res
    }),
  }

  const mockPrevisoesCol = {
    create: vi.fn(async (payload: any) => {
      const prev = { id: `prev_${Date.now()}_${Math.random()}`, ...payload }
      dbComissoesPrevistas.push(prev)
      return prev
    }),
    getFullList: vi.fn(async (options?: any) => {
      let res = [...dbComissoesPrevistas]
      if (options?.filter?.includes('policy = "')) {
        const match = options.filter.match(/policy = "([^"]+)"/)
        if (match) res = res.filter((p) => p.policy === match[1])
      }
      return res
    }),
    update: vi.fn(async (id: string, updates: any) => {
      const idx = dbComissoesPrevistas.findIndex((p) => p.id === id)
      if (idx !== -1) {
        dbComissoesPrevistas[idx] = { ...dbComissoesPrevistas[idx], ...updates }
        return { ...dbComissoesPrevistas[idx] }
      }
      throw new Error(`Previsao ${id} not found`)
    }),
    delete: vi.fn(async (id: string) => {
      const idx = dbComissoesPrevistas.findIndex((p) => p.id === id)
      if (idx !== -1) {
        dbComissoesPrevistas.splice(idx, 1)
        return true
      }
      throw new Error(`Previsao ${id} not found`)
    }),
  }

  const mockPoliciesCol = {
    getOne: vi.fn(async (id: string) => {
      const found = dbPolicies.find((p) => p.id === id)
      if (found) return { ...found }
      throw new Error(`Policy ${id} not found`)
    }),
    update: vi.fn(async (id: string, updates: any) => {
      const idx = dbPolicies.findIndex((p) => p.id === id)
      if (idx !== -1) {
        dbPolicies[idx] = { ...dbPolicies[idx], ...updates }
        return { ...dbPolicies[idx] }
      }
      throw new Error(`Policy ${id} not found`)
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    dbComissaoRecebimentos = []
    dbComissoesPrevistas = []
    dbPolicies = []

    vi.mocked(pb.collection).mockImplementation((col: string) => {
      if (col === 'comissao_recebimentos') return mockComissaoRecCol as any
      if (col === 'comissoes_previstas') return mockPrevisoesCol as any
      if (col === 'policies') return mockPoliciesCol as any
      throw new Error(`Unexpected collection ${col}`)
    })
  })

  // Teste 1: Apólice com comissão bruta R$ 1.000 e ISS R$ 20 -> 1 única previsão de R$ 980 (líquida), sem série
  it('1. Apólice com comissão bruta R$ 1.000 e ISS R$ 20 gera 1 única previsão de R$ 980 (líquida), sem série', () => {
    const policy = {
      start_date: '2026-05-10',
      valor_liquido: 5000,
      premium_amount: 5000,
      commission: 1000,
      iss: 20,
    }

    const modelo: Partial<ModeloComissao> = {
      id: 'mod-esgotamento-1',
      tipo_modelo: 'POR_ESGOTAMENTO',
      nome: 'Vida Saldo Esgotamento',
      // Mesmo que contenha lixo antigo de config, a comissão líquida da apólice prevalece
      config_json: {
        saldo_total: 9999,
        valor_estimado_parcela: 300,
      },
    }

    const prevs = calcularPrevisoesComissao(policy, modelo as ModeloComissao)

    expect(prevs).toHaveLength(1)
    expect(prevs[0].valor_previsto).toBe(980) // 1000 - 20
    expect(prevs[0].parcela_numero).toBe(1)
    expect(prevs[0].competencia).toBe('05/2026')
    expect(prevs[0].data_prevista).toBe('2026-05-10')
    expect(prevs[0].observacao).toContain('Comissão Líquida Prevista: R$ 980.00')
  })

  // Teste 2: Recebimento parcial -> status Parcial e saldo a receber = 980 - recebido
  it('2. Recebimento parcial mantém comissão como Parcial e saldo a receber = Líquida Prevista - recebido', async () => {
    const policyId = 'pol_esgotamento_2'
    const policyObj: Policy = {
      id: policyId,
      policy_number: 'AP-ESG-02',
      start_date: '2026-05-10',
      end_date: '2027-05-10',
      client: 'cli-1',
      seguradora: 'seg-1',
      tipo_de_seguro: 'Vida',
      status: 'Ativa',
      commission: 980, // Comissão líquida esperada no cadastro
      iss: 0,
      comissao_recebida: false,
    } as any

    dbPolicies.push({ ...policyObj })

    // Criar a previsão única correspondente (R$ 980)
    const prevItem = await mockPrevisoesCol.create({
      policy: policyId,
      competencia: '05/2026',
      data_prevista: '2026-05-10',
      valor_previsto: 980,
      parcela_numero: 1,
      status: 'Pendente',
      chave_estavel: `prev_${policyId}_1_05_2026`,
    })

    // Baixa manual parcial de R$ 300
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-05-15',
      valor_bruto: 300,
      valor_liquido: 300,
      comissao_prevista: prevItem.id,
    })

    // 1. Total recebido bruto
    const totalRecebido = dbComissaoRecebimentos.reduce((s, r) => s + Number(r.valor_bruto || 0), 0)
    expect(totalRecebido).toBe(300)

    // 2. Saldo a receber = 980 - 300 = 680
    const saldoAReceber = computePendingCommissions([dbPolicies[0]], dbComissaoRecebimentos)
    expect(saldoAReceber).toBe(680)

    // 3. Status da previsão e da apólice
    const updatedPrev = dbComissoesPrevistas.find((p) => p.id === prevItem.id)
    expect(updatedPrev.status).toBe('Parcial')
    expect(dbPolicies[0].comissao_recebida).toBe(false)
  })

  // Teste 3: Recebimentos até zerar o saldo -> Quitada (Recebida)
  it('3. Recebimentos até zerar o saldo consideram a comissão Quitada', async () => {
    const policyId = 'pol_esgotamento_3'
    const policyObj: Policy = {
      id: policyId,
      policy_number: 'AP-ESG-03',
      start_date: '2026-05-10',
      end_date: '2027-05-10',
      client: 'cli-1',
      seguradora: 'seg-1',
      tipo_de_seguro: 'Vida',
      status: 'Ativa',
      commission: 980,
      iss: 0,
      comissao_recebida: false,
    } as any

    dbPolicies.push({ ...policyObj })

    const prevItem = await mockPrevisoesCol.create({
      policy: policyId,
      competencia: '05/2026',
      data_prevista: '2026-05-10',
      valor_previsto: 980,
      parcela_numero: 1,
      status: 'Pendente',
      chave_estavel: `prev_${policyId}_1_05_2026`,
    })

    // 1ª baixa de R$ 500
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-05-15',
      valor_bruto: 500,
      valor_liquido: 500,
      comissao_prevista: prevItem.id,
    })

    // 2ª baixa de R$ 480 (total = 980)
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-05-20',
      valor_bruto: 480,
      valor_liquido: 480,
      comissao_prevista: prevItem.id,
    })

    const totalRecebido = dbComissaoRecebimentos.reduce((s, r) => s + Number(r.valor_bruto || 0), 0)
    expect(totalRecebido).toBe(980)

    const saldoAReceber = computePendingCommissions([dbPolicies[0]], dbComissaoRecebimentos)
    expect(saldoAReceber).toBe(0)

    const updatedPrev = dbComissoesPrevistas.find((p) => p.id === prevItem.id)
    expect(updatedPrev.status).toBe('Recebida')
    expect(dbPolicies[0].comissao_recebida).toBe(true)
  })

  // Teste 4: Estorno reabre o saldo
  it('4. Estorno reabre o saldo a receber e retorna o status para Parcial/Pendente', async () => {
    const policyId = 'pol_esgotamento_4'
    const policyObj: Policy = {
      id: policyId,
      policy_number: 'AP-ESG-04',
      start_date: '2026-05-10',
      end_date: '2027-05-10',
      client: 'cli-1',
      seguradora: 'seg-1',
      tipo_de_seguro: 'Vida',
      status: 'Ativa',
      commission: 980,
      iss: 0,
      comissao_recebida: true,
    } as any

    dbPolicies.push({ ...policyObj })

    const prevItem = await mockPrevisoesCol.create({
      policy: policyId,
      competencia: '05/2026',
      data_prevista: '2026-05-10',
      valor_previsto: 980,
      parcela_numero: 1,
      status: 'Recebida',
      chave_estavel: `prev_${policyId}_1_05_2026`,
    })

    const rec = await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-05-15',
      valor_bruto: 980,
      valor_liquido: 980,
      comissao_prevista: prevItem.id,
    })

    expect(dbPolicies[0].comissao_recebida).toBe(true)

    // Estorno de R$ 200
    await registrarEstornoComissao({
      recebimento_original_id: rec.id,
      valor_estorno: 200,
      data_estorno: '2026-05-18',
      motivo: 'Ajuste de comissão por estorno parcial',
    })

    const totalRecebido = dbComissaoRecebimentos.reduce((s, r) => s + Number(r.valor_bruto || 0), 0)
    expect(totalRecebido).toBe(780) // 980 - 200

    const saldoAReceber = computePendingCommissions([dbPolicies[0]], dbComissaoRecebimentos)
    expect(saldoAReceber).toBe(200)

    const updatedPrev = dbComissoesPrevistas.find((p) => p.id === prevItem.id)
    expect(updatedPrev.status).toBe('Parcial')
    expect(dbPolicies[0].comissao_recebida).toBe(false)
  })

  // Teste 5: Re-sincronizar duas vezes não duplica nem apaga
  it('5. Re-sincronizar duas vezes com syncPrevisoesForPolicy não duplica nem apaga previsão', async () => {
    const policyId = 'pol_esgotamento_5'
    const policyObj: Policy = {
      id: policyId,
      policy_number: 'AP-ESG-05',
      start_date: '2026-05-10',
      end_date: '2027-05-10',
      client: 'cli-1',
      seguradora: 'seg-1',
      tipo_de_seguro: 'Vida',
      status: 'Ativa',
      commission: 1000,
      iss: 20,
      comissao_personalizada_config: {
        tipo_modelo: 'POR_ESGOTAMENTO',
      },
    } as any

    dbPolicies.push({ ...policyObj })

    // 1ª sincronização
    const r1 = await syncPrevisoesForPolicy(policyObj)
    expect(r1).toHaveLength(1)
    expect(r1[0].valor_previsto).toBe(980)
    expect(dbComissoesPrevistas).toHaveLength(1)

    // 2ª sincronização idempotente
    const r2 = await syncPrevisoesForPolicy(policyObj)
    expect(r2).toHaveLength(1)
    expect(r2[0].valor_previsto).toBe(980)
    expect(dbComissoesPrevistas).toHaveLength(1) // nenhuma duplicação
  })

  // Teste 6: Os outros 4 tipos nativos continuam gerando exatamente como antes
  it('6. Os outros 4 tipos (À vista, Parcelada, Recorrente, Por fases) continuam gerando normalmente', () => {
    const basePolicy = {
      start_date: '2026-01-10',
      valor_liquido: 10000,
      premium_amount: 10000,
      commission: 1000,
      commission_percent: 10,
    }

    // A_VISTA
    const prevsAVista = calcularPrevisoesComissao(basePolicy, {
      tipo_modelo: 'A_VISTA',
      nome: 'À Vista',
    })
    expect(prevsAVista).toHaveLength(1)
    expect(prevsAVista[0].valor_previsto).toBe(1000)

    // PARCELADA (3x)
    const prevsParcelada = calcularPrevisoesComissao(basePolicy, {
      tipo_modelo: 'PARCELADA',
      nome: '3x',
      config_json: { quantidade_competencias: 3 },
    })
    expect(prevsParcelada).toHaveLength(3)
    const somaParcelada = prevsParcelada.reduce((acc, p) => acc + p.valor_previsto, 0)
    expect(somaParcelada).toBe(1000)

    // RECORRENTE (5% em 4 meses)
    const prevsRecorrente = calcularPrevisoesComissao(basePolicy, {
      tipo_modelo: 'RECORRENTE',
      nome: 'Recorrente',
      config_json: { percentual_recorrente: 5, recorrencia_meses_horizonte: 4 },
    })
    expect(prevsRecorrente).toHaveLength(4)
    expect(prevsRecorrente[0].valor_previsto).toBe(500)

    // POR_FASES
    const prevsFases = calcularPrevisoesComissao(basePolicy, {
      tipo_modelo: 'POR_FASES',
      nome: 'Fases',
      config_json: {
        fases: [
          { mes_inicio: 1, mes_fim: 2, percentual: 50 },
          { mes_inicio: 3, mes_fim: 3, percentual: 10 },
        ],
      },
    })
    expect(prevsFases).toHaveLength(3)
    expect(prevsFases[0].valor_previsto).toBe(500)
    expect(prevsFases[1].valor_previsto).toBe(500)
    expect(prevsFases[2].valor_previsto).toBe(100)
  })
})
