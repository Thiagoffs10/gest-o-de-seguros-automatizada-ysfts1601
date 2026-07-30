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

export function exportPoliciesToCsv(policies: Policy[]) {
  const sorted = [...policies].sort((a, b) => {
    const codeA = a.expand?.client?.client_code || 0
    const codeB = b.expand?.client?.client_code || 0
    return codeA - codeB
  })

  const headers = [
    'Código do Cliente',
    'Nome do Cliente',
    'CPF',
    'Código da Apólice',
    'Nº Apólice Seguradora',
    'Seguradora',
    'Tipo de Seguro',
    'Placa',
    'Modelo do Veículo',
    'Valor Bruto',
    'Valor Líquido',
    'Comissão (%)',
    'Valor da Comissão',
    'Dedução de Imposto',
    'Comissão Líquida',
    'Tipo de Venda',
    'Parceiro',
    'Valor Repasse (%)',
    'Data de Recebimento',
  ]

  const rows = sorted.map((p) => {
    const valorLiquido = p.valor_liquido || p.premium_amount || 0
    const commissionPercent = p.commission_percent || p.commission || 0
    const commissionValue = (commissionPercent / 100) * valorLiquido
    const impostoPercent = p.expand?.seguradora?.imposto_percentual || 0
    const taxDeduction = (impostoPercent / 100) * commissionValue
    const netCommission = commissionValue - taxDeduction

    return [
      p.expand?.client?.client_code || '',
      p.expand?.client?.name || '',
      p.expand?.client?.cpf || '',
      p.policy_code || '',
      p.policy_number || '',
      p.expand?.seguradora?.nome || p.insurance_company || '',
      p.tipo_de_seguro || p.coverage_type || '',
      p.placa || '',
      p.modelo_veiculo || '',
      p.valor_bruto || 0,
      valorLiquido,
      commissionPercent,
      commissionValue.toFixed(2),
      taxDeduction.toFixed(2),
      netCommission.toFixed(2),
      p.tipo_de_venda || '',
      p.expand?.parceiro?.nome || '',
      p.valor_repasse || 0,
      p.data_recebimento_comissao
        ? new Date(p.data_recebimento_comissao).toLocaleDateString('pt-BR')
        : '',
    ]
  })

  downloadCsv('carteira-seguros.csv', headers, rows)
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
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
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
