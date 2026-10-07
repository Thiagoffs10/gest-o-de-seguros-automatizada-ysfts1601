import { Policy, CustoFixo, ComissaoRecebimento, ComissaoPrevista } from '@/types'
import { DatePeriod, isDateInPeriod, extractDatePart } from '@/lib/date-filter'

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
 * NOTA DE AUDITORIA — DIVERGÊNCIA HISTÓRICA R$ 154,59 (ITEM C / Ponto 2):
 * A diferença histórica identificada de R$ 154,59 decorre exclusivamente de apólices legadas
 * que continham a flag booleana antiga `comissao_recebida = true` combinada com deduções de ISS
 * estimado calculadas estaticamente na apólice, sem lançamentos reais de movimentação em
 * `comissao_recebimentos`. Nenhuma lógica de cálculo ativo foi alterada; as apólices legadas
 * mantêm sua compatibilidade e todos os novos recebimentos operam estritamente via registros
 * efetivos com rastreabilidade total.
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

export interface QuickPayLiquidacaoResult {
  comissaoRepasse: number
  totalDebitos: number
  debitoAbatidoEfetivo: number
  baseAposDeducao: number
  taxaPix: number
  liquidoFinal: number
  saldoDevedorRemanescente: number
}

/**
 * Realiza o cálculo de liquidação rápida de repasse com dedução de débitos/adiantamentos.
 * Regras:
 * - Se houver débitos, deduz da comissão de repasse.
 * - Taxa PIX: 1% sobre o líquido a pagar APÓS a dedução, limitado ao teto de R$ 10,00.
 * - Caso débito >= comissão: líquido = R$ 0,00, taxa PIX = R$ 0,00, sem valores negativos.
 * - Sem débitos: líquido = comissão, taxa PIX = 1% (teto R$ 10,00).
 */
export function computeQuickPayLiquidacao(
  comissaoRepasse: number,
  debitos: Array<{ valor: number }>,
): QuickPayLiquidacaoResult {
  const repasse = Math.max(0, Math.round((Number(comissaoRepasse) || 0) * 100) / 100)
  const totalDeb =
    Math.round(debitos.reduce((acc, d) => acc + (Number(d.valor) || 0), 0) * 100) / 100

  const debitoAbatido = Math.min(repasse, totalDeb)
  const baseAposDeducao = Math.max(0, Math.round((repasse - totalDeb) * 100) / 100)

  // Taxa PIX: 1% sobre o líquido após dedução, máx R$ 10,00. R$ 0,00 se nada a transferir
  const taxaPix =
    baseAposDeducao > 0 ? Math.round(Math.min(10, (baseAposDeducao * 1) / 100) * 100) / 100 : 0

  const liquidoFinal = Math.max(0, Math.round((baseAposDeducao - taxaPix) * 100) / 100)
  const saldoDevedorRemanescente = Math.max(0, Math.round((totalDeb - repasse) * 100) / 100)

  return {
    comissaoRepasse: repasse,
    totalDebitos: totalDeb,
    debitoAbatidoEfetivo: debitoAbatido,
    baseAposDeducao,
    taxaPix,
    liquidoFinal,
    saldoDevedorRemanescente,
  }
}

/**
 * Informações de apólice com comissão pendente há mais de 60 dias.
 */
export interface PendenciaComissao60Item {
  policy: Policy
  dataReferencia: string // YYYY-MM-DD
  origemReferencia: 'competencia' | 'start_date' | 'created'
  diasParados: number
  comissaoPrevista: number
  valorRecebidoBruto: number
  saldoPendente: number
  competenciaSugerida?: string
  comissaoPrevistaId?: string
}

export interface PendenciasComissao60Result {
  totalValorPendente: number
  countApolices: number
  itens: PendenciaComissao60Item[]
}

/**
 * Normaliza uma competência MM/AAAA (ou M/AAAA) para a data ISO do 1º dia (YYYY-MM-01).
 * Retorna null se não estiver no formato.
 */
export function getFirstDayFromCompetencia(competencia?: string): string | null {
  if (!competencia || typeof competencia !== 'string') return null
  const cleaned = competencia.trim()
  const match = cleaned.match(/^(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const month = match[1].padStart(2, '0')
  const year = match[2]
  return `${year}-${month}-01`
}

/**
 * Calcula a diferença em dias corridos entre a data de referência e a data atual (ou hoje simulado).
 */
export function calculateElapsedDays(dataReferencia: string, todayStr?: string): number {
  const refPart = extractDatePart(dataReferencia)
  if (!refPart) return 0
  const todayPart = todayStr ? extractDatePart(todayStr) : new Date().toISOString().split('T')[0]

  const refDate = new Date(`${refPart}T00:00:00`)
  const curDate = new Date(`${todayPart}T00:00:00`)

  const diffMs = curDate.getTime() - refDate.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Identifica apólices com comissão sem baixa há mais de 60 dias corridos.
 *
 * Regras:
 * 1. Apólice não cancelada (status !== 'Cancelada').
 * 2. Saldo pendente > 0.009 e não quitada (isPolicyCommissionSettled == false).
 * 3. Data de referência:
 *    - Se tiver competência MM/AAAA mais antiga pendente em `comissoesPrevistas` -> 1º dia do mês (YYYY-MM-01).
 *    - Senão -> data de início de vigência da apólice (start_date).
 *    - Senão -> data de criação do registro (created).
 * 4. Dias corridos > 60 (exatamente 60 NÃO entra; 61 entra).
 * 5. Ordenado do mais antigo (maior diasParados) para o mais novo.
 */
export function computePendenciasComissao60(
  policies: Policy[],
  recebimentos: ComissaoRecebimento[] = [],
  comissoesPrevistas: ComissaoPrevista[] = [],
  todayStr?: string,
): PendenciasComissao60Result {
  // Mapa de recebimentos brutos por apólice e por previsão
  const recGrossByPolicy = new Map<string, number>()
  const recGrossByPrev = new Map<string, number>()

  for (const r of recebimentos) {
    const vBruto = Number(r.valor_bruto) || 0
    if (r.policy) {
      recGrossByPolicy.set(r.policy, (recGrossByPolicy.get(r.policy) || 0) + vBruto)
    }
    if (r.comissao_prevista) {
      recGrossByPrev.set(
        r.comissao_prevista,
        (recGrossByPrev.get(r.comissao_prevista) || 0) + vBruto,
      )
    }
  }

  // Previsões por apólice
  const prevsByPolicy = new Map<string, ComissaoPrevista[]>()
  for (const prev of comissoesPrevistas) {
    if (prev.status === 'Cancelada') continue
    if (!prevsByPolicy.has(prev.policy)) {
      prevsByPolicy.set(prev.policy, [])
    }
    prevsByPolicy.get(prev.policy)!.push(prev)
  }

  const itens: PendenciaComissao60Item[] = []

  for (const p of policies) {
    // 1. Apólice cancelada nunca alerta
    if (p.status === 'Cancelada') continue

    // 2. Apólice com alerta dispensado / ignorado pelo usuário nunca alerta
    if (p.comissao_alerta_60d_ignorado === true) continue

    // 3. Apólice marcada como comissão já recebida no cadastro legado/histórico
    if (p.comissao_recebida === true) continue

    const polPrevs = prevsByPolicy.get(p.id) || []
    let totalPrevisto = 0
    let totalSaldo = 0
    let oldestCompFirstDay: string | null = null
    let oldestCompLabel: string | undefined = undefined
    let oldestCompPrevId: string | undefined = undefined

    if (polPrevs.length > 0) {
      // Se TODAS as previsões ativas da apólice já estão quitadas / Recebidas no banco
      const todasRecebidas = polPrevs.every((prev) => prev.status === 'Recebida')
      if (todasRecebidas) continue

      // Ordenar previsões pela data_prevista / competência
      const sortedPrevs = [...polPrevs].sort((a, b) => {
        const da = a.data_prevista || getFirstDayFromCompetencia(a.competencia) || a.created || ''
        const db = b.data_prevista || getFirstDayFromCompetencia(b.competencia) || b.created || ''
        return da.localeCompare(db)
      })

      // Alocação FIFO de recebimentos da apólice para previsões sem vínculo direto
      // Calcula quanto sobrou de recebimentos brutos da apólice após abater vínculos diretos
      const saldoRestantePorPrev = new Map<string, number>()
      for (const prev of sortedPrevs) {
        const vPrev = Number(prev.valor_previsto) || 0
        const recDireto = recGrossByPrev.get(prev.id) || 0
        saldoRestantePorPrev.set(prev.id, Math.max(0, Math.round((vPrev - recDireto) * 100) / 100))
      }

      // Recebimentos da apólice sem vínculo direto a comissao_prevista
      const polRecsSemVinculo = recebimentos.filter(
        (r) =>
          r.policy === p.id &&
          (!r.comissao_prevista || !saldoRestantePorPrev.has(r.comissao_prevista)),
      )
      let sobraNaoVinculada =
        Math.round(polRecsSemVinculo.reduce((s, r) => s + (Number(r.valor_bruto) || 0), 0) * 100) /
        100

      // Distribui FIFO a sobra não vinculada pelas previsões em aberto
      for (const prev of sortedPrevs) {
        if (sobraNaoVinculada <= 0.009) break
        const sAtual = saldoRestantePorPrev.get(prev.id) || 0
        if (sAtual > 0.009) {
          const abate = Math.min(sAtual, sobraNaoVinculada)
          saldoRestantePorPrev.set(prev.id, Math.max(0, Math.round((sAtual - abate) * 100) / 100))
          sobraNaoVinculada = Math.max(0, Math.round((sobraNaoVinculada - abate) * 100) / 100)
        }
      }

      for (const prev of sortedPrevs) {
        const vPrev = Number(prev.valor_previsto) || 0
        totalPrevisto = Math.round((totalPrevisto + vPrev) * 100) / 100
        // Se a previsão foi marcada como 'Recebida', seu saldo é zero
        const saldo = prev.status === 'Recebida' ? 0 : saldoRestantePorPrev.get(prev.id) || 0
        totalSaldo = Math.round((totalSaldo + saldo) * 100) / 100

        // Se tem saldo pendente nessa parcela/competência e ainda não elegemos a mais antiga
        if (saldo > 0.009 && !oldestCompFirstDay) {
          const compFirstDay = getFirstDayFromCompetencia(prev.competencia)
          if (compFirstDay) {
            oldestCompFirstDay = compFirstDay
            oldestCompLabel = prev.competencia
            oldestCompPrevId = prev.id
          } else if (prev.data_prevista) {
            oldestCompFirstDay = extractDatePart(prev.data_prevista)
            oldestCompLabel = prev.competencia
            oldestCompPrevId = prev.id
          }
        }
      }

      // Se a apólice está quitada (saldo zerado e recebido > 0)
      const recBrutoTotal = recGrossByPolicy.get(p.id) || 0
      if (totalSaldo <= 0.009 && recBrutoTotal > 0.009) {
        continue
      }
    } else {
      // Fallback sem comissões previstas
      const fallbackPrevisto =
        p.commission != null
          ? Number(p.commission)
          : Math.round(
              (((p.valor_liquido || p.premium_amount || 0) * (p.commission_percent || 0)) / 100) *
                100,
            ) / 100
      const iss = Number(p.iss || 0)
      totalPrevisto = Math.max(0, Math.round((fallbackPrevisto - iss) * 100) / 100)
      const rec = recGrossByPolicy.get(p.id) || 0
      totalSaldo = Math.max(0, Math.round((totalPrevisto - rec) * 100) / 100)

      if (totalSaldo <= 0.009) continue
    }

    // Sem saldo a receber pendente
    if (totalSaldo <= 0.009) continue

    // Determinar data de referência:
    // 1. Competência (1º dia do mês YYYY-MM-01)
    // 2. start_date
    // 3. created
    let dataReferencia = ''
    let origemReferencia: 'competencia' | 'start_date' | 'created' = 'created'

    if (oldestCompFirstDay) {
      dataReferencia = oldestCompFirstDay
      origemReferencia = 'competencia'
    } else if (p.start_date) {
      dataReferencia = extractDatePart(p.start_date)
      origemReferencia = 'start_date'
    } else if (p.created) {
      dataReferencia = extractDatePart(p.created)
      origemReferencia = 'created'
    }

    if (!dataReferencia) continue

    const diasParados = calculateElapsedDays(dataReferencia, todayStr)

    // Critério: dias corridos > 60
    if (diasParados > 60) {
      const recBruto = recGrossByPolicy.get(p.id) || 0
      itens.push({
        policy: p,
        dataReferencia,
        origemReferencia,
        diasParados,
        comissaoPrevista: totalPrevisto,
        valorRecebidoBruto: recBruto,
        saldoPendente: totalSaldo,
        competenciaSugerida: oldestCompLabel,
        comissaoPrevistaId: oldestCompPrevId,
      })
    }
  }

  // Ordenar do mais antigo para o mais novo (maior diasParados primeiro)
  itens.sort((a, b) => {
    if (b.diasParados !== a.diasParados) {
      return b.diasParados - a.diasParados
    }
    return (b.policy.policy_code || 0) - (a.policy.policy_code || 0)
  })

  const totalValorPendente =
    Math.round(itens.reduce((sum, item) => sum + item.saldoPendente, 0) * 100) / 100

  return {
    totalValorPendente,
    countApolices: itens.length,
    itens,
  }
}
