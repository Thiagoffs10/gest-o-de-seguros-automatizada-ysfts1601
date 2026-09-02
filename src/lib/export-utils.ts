import { Client, Policy } from '@/types'

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const BOM = '\uFEFF'
  const csv = [
    headers.join(';'),
    ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')),
  ].join('\n')
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatClientDocument(client: Client): string {
  if (client.tipo_pessoa === 'PJ') {
    return client.cnpj || ''
  }
  return client.cpf || ''
}

function formatClientAddress(client: Client): string {
  const parts = [client.rua, client.numero, client.bairro, client.cidade, client.estado]
  return parts.filter((p) => p && p.trim()).join(', ')
}

function formatBirthDate(dateStr?: string): string {
  if (!dateStr) return ''
  const cleaned = String(dateStr).trim()
  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`
  }
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = date.getUTCFullYear()
  return `${day}/${month}/${year}`
}

export function exportClientsToCsv(clients: Client[], policies: Policy[]) {
  const headers = [
    'Nome',
    'CPF/CNPJ',
    'Data de Nascimento',
    'Telefone',
    'Email',
    'Endereço',
    'Apólice',
    'Seguradora',
    'Tipo de Seguro',
    'Valor Bruto',
    'Valor Líquido',
    'Comissão',
  ]

  const rows: (string | number)[][] = []

  for (const client of clients) {
    const clientPolicies = policies.filter((p) => p.client === client.id)

    if (clientPolicies.length === 0) {
      rows.push([
        client.name || '',
        formatClientDocument(client),
        formatBirthDate(client.birth_date),
        client.phone || '',
        client.email || '',
        formatClientAddress(client),
        '',
        '',
        '',
        0,
        0,
        0,
      ])
      continue
    }

    for (const p of clientPolicies) {
      const valorBruto = p.valor_bruto || 0
      const valorLiquido = p.valor_liquido || p.premium_amount || 0
      const commissionPercent = p.commission_percent || p.commission || 0
      const commissionValue = (commissionPercent / 100) * valorLiquido

      rows.push([
        client.name || '',
        formatClientDocument(client),
        formatBirthDate(client.birth_date),
        client.phone || '',
        client.email || '',
        formatClientAddress(client),
        p.policy_number || p.policy_code?.toString() || '',
        p.expand?.seguradora?.nome || p.insurance_company || '',
        p.tipo_de_seguro || p.coverage_type || '',
        valorBruto,
        valorLiquido,
        commissionValue.toFixed(2),
      ])
    }
  }

  downloadCsv('carteira-clientes.csv', headers, rows)
}

export function exportPoliciesToCsv(policies: Policy[]) {
  const headers = [
    'Código',
    'Nº Apólice',
    'Seguradora',
    'Cliente',
    'Tipo de Seguro',
    'Placa',
    'Modelo do Veículo',
    'Forma de Pagamento',
    'Parcelas',
    'Valor Bruto',
    'Valor Líquido',
    'Comissão (%)',
    'Comissão (Valor)',
    'Status',
    'Data Início',
    'Data Fim',
    'Data Renovação',
  ]

  const rows: (string | number)[][] = policies.map((p) => {
    const valorBruto = p.valor_bruto || 0
    const valorLiquido = p.valor_liquido || p.premium_amount || 0
    const commissionPercent = p.commission_percent || p.commission || 0
    const commissionValue = (commissionPercent / 100) * valorLiquido

    return [
      p.policy_code?.toString() || '',
      p.policy_number || '',
      p.expand?.seguradora?.nome || p.insurance_company || '',
      p.expand?.client?.name || '',
      p.tipo_de_seguro || p.coverage_type || '',
      p.placa || '',
      p.modelo_veiculo || '',
      p.forma_pagamento || '',
      p.parcelas ? `${p.parcelas}x` : '',
      valorBruto,
      valorLiquido,
      commissionPercent,
      commissionValue.toFixed(2),
      p.status || '',
      p.start_date || '',
      p.end_date || '',
      p.renewal_date || '',
    ]
  })

  downloadCsv('apolices.csv', headers, rows)
}
