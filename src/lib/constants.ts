export const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

export const TIPOS_DE_SEGURO = [
  'Auto',
  'Vida',
  'Residencial',
  'Empresarial',
  'Saúde',
  'Outros',
  'Condomínio',
  'Viagem',
]

export const TIPOS_DE_VENDA = ['Produção Própria', 'Parceiro', 'Indicação']

export const MONTHS = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]

export const YEARS = ['2024', '2025', '2026', '2027']

export function buildFilterString(
  base: string,
  filters: {
    year?: string
    month?: string
    dateFrom?: string
    dateTo?: string
    partnerId?: string
    seguradoraId?: string
    tipoSeguro?: string
  },
  dateField: string = 'created',
): string {
  let f = base
  if (filters.year) {
    const cond = `${dateField} >= "${filters.year}-01-01" && ${dateField} <= "${filters.year}-12-31"`
    f = f ? `${f} && ${cond}` : cond
  }
  if (filters.year && filters.month) {
    const m = parseInt(filters.month)
    const lastDay = new Date(parseInt(filters.year), m, 0).getDate()
    const cond = `${dateField} >= "${filters.year}-${String(m).padStart(2, '0')}-01" && ${dateField} <= "${filters.year}-${String(m).padStart(2, '0')}-${lastDay}"`
    f = f ? `${f} && ${cond}` : cond
  }
  if (filters.dateFrom) {
    const cond = `${dateField} >= "${filters.dateFrom}"`
    f = f ? `${f} && ${cond}` : cond
  }
  if (filters.dateTo) {
    const cond = `${dateField} <= "${filters.dateTo}"`
    f = f ? `${f} && ${cond}` : cond
  }
  if (filters.partnerId) {
    const cond = `parceiro = "${filters.partnerId}"`
    f = f ? `${f} && ${cond}` : cond
  }
  if (filters.seguradoraId) {
    const cond = `seguradora = "${filters.seguradoraId}"`
    f = f ? `${f} && ${cond}` : cond
  }
  if (filters.tipoSeguro) {
    const cond = `tipo_de_seguro = "${filters.tipoSeguro}" || coverage_type = "${filters.tipoSeguro}"`
    f = f ? `${f} && (${cond})` : cond
  }
  return f
}
