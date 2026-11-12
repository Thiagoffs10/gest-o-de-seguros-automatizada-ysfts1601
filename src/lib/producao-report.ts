import { Policy, Seguradora } from '@/types'
import { DatePeriod, formatBRDate } from '@/lib/date-filter'
import { exportFinancialListingPDF, SummaryCardItem } from '@/lib/financial-pdf'
import { downloadMultiSheetXlsx, ExcelSheet } from '@/lib/excel-export'
import { formatCurrency } from '@/lib/utils'

export type ProducaoReportKind = 'sintetico' | 'analitico'

export interface ProducaoSeguradoraResumo {
  nome: string
  quantidade: number
  premioBruto: number
  premioLiquido: number
  comissaoBruta: number
  comissaoLiquida: number
}

export interface ProducaoReportData {
  policies: Policy[]
  period: DatePeriod
  seguradoraNome: string
  seguradoras: Seguradora[]
}

function brl(value: number): string {
  return `R$ ${formatCurrency(value)}`
}

function resolveSeguradoraNome(policy: Policy, seguradoras: Seguradora[]): string {
  if (policy.expand?.seguradora?.nome) return policy.expand?.seguradora?.nome
  if (policy.insurance_company) return policy.insurance_company
  const byId = (policy.seguradora || '').trim()
  if (byId && seguradoras.length > 0) {
    const found = seguradoras.find((s) => s.id === byId || s.nome === byId)
    if (found) return found.nome
  }
  return 'Não informada'
}

function resolveClienteNome(policy: Policy): string {
  return policy.expand?.client?.name || 'Cliente Indefinido'
}

function resolveRamo(policy: Policy): string {
  const ramo = (policy.tipo_de_seguro || policy.coverage_type || '').trim()
  if (!ramo) return '—'
  // Primeira letra maiúscula; se vier todo em maiúsculas, normaliza o resto
  if (ramo === ramo.toUpperCase()) {
    return ramo.charAt(0).toUpperCase() + ramo.slice(1).toLowerCase()
  }
  return ramo.charAt(0).toUpperCase() + ramo.slice(1)
}

/**
 * Prêmio bruto da apólice. O `valor_bruto` é o prêmio total comercializado;
 * `premium_amount` é o LÍQUIDO (mesmo valor de `valor_liquido` do cadastro).
 * Sem bruto gravado, usa o próprio líquido.
 */
function resolvePremioBruto(policy: Policy): number {
  if (policy.valor_bruto != null && Number(policy.valor_bruto) > 0)
    return Number(policy.valor_bruto)
  return Number(policy.premium_amount ?? 0)
}

function resolvePremioLiquido(policy: Policy): number {
  return Number(policy.premium_amount ?? 0)
}

function resolveComissaoBruta(policy: Policy): number {
  return Number(policy.commission ?? 0)
}

/**
 * Comissão líquida = Comissão bruta − ISS. O `iss` gravado na apólice já é
 * commission × imposto_percentual da seguradora (calculado no cadastro).
 * Sem ISS gravado, tenta derivar do percentual da seguradora; sem percentual,
 * líquida = bruta.
 */
function resolveComissaoLiquida(policy: Policy, seguradoras: Seguradora[]): number {
  const bruta = resolveComissaoBruta(policy)
  let iss: number | null = policy.iss != null ? Number(policy.iss) : null
  if (iss == null) {
    const seg = findSeguradora(policy, seguradoras)
    const percentual = seg?.imposto_percentual != null ? Number(seg.imposto_percentual) : null
    if (percentual != null && percentual > 0) {
      iss = Math.round(((bruta * percentual) / 100) * 100) / 100
    } else {
      iss = 0
    }
  }
  return Math.max(0, Math.round((bruta - (iss || 0)) * 100) / 100)
}

function findSeguradora(policy: Policy, seguradoras: Seguradora[]): Seguradora | undefined {
  if (policy.expand?.seguradora) return policy.expand.seguradora
  const ref = (policy.seguradora || '').trim()
  if (!ref || seguradoras.length === 0) return undefined
  return seguradoras.find((s) => s.id === ref || s.nome === ref)
}

function sortBySeguradoraENumero(policies: Policy[]): Policy[] {
  return [...policies].sort((a, b) => {
    const nameA = a.expand?.seguradora?.nome || a.insurance_company || ''
    const nameB = b.expand?.seguradora?.nome || b.insurance_company || ''
    if (nameA !== nameB) return nameA.localeCompare(nameB, 'pt-BR')
    return (a.policy_number || a.numero_proposta || '').localeCompare(
      b.policy_number || b.numero_proposta || '',
      'pt-BR',
    )
  })
}

export function computeProducaoTotals(policies: Policy[]) {
  return {
    quantidade: policies.length,
    premio: policies.reduce((s, p) => s + (p.premium_amount ?? 0), 0),
    comissao: policies.reduce((s, p) => s + (p.commission ?? 0), 0),
  }
}

/** Totais com bruto/líquido — usados no rodapé do analítico. */
export function computeProducaoTotalsBrutoLiquido(policies: Policy[], seguradoras: Seguradora[]) {
  const round = (v: number) => Math.round(v * 100) / 100
  return {
    quantidade: policies.length,
    premioBruto: round(policies.reduce((s, p) => s + resolvePremioBruto(p), 0)),
    premioLiquido: round(policies.reduce((s, p) => s + resolvePremioLiquido(p), 0)),
    comissaoBruta: round(policies.reduce((s, p) => s + resolveComissaoBruta(p), 0)),
    comissaoLiquida: round(
      policies.reduce((s, p) => s + resolveComissaoLiquida(p, seguradoras), 0),
    ),
  }
}

export function computeProducaoPorSeguradora(
  policies: Policy[],
  seguradoras: Seguradora[],
): ProducaoSeguradoraResumo[] {
  const groups = new Map<string, Policy[]>()
  for (const p of policies) {
    const nome = resolveSeguradoraNome(p, seguradoras)
    const list = groups.get(nome) || []
    list.push(p)
    groups.set(nome, list)
  }
  return [...groups.entries()]
    .map(([nome, list]) => ({
      nome,
      quantidade: list.length,
      premioBruto: list.reduce((s, p) => s + resolvePremioBruto(p), 0),
      premioLiquido: list.reduce((s, p) => s + resolvePremioLiquido(p), 0),
      comissaoBruta: list.reduce((s, p) => s + resolveComissaoBruta(p), 0),
      comissaoLiquida: list.reduce((s, p) => s + resolveComissaoLiquida(p, seguradoras), 0),
    }))
    .sort((a, b) => b.premioLiquido - a.premioLiquido)
}

function buildHeaderInfo(
  data: ProducaoReportData,
  kind: ProducaoReportKind,
): {
  title: string
  subtitle: string
  periodLabel: string
} {
  const kindLabel = kind === 'sintetico' ? 'Sintético' : 'Analítico'
  const periodLabel =
    formatBRDate(data.period.start) === formatBRDate(data.period.end)
      ? formatBRDate(data.period.start)
      : `${formatBRDate(data.period.start)} a ${formatBRDate(data.period.end)}`
  return {
    title: `Produção ${data.seguradoraNome} — ${periodLabel}`,
    subtitle: `Relatório ${kindLabel} da produção do período`,
    periodLabel,
  }
}

export async function exportProducaoSinteticoPDF(data: ProducaoReportData): Promise<void> {
  const { title, subtitle, periodLabel } = buildHeaderInfo(data, 'sintetico')
  const totals = computeProducaoTotals(data.policies)
  const totalsBL = computeProducaoTotalsBrutoLiquido(data.policies, data.seguradoras)
  const porSeguradora = computeProducaoPorSeguradora(data.policies, data.seguradoras)

  const summaryCards: SummaryCardItem[] = [
    {
      label: 'Apólices Emitidas',
      value: String(totals.quantidade),
      variant: 'blue',
    },
    { label: 'Prêmio Total', value: brl(totals.premio), variant: 'green' },
    { label: 'Comissão Prevista', value: brl(totals.comissao), variant: 'amber' },
  ]

  const rows = porSeguradora.map((r) => ({
    seguradora: r.nome,
    quantidade: String(r.quantidade),
    premio_bruto: brl(r.premioBruto),
    premio_liquido: brl(r.premioLiquido),
    comissao_bruta: brl(r.comissaoBruta),
    comissao_liquida: brl(r.comissaoLiquida),
  }))

  const totalRow =
    porSeguradora.length > 0
      ? {
          seguradora: 'Total',
          quantidade: String(totals.quantidade),
          premio_bruto: brl(totalsBL.premioBruto),
          premio_liquido: brl(totalsBL.premioLiquido),
          comissao_bruta: brl(totalsBL.comissaoBruta),
          comissao_liquida: brl(totalsBL.comissaoLiquida),
        }
      : undefined

  await exportFinancialListingPDF({
    title,
    subtitle,
    periodLabel,
    summaryCards,
    columns: [
      { header: 'Seguradora', dataKey: 'seguradora', align: 'left' },
      { header: 'Apólices', dataKey: 'quantidade', align: 'center' },
      { header: 'Prêmio Bruto', dataKey: 'premio_bruto', align: 'right' },
      { header: 'Prêmio Líquido', dataKey: 'premio_liquido', align: 'right' },
      { header: 'Comissão Bruta', dataKey: 'comissao_bruta', align: 'right' },
      { header: 'Comissão Líquida', dataKey: 'comissao_liquida', align: 'right' },
    ],
    rows,
    totalRow,
    orientation: 'portrait',
    infoNotes: [
      'Relatório sintético: apenas totais consolidados do período, sem detalhamento por apólice.',
      'Prêmio líquido = premium_amount (valor líquido do cadastro); comissão líquida = comissão bruta − ISS da seguradora.',
    ],
    filename: `relatorio-producao-sintetico-${periodLabel.replace(/\s/g, '-')}.pdf`,
  })
}

export async function exportProducaoAnaliticoPDF(data: ProducaoReportData): Promise<void> {
  const { title, subtitle, periodLabel } = buildHeaderInfo(data, 'analitico')
  const totals = computeProducaoTotalsBrutoLiquido(data.policies, data.seguradoras)

  const columns = [
    { header: 'Cliente', dataKey: 'cliente', align: 'left' as const },
    { header: 'Seguradora', dataKey: 'seguradora', align: 'left' as const },
    { header: 'Apólice / Proposta', dataKey: 'apolice', align: 'left' as const },
    { header: 'Ramo do Seguro', dataKey: 'ramo', align: 'left' as const },
    { header: 'Início', dataKey: 'inicio', align: 'center' as const },
    { header: 'Prêmio Bruto', dataKey: 'premio_bruto', align: 'right' as const },
    { header: 'Prêmio Líquido', dataKey: 'premio_liquido', align: 'right' as const },
    { header: 'Comissão Bruta', dataKey: 'comissao_bruta', align: 'right' as const },
    { header: 'Comissão Líquida', dataKey: 'comissao_liquida', align: 'right' as const },
  ]

  const rows = sortBySeguradoraENumero(data.policies).map((p) => ({
    cliente: resolveClienteNome(p),
    seguradora: resolveSeguradoraNome(p, data.seguradoras),
    apolice: [p.policy_number, p.numero_proposta].filter(Boolean).join(' / ') || '—',
    ramo: resolveRamo(p),
    inicio: formatBRDate(p.start_date),
    premio_bruto: brl(resolvePremioBruto(p)),
    premio_liquido: brl(resolvePremioLiquido(p)),
    comissao_bruta: brl(resolveComissaoBruta(p)),
    comissao_liquida: brl(resolveComissaoLiquida(p, data.seguradoras)),
  }))

  const totalRow = {
    cliente: 'Total',
    seguradora: '',
    apolice: `${totals.quantidade} apólice(s)`,
    ramo: '',
    inicio: '',
    premio_bruto: brl(totals.premioBruto),
    premio_liquido: brl(totals.premioLiquido),
    comissao_bruta: brl(totals.comissaoBruta),
    comissao_liquida: brl(totals.comissaoLiquida),
  }

  await exportFinancialListingPDF({
    title,
    subtitle,
    periodLabel,
    columns,
    rows,
    totalRow,
    orientation: 'landscape',
    infoNotes: [
      'Comissão líquida = comissão bruta − ISS (percentual de imposto da seguradora).',
      'Prêmio bruto = prêmio total comercializado; sem bruto gravado, exibe o prêmio líquido.',
    ],
    filename: `relatorio-producao-analitico-${periodLabel.replace(/\s/g, '-')}.pdf`,
  })
}

export async function exportProducaoSinteticoExcel(data: ProducaoReportData): Promise<void> {
  const totalsBL = computeProducaoTotalsBrutoLiquido(data.policies, data.seguradoras)
  const porSeguradora = computeProducaoPorSeguradora(data.policies, data.seguradoras)

  const sheets: ExcelSheet[] = [
    {
      name: 'Sintético',
      columns: [
        { header: 'Seguradora', type: 'text' },
        { header: 'Apólices', type: 'number' },
        { header: 'Prêmio Bruto', type: 'currency' },
        { header: 'Prêmio Líquido', type: 'currency' },
        { header: 'Comissão Bruta', type: 'currency' },
        { header: 'Comissão Líquida', type: 'currency' },
      ],
      rows: [
        ...porSeguradora.map((r) => [
          r.nome,
          r.quantidade,
          r.premioBruto,
          r.premioLiquido,
          r.comissaoBruta,
          r.comissaoLiquida,
        ]),
        [
          'Total',
          totalsBL.quantidade,
          totalsBL.premioBruto,
          totalsBL.premioLiquido,
          totalsBL.comissaoBruta,
          totalsBL.comissaoLiquida,
        ],
      ],
    },
  ]

  downloadMultiSheetXlsx(
    `relatorio-producao-sintetico-${data.period.label.replace(/\W/g, '-')}.xlsx`,
    sheets,
  )
}

export async function exportProducaoAnaliticoExcel(data: ProducaoReportData): Promise<void> {
  const totals = computeProducaoTotalsBrutoLiquido(data.policies, data.seguradoras)

  const sheets: ExcelSheet[] = [
    {
      name: 'Analítico',
      columns: [
        { header: 'Cliente', type: 'text' },
        { header: 'Seguradora', type: 'text' },
        { header: 'Apólice', type: 'text' },
        { header: 'Proposta', type: 'text' },
        { header: 'Ramo do Seguro', type: 'text' },
        { header: 'Início', type: 'text' },
        { header: 'Prêmio Bruto', type: 'currency' },
        { header: 'Prêmio Líquido', type: 'currency' },
        { header: 'Comissão Bruta', type: 'currency' },
        { header: 'Comissão Líquida', type: 'currency' },
      ],
      rows: [
        ...sortBySeguradoraENumero(data.policies).map((p) => [
          resolveClienteNome(p),
          resolveSeguradoraNome(p, data.seguradoras),
          p.policy_number || '—',
          p.numero_proposta || '—',
          resolveRamo(p),
          formatBRDate(p.start_date),
          resolvePremioBruto(p),
          resolvePremioLiquido(p),
          resolveComissaoBruta(p),
          resolveComissaoLiquida(p, data.seguradoras),
        ]),
        [
          'Total',
          '',
          `${totals.quantidade} apólice(s)`,
          '',
          '',
          '',
          totals.premioBruto,
          totals.premioLiquido,
          totals.comissaoBruta,
          totals.comissaoLiquida,
        ],
      ],
    },
  ]

  downloadMultiSheetXlsx(
    `relatorio-producao-analitico-${data.period.label.replace(/\W/g, '-')}.xlsx`,
    sheets,
  )
}

/**
 * Enriquecimento pré-relatório. A coluna "Veículo Vigente" foi substituída por
 * "Ramo do Seguro" (campo da própria apólice), então não há mais busca de
 * endossos: devolve as apólices como já vieram filtradas do Dashboard.
 */
export async function prepararPoliciesParaRelatorio(policies: Policy[]): Promise<Policy[]> {
  return policies
}
