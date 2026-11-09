import { describe, it, expect } from 'vitest'
import { montarContasAReceberFechadas } from './contas-a-receber-fechadas'
import { Policy, ComissaoRecebimento, ComissaoPrevista } from '@/types'

describe('contas-a-receber-fechadas: renovação do prazo pelo último recebimento', () => {
  const mockPolicy: Policy = {
    id: 'pol-1',
    policy_number: '1218389160',
    client: 'cli-1',
    seguradora: 'seg-hdi',
    branch: 'ramo-auto',
    status: 'Ativa',
    start_date: '2026-08-01',
    end_date: '2027-08-01',
    data_recebimento_comissao: '2026-09-03',
    expected_commission: 1000,
    created: '2026-08-01T12:00:00Z',
    updated: '2026-08-01T12:00:00Z',
    expand: {
      client: { id: 'cli-1', name: 'EDSON MARCOS FERREIRA DE ARAUJO' },
      seguradora: { id: 'seg-hdi', nome: 'HDI' },
    },
  } as unknown as Policy

  const fechadasSet = new Set([202609]) // Setembro/2026 fechado

  it('sem nenhum recebimento: conta dias a partir da data de vencimento original', () => {
    const comissoesPrevistas: ComissaoPrevista[] = [
      {
        id: 'prev-1',
        policy: 'pol-1',
        competencia: '09/2026',
        data_prevista: '2026-09-03',
        valor_previsto: 252.74,
        status: 'Pendente',
      } as ComissaoPrevista,
    ]

    const res = montarContasAReceberFechadas({
      policies: [mockPolicy],
      recebimentos: [],
      comissoesPrevistas,
      fechadasSet,
    })

    expect(res).toHaveLength(1)
    const item = res[0]
    expect(item.valor).toBe(252.74)
    expect(item.diasVencidos).toBeGreaterThan(0)
    expect(item.vencimento).toBe('2026-09-03')
    expect(item.ultimoRecebimento).toBeUndefined()
    expect(item.origemDias).toBe('vencimento')
  })

  it('com baixa parcial recente: RENOVA O PRAZO da data da última baixa e preenche ultimoRecebimento', () => {
    const comissoesPrevistas: ComissaoPrevista[] = [
      {
        id: 'prev-1',
        policy: 'pol-1',
        competencia: '09/2026',
        data_prevista: '2026-09-03',
        valor_previsto: 1000,
        status: 'Pendente',
      } as ComissaoPrevista,
    ]

    // Recebimento parcial recente em 2026-11-01
    const recs: ComissaoRecebimento[] = [
      {
        id: 'rec-1',
        policy: 'pol-1',
        valor_bruto: 600,
        valor_liquido: 600,
        data_recebimento: '2026-11-01',
        is_estorno: false,
      } as ComissaoRecebimento,
    ]

    const res = montarContasAReceberFechadas({
      policies: [mockPolicy],
      recebimentos: recs,
      comissoesPrevistas,
      fechadasSet,
    })

    expect(res).toHaveLength(1)
    const item = res[0]
    // Saldo restante
    expect(item.valor).toBe(400)
    // Vencimento original é mantido
    expect(item.vencimento).toBe('2026-09-03')
    // Último recebimento que renovou o prazo
    expect(item.ultimoRecebimento).toBe('2026-11-01')
    expect(item.origemDias).toBe('ultimo_recebimento')

    // Como 2026-11-01 é mais recente que 2026-09-03, diasVencidos é muito menor do que se contasse de 03/09/2026
    const msPorDia = 86400000
    const hoje = new Date()
    const diffEsperada = Math.max(
      0,
      Math.floor((hoje.getTime() - new Date('2026-11-01T12:00:00').getTime()) / msPorDia),
    )
    expect(Math.abs(item.diasVencidos - diffEsperada)).toBeLessThanOrEqual(1)
  })

  it('estornos não renovam o prazo', () => {
    const comissoesPrevistas: ComissaoPrevista[] = [
      {
        id: 'prev-1',
        policy: 'pol-1',
        competencia: '09/2026',
        data_prevista: '2026-09-03',
        valor_previsto: 500,
        status: 'Pendente',
      } as ComissaoPrevista,
    ]

    // Apenas estorno
    const recs: ComissaoRecebimento[] = [
      {
        id: 'rec-estorno',
        policy: 'pol-1',
        valor_bruto: -100,
        valor_liquido: -100,
        data_recebimento: '2026-11-05',
        is_estorno: true,
      } as ComissaoRecebimento,
    ]

    const res = montarContasAReceberFechadas({
      policies: [mockPolicy],
      recebimentos: recs,
      comissoesPrevistas,
      fechadasSet,
    })

    expect(res).toHaveLength(1)
    const item = res[0]
    // A data de referência não deve ser a do estorno
    expect(item.vencimento).toBe('2026-09-03')
    expect(item.ultimoRecebimento).toBeUndefined()
    expect(item.origemDias).toBe('vencimento')
  })

  it('quitado: item com saldo zero não entra na lista', () => {
    const comissoesPrevistas: ComissaoPrevista[] = [
      {
        id: 'prev-1',
        policy: 'pol-1',
        competencia: '09/2026',
        data_prevista: '2026-09-03',
        valor_previsto: 252.74,
        status: 'Pendente',
      } as ComissaoPrevista,
    ]

    const recs: ComissaoRecebimento[] = [
      {
        id: 'rec-full',
        policy: 'pol-1',
        valor_bruto: 252.74,
        valor_liquido: 252.74,
        data_recebimento: '2026-10-15',
        is_estorno: false,
      } as ComissaoRecebimento,
    ]

    const res = montarContasAReceberFechadas({
      policies: [mockPolicy],
      recebimentos: recs,
      comissoesPrevistas,
      fechadasSet,
    })

    expect(res).toHaveLength(0)
  })
})
