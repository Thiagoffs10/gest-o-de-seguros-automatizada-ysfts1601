import { downloadMultiSheetXlsx, ExcelSheet, ExcelColumn } from '@/lib/excel-export'
import { BackupData } from '@/services/backup'
import { formatDateDisplay } from '@/lib/utils'
import { maskDocument, formatClientDocument } from '@/lib/document-validators'

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
  parceiro_pagamentos: 'Pagamentos Parceiros',
  parceiro_debitos: 'Débitos Parceiros',
}

const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  client_name: 'Nome do Cliente',
  client_cpf: 'CPF / CNPJ do Cliente',
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
  seguradora: 'Seguradora',
  client: 'Cliente',
  parceiro: 'Parceiro',
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
  total_comissoes: 'Total Comissões (R$)',
  total_debitos: 'Total Débitos (R$)',
  taxa_pix: 'Taxa PIX (R$)',
  policies_ids: 'IDs das Apólices',
  detalhes_debitos: 'Detalhes dos Débitos',
  usuario_nome: 'Nome do Usuário',
  usuario_id: 'Usuário',
  pagamento: 'ID Pagamento',
  previous_policy: 'Apólice Anterior',
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

  // 1. Mapeamento auxiliar de entidades para substituir IDs técnicos por Nomes/Valores legíveis
  const clientsMap = new Map<string, { name: string; cpf: string }>()
  const seguradorasMap = new Map<string, string>()
  const parceirosMap = new Map<string, string>()
  const usersMap = new Map<string, string>()
  const policiesMap = new Map<string, { number: string; clientId: string }>()

  const rawClients = data.records['clients'] || []
  for (const c of rawClients) {
    if (c.id && typeof c.id === 'string') {
      const doc =
        formatClientDocument({
          tipo_pessoa: c.tipo_pessoa ? String(c.tipo_pessoa) : undefined,
          cpf: c.cpf ? String(c.cpf) : undefined,
          cnpj: c.cnpj ? String(c.cnpj) : undefined,
        }) || (c.cpf ? maskDocument(String(c.cpf)) : c.cnpj ? maskDocument(String(c.cnpj)) : '')

      clientsMap.set(c.id, {
        name: (c.name ? String(c.name) : c.nome ? String(c.nome) : '') || 'Cliente sem nome',
        cpf: doc || '—',
      })
    }
  }
  const rawSeguradoras = data.records['seguradoras'] || []
  for (const s of rawSeguradoras) {
    if (s.id && typeof s.id === 'string') {
      seguradorasMap.set(
        s.id,
        (s.nome ? String(s.nome) : '') || (s.name ? String(s.name) : '') || s.id,
      )
    }
  }

  const rawParceiros = data.records['parceiros'] || []
  for (const p of rawParceiros) {
    if (p.id && typeof p.id === 'string') {
      parceirosMap.set(
        p.id,
        (p.nome ? String(p.nome) : '') || (p.name ? String(p.name) : '') || p.id,
      )
    }
  }

  const rawUsers = data.records['users'] || []
  for (const u of rawUsers) {
    if (u.id && typeof u.id === 'string') {
      usersMap.set(u.id, (u.name ? String(u.name) : '') || (u.email ? String(u.email) : '') || u.id)
    }
  }

  const rawPolicies = data.records['policies'] || []
  for (const pol of rawPolicies) {
    if (pol.id && typeof pol.id === 'string') {
      policiesMap.set(pol.id, {
        number: pol.policy_number ? String(pol.policy_number) : pol.id,
        clientId: pol.client ? String(pol.client) : '',
      })
    }
  }

  // 2. Aba Resumo
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

  // 3. Abas individuais por coleção
  for (const colName of colNames) {
    const records = data.records[colName] || []
    const schema = data.schema[colName]

    // Definir ordem de colunas a partir do schema + campos comuns
    const rawFieldNames: string[] = []
    if (schema?.fields) {
      for (const f of schema.fields) {
        if (
          f.name &&
          !rawFieldNames.includes(f.name) &&
          f.name !== 'passwordHash' &&
          f.name !== 'tokenKey'
        ) {
          rawFieldNames.push(f.name)
        }
      }
    }
    for (const r of records) {
      for (const k of Object.keys(r)) {
        if (!rawFieldNames.includes(k) && k !== 'passwordHash' && k !== 'tokenKey') {
          rawFieldNames.push(k)
        }
      }
    }

    // Regra OBRIGATÓRIA: Em toda linha de informações, garantir a exibição clara de Nome e CPF/CNPJ do Cliente
    const fieldNames: string[] = []

    if (colName === 'clients') {
      // Para clients, colocar nome e cpf logo no início
      if (rawFieldNames.includes('name')) fieldNames.push('name')
      else if (rawFieldNames.includes('nome')) fieldNames.push('nome')
      if (rawFieldNames.includes('cpf')) fieldNames.push('cpf')
      if (rawFieldNames.includes('cnpj')) fieldNames.push('cnpj')

      for (const fn of rawFieldNames) {
        if (!fieldNames.includes(fn)) fieldNames.push(fn)
      }
    } else {
      // Inserir colunas virtuais 'client_name' e 'client_cpf' nas primeiras posições de todas as coleções
      fieldNames.push('client_name')
      fieldNames.push('client_cpf')

      for (const fn of rawFieldNames) {
        if (!fieldNames.includes(fn)) {
          fieldNames.push(fn)
        }
      }
    }

    const columns: ExcelColumn[] = fieldNames.map((fn) => {
      let type: ExcelColumn['type'] = 'text'
      if (CURRENCY_FIELDS.has(fn)) type = 'currency'
      else if (PERCENT_FIELDS.has(fn)) type = 'percent'
      else if (DATE_FIELDS.has(fn))
        type = 'text' // Usamos formatação visual DD/MM/YYYY
      else if (fn.endsWith('_code') || fn === 'mes' || fn === 'ano' || fn === 'parcelas')
        type = 'number'

      return {
        header: FIELD_LABELS[fn] || fn,
        type,
      }
    })

    const rows = records.map((rec) => {
      // Resolver cliente para a linha atual
      let lineClientId = ''
      if (colName === 'clients') {
        lineClientId = String(rec.id || '')
      } else if (rec.client && typeof rec.client === 'string') {
        lineClientId = rec.client
      } else if (rec.policy && typeof rec.policy === 'string') {
        const polInfo = policiesMap.get(rec.policy)
        if (polInfo?.clientId) lineClientId = polInfo.clientId
      }

      const clientInfo = lineClientId ? clientsMap.get(lineClientId) : undefined

      return fieldNames.map((fn) => {
        // Colunas virtuais do cliente
        if (fn === 'client_name') {
          return clientInfo?.name || '—'
        }
        if (fn === 'client_cpf') {
          return clientInfo?.cpf || '—'
        }

        const val = rec[fn]

        // Substituição inteligente de relações/IDs técnicos
        if (fn === 'client' && typeof val === 'string' && val.trim()) {
          const c = clientsMap.get(val)
          return c ? `${c.name} (${c.cpf || 'Sem doc'})` : val
        }
        if (fn === 'policy' && typeof val === 'string' && val.trim()) {
          const p = policiesMap.get(val)
          return p ? `Apólice Nº ${p.number}` : val
        }
        if (fn === 'seguradora' && typeof val === 'string' && val.trim()) {
          return seguradorasMap.get(val) || val
        }
        if (fn === 'parceiro' && typeof val === 'string' && val.trim()) {
          return parceirosMap.get(val) || val
        }
        if ((fn === 'usuario_id' || fn === 'user') && typeof val === 'string' && val.trim()) {
          return usersMap.get(val) || val
        }
        if (fn === 'previous_policy' && typeof val === 'string' && val.trim()) {
          const p = policiesMap.get(val)
          return p ? `Apólice Nº ${p.number}` : val
        }

        if (val === null || val === undefined || val === '') return ''

        // Formatação de CPF / CNPJ na tabela de clientes
        if ((fn === 'cpf' || fn === 'cnpj') && typeof val === 'string' && val.trim()) {
          return maskDocument(val)
        }

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
