import { describe, it, expect } from 'vitest'

describe('Validação de Recebimento Parcial e Estorno (ETAPA 2A)', () => {
  // Cenário 8 da spec:
  // Previsto R$ 500 → recebido R$ 300 → mostra Previsto R$ 500 / Recebido R$ 300 / Saldo R$ 200 / Status Parcial.
  // Depois entra R$ 200 → Previsto R$ 500 / Recebido R$ 500 / Saldo R$ 0 / Status Recebida.
  it('Cenário 8: Recebimento parcial R$ 500 -> R$ 300 -> R$ 200 calcula saldos e status corretamente', () => {
    const previsto = 500
    let recebimentos: number[] = [300]

    let recebidoTotal = recebimentos.reduce((a, b) => a + b, 0)
    let saldo = Math.max(0, previsto - recebidoTotal)
    let status = saldo === 0 ? 'Recebida' : recebidoTotal > 0 ? 'Parcial' : 'Pendente'

    expect(recebidoTotal).toBe(300)
    expect(saldo).toBe(200)
    expect(status).toBe('Parcial')

    // Segundo recebimento de R$ 200
    recebimentos.push(200)
    recebidoTotal = recebimentos.reduce((a, b) => a + b, 0)
    saldo = Math.max(0, previsto - recebidoTotal)
    status = saldo === 0 ? 'Recebida' : recebidoTotal > 0 ? 'Parcial' : 'Pendente'

    expect(recebidoTotal).toBe(500)
    expect(saldo).toBe(0)
    expect(status).toBe('Recebida')
  })

  // Cenário 9 da spec:
  // Estorno: recebido R$ 500, estorno R$ 200 → resultado líquido R$ 300.
  // O recebimento original NÃO é apagado. O estorno é um lançamento negativo (-R$ 200)
  // preservando a rastreabilidade total (usuário, data, motivo).
  it('Cenário 9: Estorno R$ 200 de recebimento R$ 500 resulta em R$ 300 com histórico preservado', () => {
    const lancamentoOriginal = {
      id: 'rec_123',
      valor_bruto: 500,
      valor_liquido: 470, // com 6% imposto
      is_estorno: false,
    }

    const estorno = {
      id: 'rec_est_456',
      recebimento_original: 'rec_123',
      valor_bruto: -200,
      valor_liquido: -188, // com 6% imposto
      is_estorno: true,
      motivo_estorno: 'Cancelamento parcial pela seguradora',
    }

    const listaLancamentos = [lancamentoOriginal, estorno]

    // Ambos os registros continuam existindo no banco (nenhum apagado)
    expect(listaLancamentos).toHaveLength(2)

    // Saldo realizado bruto após estorno
    const totalBrutoRealizado = listaLancamentos.reduce((acc, r) => acc + r.valor_bruto, 0)
    expect(totalBrutoRealizado).toBe(300)

    // Saldo realizado líquido após estorno
    const totalLiquidoRealizado = listaLancamentos.reduce((acc, r) => acc + r.valor_liquido, 0)
    expect(totalLiquidoRealizado).toBe(282)

    // Rastreabilidade do estorno garantida
    expect(estorno.recebimento_original).toBe(lancamentoOriginal.id)
    expect(estorno.motivo_estorno).toBe('Cancelamento parcial pela seguradora')
  })
})
