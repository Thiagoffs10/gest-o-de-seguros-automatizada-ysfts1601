import { downloadMultiSheetXlsx, ExcelSheet, ExcelColumn } from '@/lib/excel-export'
import { BackupData } from '@/services/backup'
import { formatDateDisplay } from '@/lib/utils'

const COLLECTION_TITLES: Record<string, string> = {
  users: 'Usuários',
  clients: 'Clientes',
  policies: 'Apólices',
  payments: 'Pagamentos',
  reminders: 'Lembretes',
  communications: 'Comunicações',
  seguradoras: 'Seguradoras',
  parceiros: 'Parceiros',
  custos_fixos: 'Custos Fixos',
  tipos_seguro: 'Tipos de Seguro',
  conciliacoes: 'Conciliações',
}

const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  name: 'Nome',
  nome: 'Nome',
  email: 'E-mail',
  role: 'Perfil / Função',
  phone: 'Telefone',
  telefone: 'Telefone',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  tipo_pessoa: 'Tipo de Pessoa',
  client_code: 'Código do Cliente',
  partner_code: 'Código do Parceiro',
  policy_code: 'Código da Apólice',
  address: 'Endereço Completo',
  cep: 'CEP',
  rua: 'Logradouro / Rua',
  numero: 'Número',
  bairro: 'Bairro',
  cidade: 'Cidade',
  estado: 'UF / Estado',
  birth_date: 'Data de Nascimento',
  policy_number: 'Nº da Apólice',
  coverage_type: 'Ramo / Cobertura',
  tipo_de_seguro: 'Tipo de Seguro',
  insurance_company: 'Seguradora (Texto)',
  seguradora: 'ID Seguradora',
  client: 'ID Cliente',
  parceiro: 'ID Parceiro',
  premium_amount: 'Prêmio / Líquido',
  valor_bruto: 'Valor Bruto (R$)',
  valor_liquido: 'Valor Líquido (R$)',
  commission_percent: 'Comissão (%)',
  commission: 'Valor Comissão (R$)',
  iss: 'ISS (R$)',
  percentual_repasse: 'Percentual Repasse (%)',
  valor_repasse: 'Valor Repasse (R$)',
  forma_pagamento_repasse: 'Forma Pagto Repasse',
  pago_parceiro: 'Repasse Pago?',
  data_pagamento_parceiro: 'Data Pagto Repasse',
  comissao_recebida: 'Comissão Recebida?',
  data_recebimento_comissao: 'Data Receb. Comissão',
  tipo_de_venda: 'Tipo de Venda',
  observacao_indicacao: 'Obs. Indicação',
  start_date: 'Início Vigência',
  end_date: 'Fim Vigência',
  renewal_date: 'Data Renovação',
  status: 'Status',
  placa: 'Placa Veículo',
  chassi: 'Chassi Veículo',
  modelo_veiculo: 'Modelo Veículo',
  data_cancelamento: 'Data Cancelamento',
  motivo_cancelamento: 'Motivo Cancelamento',
  notes: 'Observações',
  observacoes: 'Observações',
  amount: 'Valor (R$)',
  due_date: 'Data Vencimento',
  paid_date: 'Data Pagamento',
  payment_method: 'Forma de Pagamento',
  type: 'Tipo',
  date: 'Data Programada',
  message: 'Mensagem',
  sent: 'Concluído / Enviado?',
  subject: 'Assunto',
  body: 'Mensagem / Corpo',
  recipient_email: 'E-mail Destinatário',
  recipient_phone: 'Telefone Destinatário',
  sent_date: 'Data Envio',
  imposto_percentual: 'Imposto (%)',
  dados_bancarios_ou_pix: 'Dados Bancários / PIX',
  tipo_documento: 'Tipo Documento',
  descricao: 'Descrição',
  valor: 'Valor (R$)',
  categoria: 'Categoria',
  data: 'Data',
  data_pagamento: 'Data Pagamento',
  pago: 'Pago?',
  forma_pagamento: 'Forma de Pagamento',
  parcelas: 'Em quantas vezes (Parcelas)',
  recorrente: 'Recorrente?',
  frequencia_recorrencia: 'Frequência',
  ativo: 'Ativo?',
  mes: 'Mês',
  ano: 'Ano',
  data_fechamento: 'Data Fechamento',
  usuario_fechamento: 'Usuário Fechamento',
  resumo: 'Resumo',
  pendencias: 'Pendências',
  created: 'Criado em',
  updated: 'Atualizado em',
}

const CURRENCY_FIELDS = new Set([
  'valor_bruto',
  'valor_liquido',
  'premium_amount',
  'commission',
  'valor_repasse',
  'iss',
  'amount',
  'valor',
])

const PERCENT_FIELDS = new Set(['commission_percent', 'percentual_repasse', 'imposto_percentual'])

const DATE_FIELDS = new Set([
  'start_date',
  'end_date',
  'renewal_date',
  'data_cancelamento',
  'data_pagamento_parceiro',
  'data_recebimento_comissao',
  'due_date',
  'paid_date',
  'date',
  'sent_date',
  'data',
  'data_pagamento',
  'data_fechamento',
  'birth_date',
])

export function exportBackupToExcel(data: BackupData, filename: string): void {
  const sheets: ExcelSheet[] = []

  // 1. Aba Resumo
  const summaryColumns: ExcelColumn[] = [
    { header: 'Módulo / Tabela', type: 'text' },
    { header: 'Identificador Interno', type: 'text' },
    { header: 'Total de Registros', type: 'number' },
  ]
  const summaryRows: (string | number)[][] = []

  const colNames = Object.keys(data.records)
  for (const colName of colNames) {
    const list = data.records[colName] || []
    summaryRows.push([COLLECTION_TITLES[colName] || colName, colName, list.length])
  }
  sheets.push({
    name: 'Resumo do Backup',
    columns: summaryColumns,
    rows: summaryRows,
  })

  // 2. Abas individuais por coleção
  for (const colName of colNames) {
    const records = data.records[colName] || []
    const schema = data.schema[colName]

    // Definir ordem de colunas a partir do schema + campos comuns
    const fieldNames: string[] = ['id']
    if (schema?.fields) {
      for (const f of schema.fields) {
        if (f.name && !fieldNames.includes(f.name) && f.name !== 'id') {
          fieldNames.push(f.name)
        }
      }
    }
    // Adicionar outros campos que apareçam nos registros
    for (const r of records) {
      for (const k of Object.keys(r)) {
        if (!fieldNames.includes(k) && k !== 'passwordHash' && k !== 'tokenKey') {
          fieldNames.push(k)
        }
      }
    }

    const columns: ExcelColumn[] = fieldNames.map((fn) => {
      let type: ExcelColumn['type'] = 'text'
      if (CURRENCY_FIELDS.has(fn)) type = 'currency'
      else if (PERCENT_FIELDS.has(fn)) type = 'percent'
      else if (DATE_FIELDS.has(fn))
        type = 'text' // Usamos formatação visual de data
      else if (fn.endsWith('_code') || fn === 'mes' || fn === 'ano' || fn === 'parcelas')
        type = 'number'

      return {
        header: FIELD_LABELS[fn] || fn,
        type,
      }
    })

    const rows = records.map((rec) => {
      return fieldNames.map((fn) => {
        const val = rec[fn]
        if (val === null || val === undefined || val === '') return ''

        // Arquivo
        if (typeof val === 'object' && val !== null && 'filename' in val) {
          return String((val as any).filename || '')
        }

        // Booleano
        if (typeof val === 'boolean') {
          return val ? 'Sim' : 'Não'
        }

        // Data
        if (DATE_FIELDS.has(fn) && typeof val === 'string' && val.trim()) {
          return formatDateDisplay(val) || val
        }

        // Moeda / Percentual / Número
        if (CURRENCY_FIELDS.has(fn) || PERCENT_FIELDS.has(fn)) {
          const num = Number(val)
          return isNaN(num) ? 0 : num
        }

        if (typeof val === 'object') {
          return JSON.stringify(val)
        }

        return String(val)
      })
    })

    const title = (COLLECTION_TITLES[colName] || colName).substring(0, 31)
    sheets.push({
      name: title,
      columns,
      rows,
    })
  }

  downloadMultiSheetXlsx(filename, sheets)
}
