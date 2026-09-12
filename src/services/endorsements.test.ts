import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  computeEndorsementFinancialStatus,
  getVeiculoVigente,
  createEndorsement,
  deleteEndorsement,
} from './endorsements'
import { Policy, Endorsement, ComissaoPrevista, ComissaoRecebimento } from '@/types'
import pb from '@/lib/pocketbase/client'

// Mock do PocketBase
vi.mock('@/lib/pocketbase/client', () => {
  const store = new Map<string, any[]>()
  return {
    default: {
      collection: (name: string) => ({
        getFullList: vi.fn(async (opts?: any) => {
          const list = store.get(name) || []
          if (!opts?.filter) return list
          if (opts.filter.includes('policy =')) {
            const match = opts.filter.match(/policy = "([^"]+)"/)
            if (match) return list.filter((i) => i.policy === match[1])
          }
          if (opts.filter.includes('endorsement =')) {
            const match = opts.filter.match(/endorsement = "([^"]+)"/)
            if (match) return list.filter((i) => i.endorsement === match[1])
          }
          return list
        }),
        getOne: vi.fn(async (id: string) => {
          const list = store.get(name) || []
          const found = list.find((i) => i.id === id)
          if (!found) throw new Error(`Not found in ${name}: ${id}`)
          return found
        }),
        create: vi.fn(async (payload: any) => {
          const list = store.get(name) || []
          const item = { ...payload, id: `mock_${name}_${Date.now()}_${Math.random()}` }
          list.push(item)
          store.set(name, list)
          return item
        }),
        update: vi.fn(async (id: string, payload: any) => {
          const list = store.get(name) || []
          const index = list.findIndex((i) => i.id === id)
          if (index === -1) throw new Error(`Not found in ${name}: ${id}`)
          list[index] = { ...list[index], ...payload }
          return list[index]
        }),
        delete: vi.fn(async (id: string) => {
          const list = store.get(name) || []
          store.set(
            name,
            list.filter((i) => i.id !== id),
          )
          return true
        }),
        // Helper interno de teste
        _store: store,
      }),
    },
  }
})

describe('Endossos - Especificação e Integridade Financeira', () => {
  const samplePolicy: Policy = {
    id: 'pol_123',
    policy_number: 'APOL-2026-001',
    insurance_company: 'Porto Seguro',
    client: 'cli_001',
    start_date: '2026-01-01',
    end_date: '2027-01-01',
    premium_amount: 1200,
    commission_percent: 35,
    commission: 350,
    status: 'Ativa',
    tipo_de_seguro: 'Auto',
    tipo_de_venda: 'Produção Própria',
    modelo_veiculo: 'Honda Civic LX',
    placa: 'ABC1234',
    chassi: '9BWZZZ377VT004251',
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    const pbAny = pb as any
    const store = pbAny.collection('policies')._store
    store.clear()
    store.set('policies', [{ ...samplePolicy }])
    store.set('endorsements', [])
    store.set('comissoes_previstas', [])
    store.set('comissao_recebimentos', [])
  })

  // TESTE A: Endosso positivo: líquido +R$500, comissão 35% -> previsão +R$175 vinculada ao endosso
  it('A) Cenário Endosso Positivo: calcula comissão 35% sobre líq +R$500 e gera comissao_prevista de +R$175 com chave estável', async () => {
    const end = await createEndorsement({
      policy: 'pol_123',
      tipo: 'Substituição de veículo',
      data_endosso: '2026-06-15',
      valor_bruto: 600,
      valor_liquido: 500,
      placa: 'DEF5678',
      modelo_veiculo: 'Toyota Corolla XEi',
    })

    expect(end.valor_liquido).toBe(500)
    expect(end.comissao_percent).toBe(35)
    expect(end.comissao_valor).toBe(175)

    // Verificar se comissão prevista foi gerada com chave estável e vínculo ao endosso
    const prevs = await pb.collection('comissoes_previstas').getFullList()
    expect(prevs.length).toBe(1)
    expect(prevs[0].valor_previsto).toBe(175)
    expect(prevs[0].policy).toBe('pol_123')
    expect(prevs[0].endorsement).toBe(end.id)
    expect(prevs[0].chave_estavel).toContain(`prev_end_${end.id}`)
  })

  // TESTE B: Endosso zero: histórico criado, nenhum lançamento financeiro
  it('B) Cenário Endosso Zero: registra no histórico operacional mas não gera previsão financeira de R$ 0,00', async () => {
    const end = await createEndorsement({
      policy: 'pol_123',
      tipo: 'Alteração de dados cadastrais',
      data_endosso: '2026-07-01',
      valor_bruto: 0,
      valor_liquido: 0,
    })

    expect(end.id).toBeDefined()
    expect(end.valor_liquido).toBe(0)

    const prevs = await pb.collection('comissoes_previstas').getFullList()
    expect(prevs.length).toBe(0)

    const recs = await pb.collection('comissao_recebimentos').getFullList()
    expect(recs.length).toBe(0)

    const status = computeEndorsementFinancialStatus(end, [], [])
    expect(status).toBe('Sem impacto financeiro')
  })

  // TESTE C: Endosso negativo -R$500: ajuste/estorno conforme arquitetura, sem recebimento negativo
  it('C) Cenário Endosso Negativo -R$500: lança ajuste/estorno proporcional sem tratar como recebimento normal', async () => {
    const end = await createEndorsement({
      policy: 'pol_123',
      tipo: 'Substituição de veículo com devolução',
      data_endosso: '2026-08-10',
      valor_bruto: -500,
      valor_liquido: -500,
    })

    expect(end.comissao_valor).toBe(-175)

    // Previsão NÃO deve ser criada
    const prevs = await pb.collection('comissoes_previstas').getFullList()
    expect(prevs.length).toBe(0)

    // Deve ter registrado estorno / ajuste de comissão em recebimentos
    const recs = (await pb
      .collection('comissao_recebimentos')
      .getFullList()) as unknown as ComissaoRecebimento[]
    expect(recs.length).toBe(1)
    expect(recs[0].is_estorno).toBe(true)
    expect(recs[0].valor_bruto).toBe(-175)
    expect(recs[0].endorsement).toBe(end.id)

    const status = computeEndorsementFinancialStatus(
      end,
      prevs as unknown as ComissaoPrevista[],
      recs,
    )
    expect(status).toBe('Estornado / Ajustado')
  })

  // TESTE D: Dois endossos na mesma apólice e mesma competência: duas previsões individualmente identificadas
  it('D) Cenário Dois Endossos na mesma apólice e competência: mantém previsões separadas com IDs distintos', async () => {
    const end1 = await createEndorsement({
      policy: 'pol_123',
      tipo: 'Substituição de veículo',
      data_endosso: '2026-09-05',
      valor_liquido: 300,
    })

    const end2 = await createEndorsement({
      policy: 'pol_123',
      tipo: 'Inclusão de cobertura',
      data_endosso: '2026-09-20',
      valor_liquido: 400,
    })

    const prevs = await pb.collection('comissoes_previstas').getFullList()
    expect(prevs.length).toBe(2)

    const p1 = prevs.find((p) => p.endorsement === end1.id)
    const p2 = prevs.find((p) => p.endorsement === end2.id)

    expect(p1).toBeDefined()
    expect(p2).toBeDefined()
    expect(p1?.id).not.toBe(p2?.id)
    expect(p1?.valor_previsto).toBe(105) // 35% de 300
    expect(p2?.valor_previsto).toBe(140) // 35% de 400

    // Simula recebimento exclusivo de p1
    const rec1: ComissaoRecebimento = {
      id: 'rec_1',
      policy: 'pol_123',
      data_recebimento: '2026-09-10',
      valor_bruto: 105,
      valor_liquido: 105,
      origem: 'Manual',
      comissao_prevista: p1?.id,
      endorsement: end1.id,
      created: '',
      updated: '',
    }

    const status1 = computeEndorsementFinancialStatus(
      end1,
      prevs as unknown as ComissaoPrevista[],
      [rec1],
    )
    const status2 = computeEndorsementFinancialStatus(
      end2,
      prevs as unknown as ComissaoPrevista[],
      [rec1],
    )

    expect(status1).toBe('Recebido')
    expect(status2).toBe('Pendente') // Recebimento de um não baixou o outro
  })

  // TESTE E: Apólice com comissão original + endosso: original intacta, endosso separado
  it('E) Cenário Apólice com comissão original + endosso: previsão original intacta e totalizável sem perder rastreio', async () => {
    const prevOriginal: ComissaoPrevista = {
      id: 'prev_orig',
      policy: 'pol_123',
      competencia: '01/2026',
      data_prevista: '2026-01-15',
      valor_previsto: 350,
      status: 'Pendente',
      chave_estavel: 'prev_pol_123_1_01_2026',
      created: '',
      updated: '',
    }
    const store = (pb as any).collection('comissoes_previstas')._store
    store.set('comissoes_previstas', [prevOriginal])

    const end = await createEndorsement({
      policy: 'pol_123',
      tipo: 'Substituição de veículo',
      data_endosso: '2026-02-10',
      valor_liquido: 500,
    })

    const prevs = await pb.collection('comissoes_previstas').getFullList()
    expect(prevs.length).toBe(2)

    const prevOrigReloaded = prevs.find((p) => !p.endorsement)
    const prevEndReloaded = prevs.find((p) => p.endorsement === end.id)

    expect(prevOrigReloaded?.valor_previsto).toBe(350)
    expect(prevEndReloaded?.valor_previsto).toBe(175)

    const totalPrevisto = prevs.reduce((sum, p) => sum + Number(p.valor_previsto), 0)
    expect(totalPrevisto).toBe(525) // R$ 350 + R$ 175 = R$ 525, cada um com sua origem rastreável
  })

  // TESTE F: Endosso já recebido: exclusão destrutiva impedida
  it('F) Cenário Endosso já recebido: integridade assegurada bloqueando exclusão destrutiva', async () => {
    const end = await createEndorsement({
      policy: 'pol_123',
      tipo: 'Substituição de veículo',
      data_endosso: '2026-05-15',
      valor_liquido: 500,
    })

    // Adicionar recebimento vinculado ao endosso
    const store = (pb as any).collection('comissao_recebimentos')._store
    store.set('comissao_recebimentos', [
      {
        id: 'rec_end_1',
        policy: 'pol_123',
        endorsement: end.id,
        valor_bruto: 175,
        valor_liquido: 175,
        is_estorno: false,
      },
    ])

    // Tentativa de excluir deve lançar erro bloqueante
    await expect(deleteEndorsement(end.id)).rejects.toThrow(
      /não pode ser excluído pois possui movimentações financeiras/i,
    )
  })

  // TESTE G: Apólice antiga sem endosso: funcionamento exatamente igual ao atual
  it('G) Cenário Apólice antiga sem endosso: getVeiculoVigente retorna dados da apólice original perfeitamente', () => {
    const veiculo = getVeiculoVigente(samplePolicy, [])
    expect(veiculo.placa).toBe('ABC1234')
    expect(veiculo.modelo_veiculo).toBe('Honda Civic LX')
    expect(veiculo.origem).toBe('Apólice original')

    // Sequência de substituição de veículo: preserva o original e calcula o vigente
    const end1: Endorsement = {
      id: 'end_1',
      policy: samplePolicy.id,
      tipo: 'Substituição de veículo',
      data_endosso: '2026-03-01',
      placa: 'DEF5678',
      modelo_veiculo: 'Corolla Altis',
      created: '',
      updated: '',
    }
    const end2: Endorsement = {
      id: 'end_2',
      policy: samplePolicy.id,
      tipo: 'Substituição de veículo',
      data_endosso: '2026-08-01',
      placa: 'GHI9012',
      modelo_veiculo: 'Jeep Compass Limited',
      created: '',
      updated: '',
    }

    const veiculoAposEnd1 = getVeiculoVigente(samplePolicy, [end1])
    expect(veiculoAposEnd1.placa).toBe('DEF5678')
    expect(veiculoAposEnd1.modelo_veiculo).toBe('Corolla Altis')

    const veiculoAposEnd2 = getVeiculoVigente(samplePolicy, [end1, end2])
    expect(veiculoAposEnd2.placa).toBe('GHI9012')
    expect(veiculoAposEnd2.modelo_veiculo).toBe('Jeep Compass Limited')
  })
})
