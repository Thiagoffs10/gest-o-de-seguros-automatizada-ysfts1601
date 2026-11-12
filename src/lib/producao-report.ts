import { Policy, Seguradora } from '@/types'
import { DatePeriod, formatBRDate } from '@/lib/date-filter'
import { exportFinancialListingPDF, SummaryCardItem } from '@/lib/financial-pdf'
import { downloadMultiSheetXlsx, ExcelSheet } from '@/lib/excel-export'
import { anexarVeiculoVigente } from '@/services/endorsements'
import { formatCurrency } from '@/lib/utils'

export type ProducaoReportKind = 'sintetico' | 'analitico'

export interface ProducaoSeguradoraResumo {
  nome: string
  quantidade: number
  premio: number
  comissao: number
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

function resolveVeiculo(policy: Policy): string {
  const partes: string[] = []
  if (policy.modelo_veiculo) partes.push(policy.modelo_veiculo)
  if (policy.placa) partes.push(`Placa ${policy.placa}`)
  if (policy.ano_fabricacao || policy.ano_modelo) {
    const ano = policy.ano_fabricacao || policy.ano_modelo
    const anoLabel =
      policy.ano_fabricacao && policy.ano_modelo
        ? `${policy.ano_fabricacao}/${policy.ano_modelo}`
        : String(ano)
    partes.push(anoLabel)
  }
  return partes.length > 0 ? partes.join(' · ') : '—'
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
      premio: list.reduce((s, p) => s + (p.premium_amount ?? 0), 0),
      comissao: list.reduce((s, p) => s + (p.commission ?? 0), 0),
    }))
    .sort((a, b) => b.premio - a.premio)
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
    premio: brl(r.premio),
    comissao: brl(r.comissao),
  }))

  const totalRow =
    porSeguradora.length > 0
      ? {
          seguradora: 'Total',
          quantidade: String(totals.quantidade),
          premio: brl(totals.premio),
          comissao: brl(totals.comissao),
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
      { header: 'Prêmio Total', dataKey: 'premio', align: 'right' },
      { header: 'Comissão Prevista', dataKey: 'comissao', align: 'right' },
    ],
    rows,
    totalRow,
    orientation: 'portrait',
    infoNotes: [
      'Relatório sintético: apenas totais consolidados do período, sem detalhamento por apólice.',
    ],
    filename: `relatorio-producao-sintetico-${periodLabel.replace(/\s/g, '-')}.pdf`,
  })
}

export async function exportProducaoAnaliticoPDF(data: ProducaoReportData): Promise<void> {
  const { title, subtitle, periodLabel } = buildHeaderInfo(data, 'analitico')
  const totals = computeProducaoTotals(data.policies)

  const columns = [
    { header: 'Cliente', dataKey: 'cliente', align: 'left' as const },
    { header: 'Seguradora', dataKey: 'seguradora', align: 'left' as const },
    { header: 'Apólice / Proposta', dataKey: 'apolice', align: 'left' as const },
    { header: 'Veículo Vigente', dataKey: 'veiculo', align: 'left' as const },
    { header: 'Início', dataKey: 'inicio', align: 'center' as const },
    { header: 'Prêmio', dataKey: 'premio', align: 'right' as const },
    { header: 'Comissão', dataKey: 'comissao', align: 'right' as const },
  ]

  const rows = sortBySeguradoraENumero(data.policies).map((p) => ({
    cliente: resolveClienteNome(p),
    seguradora: resolveSeguradoraNome(p, data.seguradoras),
    apolice: [p.policy_number, p.numero_proposta].filter(Boolean).join(' / ') || '—',
    veiculo: resolveVeiculo(p),
    inicio: formatBRDate(p.start_date),
    premio: brl(p.premium_amount ?? 0),
    comissao: brl(p.commission ?? 0),
  }))

  const totalRow = {
    cliente: 'Total',
    seguradora: '',
    apolice: `${totals.quantidade} apólice(s)`,
    veiculo: '',
    inicio: '',
    premio: brl(totals.premio),
    comissao: brl(totals.comissao),
  }

  await exportFinancialListingPDF({
    title,
    subtitle,
    periodLabel,
    columns,
    rows,
    totalRow,
    orientation: 'landscape',
    infoNotes: ['Veículo vigente considera o endosso mais recente, quando houver.'],
    filename: `relatorio-producao-analitico-${periodLabel.replace(/\s/g, '-')}.pdf`,
  })
}

export async function exportProducaoSinteticoExcel(data: ProducaoReportData): Promise<void> {
  const totals = computeProducaoTotals(data.policies)
  const porSeguradora = computeProducaoPorSeguradora(data.policies, data.seguradoras)

  const sheets: ExcelSheet[] = [
    {
      name: 'Sintético',
      columns: [
        { header: 'Seguradora', type: 'text' },
        { header: 'Apólices', type: 'number' },
        { header: 'Prêmio Total', type: 'currency' },
        { header: 'Comissão Prevista', type: 'currency' },
      ],
      rows: [
        ...porSeguradora.map((r) => [r.nome, r.quantidade, r.premio, r.comissao]),
        ['Total', totals.quantidade, totals.premio, totals.comissao],
      ],
    },
  ]

  downloadMultiSheetXlsx(
    `relatorio-producao-sintetico-${data.period.label.replace(/\W/g, '-')}.xlsx`,
    sheets,
  )
}

export async function exportProducaoAnaliticoExcel(data: ProducaoReportData): Promise<void> {
  const totals = computeProducaoTotals(data.policies)

  const sheets: ExcelSheet[] = [
    {
      name: 'Analítico',
      columns: [
        { header: 'Cliente', type: 'text' },
        { header: 'Seguradora', type: 'text' },
        { header: 'Apólice', type: 'text' },
        { header: 'Proposta', type: 'text' },
        { header: 'Veículo Vigente', type: 'text' },
        { header: 'Placa', type: 'text' },
        { header: 'Início', type: 'text' },
        { header: 'Prêmio', type: 'currency' },
        { header: 'Comissão', type: 'currency' },
      ],
      rows: [
        ...sortBySeguradoraENumero(data.policies).map((p) => [
          resolveClienteNome(p),
          resolveSeguradoraNome(p, data.seguradoras),
          p.policy_number || '—',
          p.numero_proposta || '—',
          resolveVeiculo(p),
          p.placa || '—',
          formatBRDate(p.start_date),
          p.premium_amount ?? 0,
          p.commission ?? 0,
        ]),
        [
          'Total',
          '',
          `${totals.quantidade} apólice(s)`,
          '',
          '',
          '',
          '',
          totals.premio,
          totals.comissao,
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
 * Enriquece as apólices do período com o veículo vigente (endosso mais recente),
 * antes de gerar qualquer relatório. Em memória — nada é gravado na base.
 */
export async function prepararPoliciesParaRelatorio(policies: Policy[]): Promise<Policy[]> {
  if (policies.length === 0) return policies
  try {
    return await anexarVeiculoVigente(policies)
  } catch {
    return policies
  }
}
