import { describe, it, expect } from 'vitest'
import { Policy, ComissaoRecebimento } from '@/types'
import {
  computeReceivedCommissions,
  computePaidRepasses,
  computePaidCosts,
  computeRealProfit,
} from '@/lib/financial-calcs'

describe('Reconciliação e Auditoria dos 5 Blocos Financeiros', () => {
  const period = {
    start: '2026-09-01',
    end: '2026-09-30',
    label: 'Setembro 2026',
    year: 2026,
    month: 9,
  }

  // 3 apólices fictícias para o período de teste
  const policies: Policy[] = [
    {
      id: 'pol-1',
      numero_proposta: 'PROP-001',
      policy_number: 'APOL-001',
      start_date: '2026-09-05',
      valor_liquido: 5000,
      premium_amount: 5000,
      commission_percent: 20,
      commission: 1000,
      iss: 50,
      status: 'Ativa',
      pago_parceiro: true,
      data_pagamento_parceiro: '2026-09-10',
      valor_repasse: 200,
      client: 'cli-1',
      created: '2026-09-05',
      updated: '2026-09-05',
    } as any,
    {
      id: 'pol-2',
      numero_proposta: 'PROP-002',
      policy_number: 'APOL-002',
      start_date: '2026-09-15',
      valor_liquido: 3000,
      premium_amount: 3000,
      commission_percent: 15,
      commission: 450,
      iss: 22.5,
      status: 'Ativa',
      pago_parceiro: false,
      valor_repasse: 90,
      client: 'cli-2',
      created: '2026-09-15',
      updated: '2026-09-15',
    } as any,
    {
      id: 'pol-3',
      numero_proposta: 'PROP-003',
      start_date: '2026-09-20',
      valor_liquido: 2000,
      premium_amount: 2000,
      commission_percent: 10,
      commission: 200,
      iss: 0,
      status: 'Ativa',
      pago_parceiro: false,
      client: 'cli-3',
      created: '2026-09-20',
      updated: '2026-09-20',
    } as any,
  ]

  // Recebimentos no sistema e legado
  const recs: ComissaoRecebimento[] = [
    {
      id: 'rec-1',
      policy: 'pol-1',
      data_recebimento: '2026-09-12',
      valor_bruto: 600,
      descontos_impostos: 0,
      valor_liquido: 600,
      origem: 'Sistema',
    } as any,
  ]

  it('Bloco 1: Totais consolidados de Produção fecham exatamente com a soma dos registros', () => {
    // 1. Prêmio Líquido Vendido
    const cardPremio = policies.reduce((sum, p) => sum + (p.valor_liquido || 0), 0)
    const listPremio = policies.map((p) => p.valor_liquido || 0).reduce((a, b) => a + b, 0)
    expect(cardPremio).toBe(10000)
    expect(cardPremio).toBe(listPremio)

    // 1.1 Prêmio Bruto Vendido (venda bruta antes de deduções)
    const cardPremioBruto = policies.reduce(
      (sum, p) => sum + (p.valor_bruto != null ? p.valor_bruto : p.premium_amount || 0),
      0,
    )
    const listPremioBruto = policies
      .map((p) => (p.valor_bruto != null ? p.valor_bruto : p.premium_amount || 0))
      .reduce((a, b) => a + b, 0)
    expect(cardPremioBruto).toBe(10000)
    expect(cardPremioBruto).toBe(listPremioBruto)

    // 2. Comissão Bruta Prevista
    const cardBruta = policies.reduce((sum, p) => sum + (p.commission || 0), 0)
    const listBruta = policies.map((p) => p.commission || 0).reduce((a, b) => a + b, 0)
    expect(cardBruta).toBe(1650)
    expect(cardBruta).toBe(listBruta)

    // 3. ISS / Deduções
    const cardIss = policies.reduce((sum, p) => sum + (p.iss || 0), 0)
    const listIss = policies.map((p) => p.iss || 0).reduce((a, b) => a + b, 0)
    expect(cardIss).toBe(72.5)
    expect(cardIss).toBe(listIss)

    // 4. Comissão Líquida Prevista = Bruta - ISS
    const cardLiquida = cardBruta - cardIss
    const listLiquida = policies
      .map((p) => (p.commission || 0) - (p.iss || 0))
      .reduce((a, b) => a + b, 0)
    expect(cardLiquida).toBe(1577.5)
    expect(cardLiquida).toBe(listLiquida)
  })

  it('Bloco 2: Total Recebido e Saldos (Parcial, Não Recebido, Saldo Total) fecham perfeitamente', () => {
    const receivedGrossByPolicy = new Map<string, number>()
    receivedGrossByPolicy.set('pol-1', 600) // pol-1 previsto 1000, recebeu 600 -> saldo 400 (parcial)
    // pol-2 previsto 450, recebeu 0 -> saldo 450 (não recebido)
    // pol-3 previsto 200, recebeu 0 -> saldo 200 (não recebido)

    let saldoParcial = 0
    let saldoNaoRecebido = 0

    policies.forEach((p) => {
      const previsto = p.commission || 0
      const rec = receivedGrossByPolicy.get(p.id) || 0
      const saldo = Math.max(0, previsto - rec)
      if (saldo > 0) {
        if (rec > 0) {
          saldoParcial += saldo
        } else {
          saldoNaoRecebido += saldo
        }
      }
    })

    expect(saldoParcial).toBe(400)
    expect(saldoNaoRecebido).toBe(650)
    const saldoTotal = saldoParcial + saldoNaoRecebido
    expect(saldoTotal).toBe(1050)
    expect(saldoTotal).toBe(1650 - 600)
  })

  it('Bloco 4: Fórmula Lucro Líquido Realizado (Recebido - Repasses Pagos - Custos Pagos)', () => {
    const comissoesRecebidas = 8155.22
    const repassesPagos = 440.14
    const custosPagos = 450.0

    const lucroReal = computeRealProfit(comissoesRecebidas, repassesPagos, custosPagos)
    expect(lucroReal).toBe(7265.08)

    // Se custos superarem as receitas, deve ser negativo
    const prejuizo = computeRealProfit(1000, 500, 800)
    expect(prejuizo).toBe(-300)
  })
})
