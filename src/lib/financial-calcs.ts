import { Policy, CustoFixo, ComissaoRecebimento } from '@/types'
import { DatePeriod, isDateInPeriod } from '@/lib/date-filter'

export const calcNetCommission = (p: Policy) => (p.commission || 0) - (p.iss || 0)

export function computeReceivedCommissions(
  policies: Policy[],
  period: DatePeriod,
  recebimentos?: ComissaoRecebimento[],
): number {
  if (recebimentos && recebimentos.length > 0) {
    const policyMap = new Map<string, Policy>()
    for (const p of policies) {
      policyMap.set(p.id, p)
    }

    return recebimentos
      .filter((r) => {
        if (!r.data_recebimento || !isDateInPeriod(period, r.data_recebimento)) return false
        if (policies.length > 0 && !policyMap.has(r.policy)) return false
        return true
      })
      .reduce((s, r) => s + (Number(r.valor_liquido) || 0), 0)
  }

  return policies
    .filter(
      (p) =>
        p.comissao_recebida === true &&
        Boolean(p.data_recebimento_comissao) &&
        isDateInPeriod(period, p.data_recebimento_comissao),
    )
    .reduce((s, p) => s + calcNetCommission(p), 0)
}

export function computePendingCommissions(
  policies: Policy[],
  recebimentos?: ComissaoRecebimento[],
): number {
  if (recebimentos && recebimentos.length > 0) {
    const receivedByPolicy = new Map<string, number>()
    for (const r of recebimentos) {
      const current = receivedByPolicy.get(r.policy) || 0
      receivedByPolicy.set(
        r.policy,
        current + (Number(r.valor_liquido) || Number(r.valor_bruto) || 0),
      )
    }
    // Soma o saldo pendente de cada apólice
    return policies.reduce((sum, p) => {
      const totalPrevisto =
        p.commission != null
          ? Number(p.commission)
          : Math.round(
              (((p.valor_liquido || p.premium_amount || 0) * (p.commission_percent || 0)) / 100) *
                100,
            ) / 100
      const recs = receivedByPolicy.get(p.id) ?? (p.comissao_recebida ? totalPrevisto : 0)
      const saldo = Math.max(0, totalPrevisto - recs)
      return sum + saldo
    }, 0)
  }

  return policies.filter((p) => !p.comissao_recebida).reduce((s, p) => s + calcNetCommission(p), 0)
}

export function computePaidRepasses(policies: Policy[], period: DatePeriod): number {
  return policies
    .filter(
      (p) =>
        p.tipo_de_venda === 'Parceiro' &&
        (p.parceiro || p.expand?.parceiro) &&
        (p.valor_repasse || 0) > 0 &&
        p.pago_parceiro &&
        Boolean(p.data_pagamento_parceiro) &&
        isDateInPeriod(period, p.data_pagamento_parceiro),
    )
    .reduce((s, p) => s + (p.valor_repasse || 0), 0)
}

export function computePendingRepasses(policies: Policy[], period?: DatePeriod): number {
  return policies
    .filter(
      (p) =>
        p.tipo_de_venda === 'Parceiro' &&
        (p.parceiro || p.expand?.parceiro) &&
        (p.valor_repasse || 0) > 0 &&
        !p.pago_parceiro &&
        (!period || isDateInPeriod(period, p.start_date)),
    )
    .reduce((s, p) => s + (p.valor_repasse || 0), 0)
}

export function computePendingCommissionsInPeriod(policies: Policy[], period: DatePeriod): number {
  return policies
    .filter((p) => isDateInPeriod(period, p.start_date) && !p.comissao_recebida)
    .reduce((s, p) => s + calcNetCommission(p), 0)
}

export function computeCosts(custos: CustoFixo[], period: DatePeriod): number {
  return custos
    .filter((c) => isDateInPeriod(period, c.data))
    .reduce((s, c) => s + (c.valor || 0), 0)
}

export function computeNetProfit(receitas: number, repasses: number, custos: number): number {
  return receitas - repasses - custos
}

export function computeTotalGross(policies: Policy[]): number {
  return policies.reduce((s, p) => s + (p.valor_bruto || 0), 0)
}

export function computeTotalNet(policies: Policy[]): number {
  return policies.reduce((s, p) => s + (p.valor_liquido || p.premium_amount || 0), 0)
}

export function getPartnerPolicies(policies: Policy[]): Policy[] {
  return policies.filter(
    (p) =>
      p.tipo_de_venda === 'Parceiro' &&
      (p.parceiro || p.expand?.parceiro) &&
      (p.valor_repasse || 0) > 0,
  )
}

export interface FinancialMetrics {
  totalReceitas: number
  totalRepasses: number
  totalCustos: number
  lucroLiquido: number
}

export function calculateFinancialMetrics(
  policies: Policy[],
  custos: CustoFixo[],
  period: DatePeriod,
  recebimentos?: ComissaoRecebimento[],
): FinancialMetrics {
  const totalReceitas = computeReceivedCommissions(policies, period, recebimentos)
  const totalRepasses = computePaidRepasses(policies, period)
  const totalCustos = computePaidCosts(custos, period)
  return {
    totalReceitas,
    totalRepasses,
    totalCustos,
    lucroLiquido: computeRealProfit(totalReceitas, totalRepasses, totalCustos),
  }
}

export function computeExpectedCommissions(policies: Policy[], period: DatePeriod): number {
  return policies
    .filter((p) => isDateInPeriod(period, p.start_date))
    .reduce((s, p) => s + calcNetCommission(p), 0)
}

export function computeExpectedRepasses(policies: Policy[], period: DatePeriod): number {
  return policies
    .filter(
      (p) =>
        p.tipo_de_venda === 'Parceiro' &&
        (p.parceiro || p.expand?.parceiro) &&
        (p.valor_repasse || 0) > 0 &&
        isDateInPeriod(period, p.start_date),
    )
    .reduce((s, p) => s + (p.valor_repasse || 0), 0)
}

export function computePaidCosts(custos: CustoFixo[], period: DatePeriod): number {
  return custos
    .filter(
      (c) =>
        c.pago === true &&
        Boolean(c.data_pagamento || c.data) &&
        isDateInPeriod(period, c.data_pagamento || c.data),
    )
    .reduce((s, c) => s + (c.valor || 0), 0)
}

export function computePendingCosts(custos: CustoFixo[], period: DatePeriod): number {
  return custos
    .filter((c) => c.pago !== true && isDateInPeriod(period, c.data))
    .reduce((s, c) => s + (c.valor || 0), 0)
}

export function computeExpectedProfit(
  expectedComm: number,
  expectedRepasses: number,
  totalCustos: number,
): number {
  return expectedComm - expectedRepasses - totalCustos
}

export function computeRealProfit(
  commReceived: number,
  repassePaid: number,
  paidCosts: number,
): number {
  return commReceived - repassePaid - paidCosts
}
