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
  'Condomínio',
  'Viagem',
  'Outros',
]

export const TIPOS_DE_VENDA = ['Produção Própria', 'Parceiro', 'Indicação']

export const MONTHS = [
  { value: 'ALL', label: 'Todos os meses' },
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

export const YEARS = ['ALL', '2027', '2026', '2025', '2024', '2023']

export function buildFilterString(filters: any): string {
  const parts: string[] = []
  if (filters?.dateFrom || filters?.dateTo) {
    if (filters?.dateFrom && filters?.dateTo) {
      parts.push(
        `(start_date >= "${filters.dateFrom}" && start_date <= "${filters.dateTo} 23:59:59")`,
      )
    } else if (filters?.dateFrom) {
      parts.push(`start_date >= "${filters.dateFrom}"`)
    } else if (filters?.dateTo) {
      parts.push(`start_date <= "${filters.dateTo} 23:59:59"`)
    }
  } else if (filters?.year && filters.year !== 'ALL') {
    const y = parseInt(filters.year, 10)
    if (!isNaN(y)) {
      if (filters?.month && filters.month !== 'ALL') {
        const m = parseInt(filters.month, 10)
        if (!isNaN(m)) {
          const startDate = `${y}-${String(m).padStart(2, '0')}-01 00:00:00`
          const nextYear = m === 12 ? y + 1 : y
          const nextMonth = m === 12 ? 1 : m + 1
          const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01 00:00:00`
          parts.push(`(start_date >= "${startDate}" && start_date < "${endDate}")`)
        } else {
          parts.push(`(start_date >= "${y}-01-01 00:00:00" && start_date <= "${y}-12-31 23:59:59")`)
        }
      } else {
        parts.push(`(start_date >= "${y}-01-01 00:00:00" && start_date <= "${y}-12-31 23:59:59")`)
      }
    }
  }
  if (filters?.partnerId && filters.partnerId !== 'ALL' && filters.partnerId !== '') {
    parts.push(`parceiro = "${filters.partnerId}"`)
  }
  if (filters?.seguradoraId && filters.seguradoraId !== 'ALL' && filters.seguradoraId !== '') {
    parts.push(`seguradora = "${filters.seguradoraId}"`)
  }
  if (filters?.tipoSeguro && filters.tipoSeguro !== 'ALL' && filters.tipoSeguro !== '') {
    parts.push(
      `(tipo_de_seguro = "${filters.tipoSeguro}" || coverage_type = "${filters.tipoSeguro}")`,
    )
  }
  return parts.join(' && ')
}

export const EMAIL_TEMPLATES: Record<string, { name: string; subject: string; body: string }> = {
  aniversario: {
    name: 'Feliz Aniversário',
    subject: 'Feliz aniversário, ${nome_cliente}! 🎉',
    body: 'Olá, ${nome_cliente}!\n\nDesejamos a você um feliz aniversário com muita saúde, paz e conquistas!\n\nAgradecemos pela parceria e por confiar na CRED10MIX para cuidar da sua proteção.\n\nAtenciosamente,\nEquipe CRED10MIX',
  },
  renovacao: {
    name: 'Lembrete de Renovação',
    subject: 'Sua apólice nº ${numero_apolice} vence em breve',
    body: 'Olá, ${nome_cliente}!\n\nLembramos que a sua apólice nº ${numero_apolice} está próxima da data de renovação.\n\nFale conosco para garantir a continuidade da sua proteção com as melhores condições.\n\nAtenciosamente,\nEquipe CRED10MIX',
  },
  personalizado: {
    name: 'Modelo Personalizado',
    subject: '',
    body: '',
  },
}

export function personalizeTemplate(template: string, vars: Record<string, string>): string {
  let text = template || ''
  Object.entries(vars).forEach(([key, val]) => {
    const reWithDollar = new RegExp(`\\$\\{${key}\\}`, 'g')
    const reBare = new RegExp(`\\{${key}\\}`, 'g')
    text = text.replace(reWithDollar, val || '').replace(reBare, val || '')
  })
  return text
}
