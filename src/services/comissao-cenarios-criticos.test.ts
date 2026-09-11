import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  createComissaoRecebimento,
  recalcularStatusApolice,
  registrarEstornoComissao,
} from './comissao-recebimentos'
import { findSuggestedModelo } from './modelos-comissao'
import { addMonthsToDateWithClamp, calcularPrevisoesComissao } from './comissao-engine'
import { cancelPolicy } from './policies'

vi.mock('@/lib/pocketbase/client', () => {
  return {
    default: {
      authStore: { record: { id: 'usr_test', name: 'Tester' } },
      collection: vi.fn(),
    },
  }
})

describe('Testes dos 9 Cenários Críticos de Auditoria Financeira (ITEM D)', () => {
  let dbComissaoRecebimentos: any[] = []
  let dbComissoesPrevistas: any[] = []
  let dbPolicies: any[] = []
  let dbModelosComissao: any[] = []

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

  const mockModelosCol = {
    getFullList: vi.fn(async () => {
      return [...dbModelosComissao]
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    dbComissaoRecebimentos = []
    dbComissoesPrevistas = []
    dbPolicies = []
    dbModelosComissao = []

    vi.mocked(pb.collection).mockImplementation((col: string) => {
      if (col === 'comissao_recebimentos') return mockComissaoRecCol as any
      if (col === 'comissoes_previstas') return mockPrevisoesCol as any
      if (col === 'policies') return mockPoliciesCol as any
      if (col === 'modelos_comissao') return mockModelosCol as any
      throw new Error(`Unexpected collection ${col}`)
    })
  })

  // (1) Recebimento com ID atualiza somente a previsão vinculada
  it('(1) recebimento com ID atualiza somente a previsão vinculada', async () => {
    const policyId = 'pol_1'
    dbPolicies.push({ id: policyId, commission: 500, comissao_recebida: false })

    dbComissoesPrevistas.push(
      {
        id: 'prev_1',
        policy: policyId,
        competencia: '01/2026',
        valor_previsto: 250,
        status: 'Pendente',
      },
      {
        id: 'prev_2',
        policy: policyId,
        competencia: '02/2026',
        valor_previsto: 250,
        status: 'Pendente',
      },
    )

    // Criar recebimento com vínculo explícito a prev_1
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-01-15',
      valor_bruto: 250,
      valor_liquido: 250,
      comissao_prevista: 'prev_1',
    })

    const p1 = dbComissoesPrevistas.find((p) => p.id === 'prev_1')
    const p2 = dbComissoesPrevistas.find((p) => p.id === 'prev_2')

    expect(p1?.status).toBe('Recebida')
    expect(p2?.status).toBe('Pendente')
  })

  // (2) Duas previsões na mesma competência — recebimento altera apenas uma
  it('(2) duas previsões na mesma competência — recebimento altera apenas uma', async () => {
    const policyId = 'pol_2'
    dbPolicies.push({ id: policyId, commission: 600, comissao_recebida: false })

    // Duas previsões ambas na mesma competência 03/2026
    dbComissoesPrevistas.push(
      {
        id: 'prev_a',
        policy: policyId,
        competencia: '03/2026',
        valor_previsto: 300,
        status: 'Pendente',
      },
      {
        id: 'prev_b',
        policy: policyId,
        competencia: '03/2026',
        valor_previsto: 300,
        status: 'Pendente',
      },
    )

    // Recebimento vincula pelo ID soberano prev_a
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-03-10',
      valor_bruto: 300,
      valor_liquido: 300,
      competencia: '03/2026',
      comissao_prevista: 'prev_a',
    })

    const pa = dbComissoesPrevistas.find((p) => p.id === 'prev_a')
    const pbItem = dbComissoesPrevistas.find((p) => p.id === 'prev_b')

    expect(pa?.status).toBe('Recebida')
    expect(pbItem?.status).toBe('Pendente') // prev_b NÃO pode ser afetada
  })

  // (3) Parcial -> saldo correto -> segundo recebimento quita (Pendente -> Parcial -> Recebida)
  it('(3) parcial -> saldo correto -> segundo recebimento quita (Pendente->Parcial->Recebida)', async () => {
    const policyId = 'pol_3'
    dbPolicies.push({ id: policyId, commission: 400, comissao_recebida: false })

    dbComissoesPrevistas.push({
      id: 'prev_single',
      policy: policyId,
      competencia: '04/2026',
      valor_previsto: 400,
      status: 'Pendente',
    })

    // 1º recebimento parcial: 150 de 400
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-04-05',
      valor_bruto: 150,
      valor_liquido: 150,
      comissao_prevista: 'prev_single',
    })

    let prevItem = dbComissoesPrevistas.find((p) => p.id === 'prev_single')
    expect(prevItem?.status).toBe('Parcial')

    // 2º recebimento quitando o saldo de 250
    await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-04-20',
      valor_bruto: 250,
      valor_liquido: 250,
      comissao_prevista: 'prev_single',
    })

    prevItem = dbComissoesPrevistas.find((p) => p.id === 'prev_single')
    expect(prevItem?.status).toBe('Recebida')
    expect(dbPolicies[0].comissao_recebida).toBe(true)
  })

  // (4) Estorno −R$200 sobre +R$500 = líquido R$300, original intacto
  it('(4) estorno −R$200 sobre +R$500 = líquido R$300, original intacto', async () => {
    const policyId = 'pol_4'
    dbPolicies.push({ id: policyId, commission: 500, comissao_recebida: true })

    const original = await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-05-01',
      valor_bruto: 500,
      valor_liquido: 500,
      aliquota_imposto: 0,
      origem: 'Manual',
    })

    expect(original.valor_bruto).toBe(500)

    // Registrar estorno de 200
    const estorno = await registrarEstornoComissao({
      recebimento_original_id: original.id,
      valor_estorno: 200,
      data_estorno: '2026-05-05',
      motivo: 'Ajuste de cancelamento parcial',
    })

    expect(estorno.valor_bruto).toBe(-200)
    expect(estorno.recebimento_original).toBe(original.id)

    // Original permanece intacto no banco
    const origNoBanco = dbComissaoRecebimentos.find((r) => r.id === original.id)
    expect(origNoBanco.valor_bruto).toBe(500)

    // Total líquido e bruto recalculados
    const status = await recalcularStatusApolice(policyId)
    expect(status?.totalBrutoRecebido).toBe(300)
    expect(status?.totalLiquidoRecebido).toBe(300)
  })

  // (5) Estorno concorrente R$400+R$400 contra R$500: segunda tentativa falha
  it('(5) estorno concorrente R$400+R$400 contra R$500: segunda tentativa falha', async () => {
    const policyId = 'pol_5'
    dbPolicies.push({ id: policyId, commission: 500, comissao_recebida: true })

    const original = await createComissaoRecebimento({
      policy: policyId,
      data_recebimento: '2026-06-01',
      valor_bruto: 500,
      valor_liquido: 500,
    })

    // 1º estorno de 400 (saldo disponível restante: 100)
    await registrarEstornoComissao({
      recebimento_original_id: original.id,
      valor_estorno: 400,
      data_estorno: '2026-06-02',
      motivo: 'Primeiro estorno parcial',
    })

    // 2º estorno de 400 deve falhar pois excede os 100 restantes
    await expect(
      registrarEstornoComissao({
        recebimento_original_id: original.id,
        valor_estorno: 400,
        data_estorno: '2026-06-03',
        motivo: 'Segundo estorno concorrente',
      }),
    ).rejects.toThrow(/não pode exceder o saldo restante/)
  })

  // (6) Sugestão não retorna modelo de outra seguradora e respeita valido_a_partir_de
  it('(6) sugestão não retorna modelo de outra seguradora e respeita valido_a_partir_de', async () => {
    dbModelosComissao.push(
      // Modelo de OUTRA seguradora para o mesmo produto
      {
        id: 'mod_outra_seg',
        nome: 'Modelo Porto Auto',
        seguradora: 'seg_porto',
        tipo_seguro: 'Auto',
        ativo: true,
        valido_a_partir_de: '2026-01-01',
      },
      // Modelo da seguradora alvo porém com vigência FUTURA
      {
        id: 'mod_futuro',
        nome: 'Modelo Bradesco Auto Futuro',
        seguradora: 'seg_bradesco',
        tipo_seguro: 'Auto',
        ativo: true,
        valido_a_partir_de: '2099-01-01',
      },
      // Modelo da seguradora alvo com vigência ATUAL
      {
        id: 'mod_correto',
        nome: 'Modelo Bradesco Auto Vigente',
        seguradora: 'seg_bradesco',
        tipo_seguro: 'Auto',
        ativo: true,
        valido_a_partir_de: '2026-01-01',
      },
    )

    // Busca para Bradesco + Auto na data de 2026-06-01
    const sugestao = await findSuggestedModelo('seg_bradesco', 'Auto', '2026-06-01')
    expect(sugestao).not.toBeNull()
    expect(sugestao?.id).toBe('mod_correto')

    // Busca para outra seguradora que não tem modelo: JAMAIS pode sugerir Porto ou Bradesco
    const sugestaoDesconhecida = await findSuggestedModelo('seg_sulamerica', 'Auto', '2026-06-01')
    expect(sugestaoDesconhecida).toBeNull()

    // Se a data de referência for antes de 2026-01-01, não deve sugerir mod_correto
    const sugestaoPassada = await findSuggestedModelo('seg_bradesco', 'Auto', '2025-01-01')
    expect(sugestaoPassada).toBeNull()
  })

  // (7) Parcelada clamp 29/30/31 e virada de ano
  it('(7) Parcelada clamp 29/30/31 e virada de ano', () => {
    // 31/01 em ano não-bissexto (2025): +1 mês -> 28/02/2025
    const r1 = addMonthsToDateWithClamp('2025-01-31', 1)
    expect(r1.dateStr).toBe('2025-02-28')
    expect(r1.comp).toBe('02/2025')

    // 31/01 em ano bissexto (2024): +1 mês -> 29/02/2024
    const r2 = addMonthsToDateWithClamp('2024-01-31', 1)
    expect(r2.dateStr).toBe('2024-02-29')
    expect(r2.comp).toBe('02/2024')

    // 31/10: +1 mês -> 30/11
    const r3 = addMonthsToDateWithClamp('2026-10-31', 1)
    expect(r3.dateStr).toBe('2026-11-30')

    // 31/12: +1 mês -> 31/01 com virada correta de ano 2027
    const r4 = addMonthsToDateWithClamp('2026-12-31', 1)
    expect(r4.dateStr).toBe('2027-01-31')
    expect(r4.comp).toBe('01/2027')
  })

  // (8) Por fases descontínuas sem previsão no intervalo nem após a última
  it('(8) Por fases descontínuas sem previsão no intervalo nem após a última', () => {
    const policy = {
      start_date: '2026-01-15',
      valor_liquido: 1000,
      commission_percent: 10,
    }

    // Fases descontínuas: Fase 1 (mês 1) e Fase 2 (mês 3 a 4). Mês 2 é intervalo sem comissão.
    // Última fase termina no mês 4 (fechada), logo nada deve ser gerado no mês 5+
    const modelo = {
      tipo_modelo: 'POR_FASES' as const,
      config_json: {
        fases: [
          { mes_inicio: 1, mes_fim: 1, percentual: 50 }, // mês 1 (01/2026): R$ 500
          { mes_inicio: 3, mes_fim: 4, percentual: 10 }, // meses 3 e 4 (03/2026 e 04/2026): R$ 100 cada
        ],
      },
    }

    const prevs = calcularPrevisoesComissao(policy, modelo)

    // Deve gerar exatamente 3 previsões: meses 1, 3 e 4
    expect(prevs).toHaveLength(3)
    expect(prevs[0].competencia).toBe('01/2026')
    expect(prevs[0].valor_previsto).toBe(500)

    expect(prevs[1].competencia).toBe('03/2026')
    expect(prevs[1].valor_previsto).toBe(100)

    expect(prevs[2].competencia).toBe('04/2026')
    expect(prevs[2].valor_previsto).toBe(100)

    // Não pode conter competência 02/2026 nem 05/2026
    const comps = prevs.map((p) => p.competencia)
    expect(comps).not.toContain('02/2026')
    expect(comps).not.toContain('05/2026')
  })

  // (9) Cancelamento preserva recebimentos/estornos e cancela previsões futuras não recebidas
  it('(9) cancelamento preserva recebimentos/estornos e cancela previsões futuras não recebidas', async () => {
    const policyId = 'pol_cancel_9'
    dbPolicies.push({
      id: policyId,
      status: 'Ativa',
      commission: 600,
      start_date: '2026-01-01',
    })

    // Previsão 1 recebida
    dbComissoesPrevistas.push({
      id: 'prev_c1',
      policy: policyId,
      competencia: '01/2026',
      valor_previsto: 200,
      status: 'Recebida',
    })

    // Previsão 2 parcial
    dbComissoesPrevistas.push({
      id: 'prev_c2',
      policy: policyId,
      competencia: '02/2026',
      valor_previsto: 200,
      status: 'Parcial',
    })

    // Previsão 3 pendente futura sem recebimento
    dbComissoesPrevistas.push({
      id: 'prev_c3',
      policy: policyId,
      competencia: '03/2026',
      valor_previsto: 200,
      status: 'Pendente',
    })

    // Recebimento para c1 e c2
    dbComissaoRecebimentos.push(
      {
        id: 'rec_c1',
        policy: policyId,
        comissao_prevista: 'prev_c1',
        valor_bruto: 200,
      },
      {
        id: 'rec_c2',
        policy: policyId,
        comissao_prevista: 'prev_c2',
        valor_bruto: 100,
      },
    )

    // Executar cancelamento da apólice
    await cancelPolicy(policyId, {
      data_cancelamento: '2026-02-15',
      motivo_cancelamento: 'Cliente vendeu o veículo',
    })

    // Apólice com status Cancelada
    expect(dbPolicies[0].status).toBe('Cancelada')
    expect(dbPolicies[0].motivo_cancelamento).toBe('Cliente vendeu o veículo')

    // Recebimentos intactos
    expect(dbComissaoRecebimentos).toHaveLength(2)

    // Previsões 1 e 2 mantidas
    const c1 = dbComissoesPrevistas.find((p) => p.id === 'prev_c1')
    const c2 = dbComissoesPrevistas.find((p) => p.id === 'prev_c2')
    const c3 = dbComissoesPrevistas.find((p) => p.id === 'prev_c3')

    expect(c1?.status).toBe('Recebida')
    expect(c2?.status).toBe('Parcial')
    // Previsão 3 estritamente pendente sem recebimento é cancelada
    expect(c3?.status).toBe('Cancelada')
  })
})
