import { describe, it, expect } from 'vitest'

/**
 * Funções de cálculo de fechamento de parceiro e baixa com débitos
 * Espelham rigorosamente o comportamento de pocketbase/hooks/parceiro_fechamento.js
 * e a interface de cálculo em Financial.tsx / PartnerReport.tsx
 */
export function calcularBaixaRepasseComDebitos(
  comissaoRepasse: number,
  debitos: Array<{ id?: string; descricao: string; valor: number }>,
  taxaPixManual?: number | null,
) {
  const rep = Math.max(0, Number(comissaoRepasse) || 0)
  const totalDebitos =
    Math.round(debitos.reduce((acc, d) => acc + (Number(d.valor) || 0), 0) * 100) / 100

  // Se débito > repasse, abate somente o disponível
  const debitoAbatidoEfetivo = Math.min(rep, totalDebitos)
  const baseAposDeducao = Math.max(0, Math.round((rep - debitoAbatidoEfetivo) * 100) / 100)

  // Taxa PIX: 1% do valor a transferir (base pendente menos débitos abatidos), max R$ 10,00
  // Não incide se nada a transferir
  let taxaPix = 0
  if (baseAposDeducao > 0) {
    if (
      taxaPixManual !== undefined &&
      taxaPixManual !== null &&
      !isNaN(taxaPixManual) &&
      taxaPixManual >= 0
    ) {
      taxaPix = taxaPixManual
    } else {
      taxaPix = Math.round(Math.min(10, (baseAposDeducao * 1) / 100) * 100) / 100
    }
  }

  const valorLiquido = Math.max(0, Math.round((baseAposDeducao - taxaPix) * 100) / 100)
  const saldoDevedorRemanescente = Math.max(0, Math.round((totalDebitos - rep) * 100) / 100)

  // Status dos débitos processados
  let repRestante = rep
  const debitosProcessados = debitos.map((deb) => {
    const val = Number(deb.valor) || 0
    if (repRestante >= val) {
      repRestante = Math.round((repRestante - val) * 100) / 100
      return {
        descricao: deb.descricao,
        valorAbatido: val,
        saldoPendente: 0,
        status: 'Pago',
      }
    } else if (repRestante > 0) {
      const abatido = repRestante
      const saldo = Math.round((val - abatido) * 100) / 100
      repRestante = 0
      return {
        descricao: `${deb.descricao} [Abatimento parcial]`,
        valorAbatido: abatido,
        saldoPendente: saldo,
        status: 'Pago Parcial',
      }
    } else {
      return {
        descricao: deb.descricao,
        valorAbatido: 0,
        saldoPendente: val,
        status: 'Pendente',
      }
    }
  })

  return {
    comissaoRepasse: rep,
    totalDebitos,
    debitoAbatidoEfetivo,
    baseAposDeducao,
    taxaPix,
    valorLiquido,
    saldoDevedorRemanescente,
    nadaATransferir: valorLiquido === 0,
    debitosProcessados,
  }
}

describe('Cenário Real do Usuário — Baixa Rápida de Repasse com Débitos / Adiantamentos', () => {
  it('Cenário 1 (Real): Parceiro com adiantamento de R$ 447,30 pendente; baixa rápida de repasse de R$ 447,30', () => {
    const comissao = 447.3
    const debitos = [{ id: 'deb-1', descricao: 'Adiantamento de comissão', valor: 447.3 }]

    const res = calcularBaixaRepasseComDebitos(comissao, debitos)

    // Valor líquido a pagar R$ 0,00 (comissão − adiantamento)
    expect(res.valorLiquido).toBe(0)
    expect(res.debitoAbatidoEfetivo).toBe(447.3)
    expect(res.baseAposDeducao).toBe(0)
    // Taxa PIX R$ 0,00 (não incide sobre R$ 0,00)
    expect(res.taxaPix).toBe(0)
    // Nada a transferir
    expect(res.nadaATransferir).toBe(true)
    expect(res.saldoDevedorRemanescente).toBe(0)

    // Adiantamento consumido uma única vez, marcado como Pago
    expect(res.debitosProcessados).toHaveLength(1)
    expect(res.debitosProcessados[0].status).toBe('Pago')
    expect(res.debitosProcessados[0].valorAbatido).toBe(447.3)
    expect(res.debitosProcessados[0].saldoPendente).toBe(0)
  })

  it('Cenário 2: Adiantamento MAIOR que a comissão (R$ 600,00 de dívida vs R$ 447,30 de repasse) — não gera valor negativo', () => {
    const comissao = 447.3
    const debitos = [{ id: 'deb-2', descricao: 'Adiantamento anterior', valor: 600.0 }]

    const res = calcularBaixaRepasseComDebitos(comissao, debitos)

    // Abate somente o disponível (447.30)
    expect(res.debitoAbatidoEfetivo).toBe(447.3)
    expect(res.baseAposDeducao).toBe(0)
    // Valor líquido nunca negativo
    expect(res.valorLiquido).toBe(0)
    expect(res.taxaPix).toBe(0)
    expect(res.nadaATransferir).toBe(true)

    // Saldo devedor remanescente de R$ 152,70 permanece pendente
    expect(res.saldoDevedorRemanescente).toBe(152.7)
    expect(res.debitosProcessados[0].status).toBe('Pago Parcial')
    expect(res.debitosProcessados[0].valorAbatido).toBe(447.3)
    expect(res.debitosProcessados[0].saldoPendente).toBe(152.7)
  })

  it('Cenário 3: Adiantamento MENOR que a comissão (R$ 200,00 de dívida vs R$ 500,00 de repasse)', () => {
    const comissao = 500.0
    const debitos = [{ id: 'deb-3', descricao: 'Despesa / Adiantamento', valor: 200.0 }]

    const res = calcularBaixaRepasseComDebitos(comissao, debitos)

    expect(res.debitoAbatidoEfetivo).toBe(200.0)
    expect(res.baseAposDeducao).toBe(300.0)
    // Taxa PIX: 1% sobre R$ 300,00 = R$ 3,00
    expect(res.taxaPix).toBe(3.0)
    // Líquido a pagar: 300 - 3 = R$ 297,00
    expect(res.valorLiquido).toBe(297.0)
    expect(res.saldoDevedorRemanescente).toBe(0)
    expect(res.nadaATransferir).toBe(false)
    expect(res.debitosProcessados[0].status).toBe('Pago')
  })

  it('Cenário 4: Parceiro SEM débitos pendentes — fluxo padrão intocado', () => {
    const comissao = 447.3
    const debitos: Array<{ id?: string; descricao: string; valor: number }> = []

    const res = calcularBaixaRepasseComDebitos(comissao, debitos)

    expect(res.totalDebitos).toBe(0)
    expect(res.debitoAbatidoEfetivo).toBe(0)
    expect(res.baseAposDeducao).toBe(447.3)
    // 1% sobre 447.30 = 4.473 -> R$ 4,47
    expect(res.taxaPix).toBe(4.47)
    // Líquido: 447.30 - 4.47 = 442.83
    expect(res.valorLiquido).toBe(442.83)
    expect(res.nadaATransferir).toBe(false)
    expect(res.saldoDevedorRemanescente).toBe(0)
    expect(res.debitosProcessados).toHaveLength(0)
  })

  it('Cenário 5: Múltiplos débitos que esgotam o repasse em cascata com saldo residual', () => {
    const comissao = 500.0
    const debitos = [
      { id: 'deb-a', descricao: 'Débito A', valor: 300.0 },
      { id: 'deb-b', descricao: 'Débito B', valor: 250.0 },
    ]

    const res = calcularBaixaRepasseComDebitos(comissao, debitos)

    expect(res.totalDebitos).toBe(550.0)
    expect(res.debitoAbatidoEfetivo).toBe(500.0)
    expect(res.baseAposDeducao).toBe(0)
    expect(res.valorLiquido).toBe(0)
    expect(res.taxaPix).toBe(0)
    expect(res.saldoDevedorRemanescente).toBe(50.0)

    // Primeiro débito é pago integralmente (300)
    expect(res.debitosProcessados[0].status).toBe('Pago')
    expect(res.debitosProcessados[0].valorAbatido).toBe(300.0)
    expect(res.debitosProcessados[0].saldoPendente).toBe(0)

    // Segundo débito abate 200 e fica com 50 pendente
    expect(res.debitosProcessados[1].status).toBe('Pago Parcial')
    expect(res.debitosProcessados[1].valorAbatido).toBe(200.0)
    expect(res.debitosProcessados[1].saldoPendente).toBe(50.0)
  })
})
