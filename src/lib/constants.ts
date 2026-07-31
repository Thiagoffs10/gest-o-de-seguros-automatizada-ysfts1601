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
  if (filters?.year && filters.year !== 'ALL') {
    parts.push(`created >= "${filters.year}-01-01 00:00:00"`)
  }
  return parts.join(' && ')
}

export const EMAIL_TEMPLATES: Record<string, { name: string; subject: string; body: string }> = {
  aniversario: {
    name: 'Feliz Aniversário',
    subject: 'Parabéns pelo seu dia, ${nome_cliente}!',
    body: 'Olá ${nome_cliente},\n\nDesejamos a você um feliz aniversário! Muita saúde, paz e realizações.\n\nAgradecemos a confiança em nossos serviços.\n\nAtenciosamente,\nCRED10MIX Seguros',
  },
  renovacao: {
    name: 'Lembrete de Renovação',
    subject: 'Sua apólice nº ${numero_apolice} está próxima do vencimento',
    body: 'Olá ${nome_cliente},\n\nLembramos que a sua apólice nº ${numero_apolice} vencerá em breve.\n\nEntre em contato conosco para renovar com as melhores condições.\n\nAtenciosamente,\nCRED10MIX Seguros',
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
    const re = new RegExp(`\\$\\{${key}\\}`, 'g')
    text = text.replace(re, val)
  })
  return text
}
