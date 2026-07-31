import { Policy, CustoFixo } from '@/types'
import { DatePeriod, isDateInPeriod } from '@/lib/date-filter'

const calcNetCommission = (p: Policy) => (p.commission || 0) - (p.iss || 0)

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
): FinancialMetrics {
  const totalReceitas = policies
    .filter(
      (p) =>
        p.comissao_recebida === true &&
        Boolean(p.data_recebimento_comissao) &&
        isDateInPeriod(period, p.data_recebimento_comissao),
    )
    .reduce((s, p) => s + calcNetCommission(p), 0)

  const totalRepasses = policies
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

  const totalCustos = custos
    .filter((c) => isDateInPeriod(period, c.data))
    .reduce((s, c) => s + (c.valor || 0), 0)

  return {
    totalReceitas,
    totalRepasses,
    totalCustos,
    lucroLiquido: totalReceitas - totalRepasses - totalCustos,
  }
}
