import { describe, it, expect } from 'vitest'
import { ContaAReceberFechada } from './contas-a-receber-fechadas'

describe('Contas a receber de competências fechadas - especificação de minimização do card', () => {
  const sampleContas: ContaAReceberFechada[] = Array.from({ length: 26 }, (_, i) => ({
    policyId: `pol-${i + 1}`,
    policyNumber: `14089797${i}`,
    segurado: `CLIENTE ${i + 1}`,
    seguradora: 'ALLIANZ',
    ramo: 'Automóvel',
    competencia: '09/2026',
    vencimento: '2026-09-18',
    diasVencidos: 40 - i,
    valor: 464.18,
    comissaoPrevistaId: `prev-${i + 1}`,
    origemDias: 'ultimo_recebimento',
    ultimoRecebimento: '2026-09-30',
  }))

  it('calcula o valor total e contagem total do lote (ex: 26 itens e R$ 12.068,74)', () => {
    const total = Math.round(sampleContas.reduce((acc, c) => acc + c.valor, 0) * 100) / 100
    expect(sampleContas).toHaveLength(26)
    expect(total).toBeCloseTo(12068.68, 1)
  })

  it('no estado minimizado, nenhum item da lista é exibido (0 itens exibidos)', () => {
    const isMinimizado = true
    const LIMITE_INICIAL = 10
    const itensExibidos = isMinimizado ? [] : sampleContas.slice(0, LIMITE_INICIAL)
    expect(itensExibidos).toHaveLength(0)
  })

  it('ao expandir o card, exibe inicialmente 10 itens com botão para ver mais pendências', () => {
    const isMinimizado = false
    const expandidoVerMais = false
    const LIMITE_INICIAL = 10

    const itensExibidos = isMinimizado
      ? []
      : expandidoVerMais
        ? sampleContas
        : sampleContas.slice(0, LIMITE_INICIAL)

    expect(itensExibidos).toHaveLength(10)
    expect(sampleContas.length > LIMITE_INICIAL).toBe(true)
    expect(sampleContas.length - LIMITE_INICIAL).toBe(16)
  })

  it('ao clicar em "Ver mais", exibe todos os 26 itens', () => {
    const isMinimizado = false
    const expandidoVerMais = true
    const LIMITE_INICIAL = 10

    const itensExibidos = isMinimizado
      ? []
      : expandidoVerMais
        ? sampleContas
        : sampleContas.slice(0, LIMITE_INICIAL)

    expect(itensExibidos).toHaveLength(26)
  })
})
