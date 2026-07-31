import { Policy, Client } from '@/types'
import { extractDatePart } from '@/lib/date-filter'
import { downloadXlsx, ExcelColumn } from '@/lib/excel-export'

function fmtDate(dateStr?: string): string {
  if (!dateStr) return ''
  const d = extractDatePart(dateStr)
  if (!d || !d.includes('-')) return ''
  return d.split('-').reverse().join('/')
}

function fmtDoc(client?: Client): string {
  if (!client) return ''
  return client.tipo_pessoa === 'PJ' ? client.cnpj || '' : client.cpf || ''
}

function daysUntil(dateStr?: string): number {
  if (!dateStr) return 0
  const d = new Date(extractDatePart(dateStr))
  if (isNaN(d.getTime())) return 0
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000)
  return diff > 0 ? diff : 0
}

const POLICY_COLUMNS: ExcelColumn[] = [
  { header: 'Código do cliente', type: 'text' },
  { header: 'Nome/Razão Social', type: 'text' },
  { header: 'Tipo de pessoa', type: 'text' },
  { header: 'CPF/CNPJ', type: 'text' },
  { header: 'Data de nascimento', type: 'text' },
  { header: 'Telefone/WhatsApp', type: 'text' },
  { header: 'E-mail', type: 'text' },
  { header: 'CEP', type: 'text' },
  { header: 'Endereço', type: 'text' },
  { header: 'Número', type: 'text' },
  { header: 'Bairro', type: 'text' },
  { header: 'Cidade', type: 'text' },
  { header: 'Estado', type: 'text' },
  { header: 'Código da apólice', type: 'text' },
  { header: 'Número da apólice', type: 'text' },
  { header: 'Seguradora', type: 'text' },
  { header: 'Tipo de seguro', type: 'text' },
  { header: 'Status da apólice', type: 'text' },
  { header: 'Data inicial da vigência', type: 'text' },
  { header: 'Data final da vigência', type: 'text' },
  { header: 'Dias restantes para o vencimento', type: 'number' },
  { header: 'Apólice anterior', type: 'text' },
  { header: 'Status da renovação', type: 'text' },
  { header: 'Placa', type: 'text' },
  { header: 'Chassi', type: 'text' },
  { header: 'Modelo do veículo', type: 'text' },
  { header: 'Valor bruto', type: 'currency' },
  { header: 'Valor líquido', type: 'currency' },
  { header: 'Percentual de comissão', type: 'percent' },
  { header: 'Comissão bruta', type: 'currency' },
  { header: 'ISS', type: 'currency' },
  { header: 'Comissão líquida', type: 'currency' },
  { header: 'Comissão recebida', type: 'text' },
  { header: 'Data do recebimento', type: 'text' },
  { header: 'Tipo de venda', type: 'text' },
  { header: 'Código do parceiro', type: 'text' },
  { header: 'Nome do parceiro', type: 'text' },
  { header: 'Percentual de repasse', type: 'percent' },
  { header: 'Valor do repasse', type: 'currency' },
  { header: 'Repasse pago', type: 'text' },
  { header: 'Data de pagamento do repasse', type: 'text' },
  { header: 'Data de cadastro', type: 'text' },
  { header: 'Data da última alteração', type: 'text' },
  { header: 'Responsável pelo cadastro', type: 'text' },
  { header: 'Observações', type: 'text' },
]

export function exportPoliciesToXlsx(policies: Policy[]): void {
  const rows = policies.map((p) => {
    const c = p.expand?.client
    const par = p.expand?.parceiro
    const netComm = (p.commission || 0) - (p.iss || 0)
    return [
      c?.client_code || '',
      c?.name || '',
      c?.tipo_pessoa || 'PF',
      fmtDoc(c),
      fmtDate(c?.birth_date),
      c?.phone || '',
      c?.email || '',
      c?.cep || '',
      c?.rua || '',
      c?.numero || '',
      c?.bairro || '',
      c?.cidade || '',
      c?.estado || '',
      p.policy_code || '',
      p.policy_number || '',
      p.expand?.seguradora?.nome || p.insurance_company || '',
      p.tipo_de_seguro || p.coverage_type || '',
      p.status || '',
      fmtDate(p.start_date),
      fmtDate(p.end_date),
      daysUntil(p.end_date),
      p.previous_policy || '',
      p.status === 'Renovação Pendente' ? 'Pendente' : 'Não',
      p.placa || '',
      p.chassi || '',
      p.modelo_veiculo || '',
      p.valor_bruto || 0,
      p.valor_liquido || p.premium_amount || 0,
      p.commission_percent || 0,
      p.commission || 0,
      p.iss || 0,
      netComm,
      p.comissao_recebida ? 'Sim' : 'Não',
      fmtDate(p.data_recebimento_comissao),
      p.tipo_de_venda || '',
      par?.partner_code || '',
      par?.nome || '',
      p.percentual_repasse || 0,
      p.valor_repasse || 0,
      p.pago_parceiro ? 'Sim' : 'Não',
      fmtDate(p.data_pagamento_parceiro),
      fmtDate(p.created),
      fmtDate(p.updated),
      '',
      p.notes || '',
    ]
  })

  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const filename = `CRED10MIX_Carteira_Apolices_${dd}-${mm}-${now.getFullYear()}.xlsx`

  downloadXlsx(filename, 'Carteira de Apólices', POLICY_COLUMNS, rows)
}
