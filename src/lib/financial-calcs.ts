import { Policy, CustoFixo, ComissaoRecebimento } from '@/types'
import { DatePeriod, isDateInPeriod } from '@/lib/date-filter'

export const calcNetCommission = (p: Policy) => (p.commission || 0) - (p.iss || 0)

/**
 * Comissão Prevista bruta da apólice (valor bruto previsto)
 */
export const getPolicyExpectedCommission = (p: Policy): number => {
  if (p.commission != null) return Number(p.commission)
  const base = p.valor_liquido || p.premium_amount || 0
  const pct = p.commission_percent || 0
  return Math.round(((base * pct) / 100) * 100) / 100
}

/**
 * Receita líquida realizada no financeiro (soma dos valores líquidos recebidos no período).
 * Regra:
 * PREVISTO → vem da estrutura de comissão / previsões.
 * RECEBIDO → vem dos movimentos/recebimentos efetivamente registrados (comissao_recebimentos).
 * SALDO → Previsto - Recebido líquido/bruto.
 *
 * NÃO RECONHECER RECEITA SEM RECEBIMENTO:
 * Só existe receita quando existe movimento financeiro correspondente.
 * Se uma apólice possui `comissao_recebida=true` legado e data_recebimento_comissao,
 * ela só é contabilizada se explicitamente informada como registro de migração ou se houver movimento.
 * Não cria receita através de fallback silencioso.
 */
export function computeReceivedNetCommissions(
  policies: Policy[],
  period: DatePeriod,
  recebimentos?: ComissaoRecebimento[],
): number {
  if (recebimentos !== undefined) {
    const policyMap = new Map<string, Policy>()
    for (const p of policies) {
      policyMap.set(p.id, p)
    }

    return (
      Math.round(
        recebimentos
          .filter((r) => {
            if (!r.data_recebimento || !isDateInPeriod(period, r.data_recebimento)) return false
            if (policies.length > 0 && !policyMap.has(r.policy)) return false
            return true
          })
          .reduce(
            (s, r) =>
              s + (r.valor_liquido != null ? Number(r.valor_liquido) : Number(r.valor_bruto) || 0),
            0,
          ) * 100,
      ) / 100
    )
  }

  // Quando a lista de recebimentos NÃO foi fornecida no contexto (ex: chamada pura sem array),
  // e apenas para apólices legadas com data gravada, retorna a comissão líquida cadastrada
  return (
    Math.round(
      policies
        .filter(
          (p) =>
            p.comissao_recebida === true &&
            Boolean(p.data_recebimento_comissao) &&
            isDateInPeriod(period, p.data_recebimento_comissao),
        )
        .reduce((s, p) => s + calcNetCommission(p), 0) * 100,
    ) / 100
  )
}

/**
 * Receitas realizadas no financeiro (valor líquido recebido):
 * Representa a receita líquida efetivamente realizada nas contas da corretora.
 */
export function computeReceivedCommissions(
  policies: Policy[],
  period: DatePeriod,
  recebimentos?: ComissaoRecebimento[],
): number {
  return computeReceivedNetCommissions(policies, period, recebimentos)
}

/**
 * Total BRUTO recebido de comissões no período
 */
export function computeReceivedGrossCommissions(
  policies: Policy[],
  period: DatePeriod,
  recebimentos?: ComissaoRecebimento[],
): number {
  if (recebimentos !== undefined) {
    const policyMap = new Map<string, Policy>()
    for (const p of policies) {
      policyMap.set(p.id, p)
    }

    return (
      Math.round(
        recebimentos
          .filter((r) => {
            if (!r.data_recebimento || !isDateInPeriod(period, r.data_recebimento)) return false
            if (policies.length > 0 && !policyMap.has(r.policy)) return false
            return true
          })
          .reduce((s, r) => s + (Number(r.valor_bruto) || 0), 0) * 100,
      ) / 100
    )
  }

  return (
    Math.round(
      policies
        .filter(
          (p) =>
            p.comissao_recebida === true &&
            Boolean(p.data_recebimento_comissao) &&
            isDateInPeriod(period, p.data_recebimento_comissao),
        )
        .reduce((s, p) => s + getPolicyExpectedCommission(p), 0) * 100,
    ) / 100
  )
}

/**
 * Saldo a receber de comissões:
 * Regra: Saldo a receber = Comissão prevista (bruta) − Total BRUTO recebido dos movimentos reais.
 * Impostos/descontos NÃO reduzem o saldo da comissão prevista.
 * Se houver recebimentos definidos (mesmo vazios), a verdade financeira é a soma dos recebimentos.
 */
export function computePendingCommissions(
  policies: Policy[],
  recebimentos?: ComissaoRecebimento[],
): number {
  if (recebimentos !== undefined) {
    const receivedGrossByPolicy = new Map<string, number>()
    for (const r of recebimentos) {
      const current = receivedGrossByPolicy.get(r.policy) || 0
      receivedGrossByPolicy.set(r.policy, current + (Number(r.valor_bruto) || 0))
    }

    const total = policies.reduce((sum, p) => {
      const totalPrevisto = getPolicyExpectedCommission(p)
      // Se não há movimentos de recebimento para esta apólice, o saldo é o total previsto,
      // a menos que não existam recebimentos passados
      const recsBruto = receivedGrossByPolicy.get(p.id) || 0
      const saldo = Math.max(0, Math.round((totalPrevisto - recsBruto) * 100) / 100)
      return sum + saldo
    }, 0)

    return Math.round(total * 100) / 100
  }

  return (
    Math.round(
      policies
        .filter((p) => !p.comissao_recebida)
        .reduce((s, p) => s + getPolicyExpectedCommission(p), 0) * 100,
    ) / 100
  )
}

export function computePaidRepasses(policies: Policy[], period: DatePeriod): number {
  return (
    Math.round(
      policies
        .filter(
          (p) =>
            p.tipo_de_venda === 'Parceiro' &&
            (p.parceiro || p.expand?.parceiro) &&
            (p.valor_repasse || 0) > 0 &&
            p.pago_parceiro &&
            Boolean(p.data_pagamento_parceiro) &&
            isDateInPeriod(period, p.data_pagamento_parceiro),
        )
        .reduce((s, p) => s + (p.valor_repasse || 0), 0) * 100,
    ) / 100
  )
}

export function computePendingRepasses(policies: Policy[], period?: DatePeriod): number {
  return (
    Math.round(
      policies
        .filter(
          (p) =>
            p.tipo_de_venda === 'Parceiro' &&
            (p.parceiro || p.expand?.parceiro) &&
            (p.valor_repasse || 0) > 0 &&
            !p.pago_parceiro &&
            (!period || isDateInPeriod(period, p.start_date)),
        )
        .reduce((s, p) => s + (p.valor_repasse || 0), 0) * 100,
    ) / 100
  )
}

export function computePendingCommissionsInPeriod(policies: Policy[], period: DatePeriod): number {
  return (
    Math.round(
      policies
        .filter((p) => isDateInPeriod(period, p.start_date) && !p.comissao_recebida)
        .reduce((s, p) => s + calcNetCommission(p), 0) * 100,
    ) / 100
  )
}

export function computeCosts(custos: CustoFixo[], period: DatePeriod): number {
  return (
    Math.round(
      custos.filter((c) => isDateInPeriod(period, c.data)).reduce((s, c) => s + (c.valor || 0), 0) *
        100,
    ) / 100
  )
}

export function computeNetProfit(receitas: number, repasses: number, custos: number): number {
  return Math.round((receitas - repasses - custos) * 100) / 100
}

export function computeTotalGross(policies: Policy[]): number {
  return Math.round(policies.reduce((s, p) => s + (p.valor_bruto || 0), 0) * 100) / 100
}

export function computeTotalNet(policies: Policy[]): number {
  return (
    Math.round(policies.reduce((s, p) => s + (p.valor_liquido || p.premium_amount || 0), 0) * 100) /
    100
  )
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
  return (
    Math.round(
      policies
        .filter((p) => isDateInPeriod(period, p.start_date))
        .reduce((s, p) => s + calcNetCommission(p), 0) * 100,
    ) / 100
  )
}

export function computeExpectedRepasses(policies: Policy[], period: DatePeriod): number {
  return (
    Math.round(
      policies
        .filter(
          (p) =>
            p.tipo_de_venda === 'Parceiro' &&
            (p.parceiro || p.expand?.parceiro) &&
            (p.valor_repasse || 0) > 0 &&
            isDateInPeriod(period, p.start_date),
        )
        .reduce((s, p) => s + (p.valor_repasse || 0), 0) * 100,
    ) / 100
  )
}

export function computePaidCosts(custos: CustoFixo[], period: DatePeriod): number {
  return (
    Math.round(
      custos
        .filter(
          (c) =>
            c.pago === true &&
            Boolean(c.data_pagamento || c.data) &&
            isDateInPeriod(period, c.data_pagamento || c.data),
        )
        .reduce((s, c) => s + (c.valor || 0), 0) * 100,
    ) / 100
  )
}

export function computePendingCosts(custos: CustoFixo[], period: DatePeriod): number {
  return (
    Math.round(
      custos
        .filter((c) => c.pago !== true && isDateInPeriod(period, c.data))
        .reduce((s, c) => s + (c.valor || 0), 0) * 100,
    ) / 100
  )
}

export function computeExpectedProfit(
  expectedComm: number,
  expectedRepasses: number,
  totalCustos: number,
): number {
  return Math.round((expectedComm - expectedRepasses - totalCustos) * 100) / 100
}

export function computeRealProfit(
  commReceived: number,
  repassePaid: number,
  paidCosts: number,
): number {
  return Math.round((commReceived - repassePaid - paidCosts) * 100) / 100
}
