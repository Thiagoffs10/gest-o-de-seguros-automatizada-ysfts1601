export interface User {
  id: string
  name?: string
  email: string
  role?: 'admin' | 'user'
  created: string
  updated: string
}

export interface Client {
  id: string
  client_code?: number
  name: string
  cpf?: string
  cnpj?: string
  tipo_pessoa?: 'PF' | 'PJ'
  email?: string
  phone?: string
  cep?: string
  rua?: string
  numero?: string
  bairro?: string
  cidade?: string
  estado?: string
  address?: string
  birth_date?: string
  notes?: string
  created: string
  updated: string
}

export interface Seguradora {
  id: string
  nome: string
  imposto_percentual?: number
  created: string
  updated: string
}

export interface Parceiro {
  id: string
  partner_code?: number
  nome: string
  cpf?: string
  telefone?: string
  email?: string
  dados_bancarios_ou_pix?: string
  created: string
  updated: string
}

export interface Policy {
  id: string
  policy_code?: number
  client: string
  expand?: {
    client?: Client
    seguradora?: Seguradora
    parceiro?: Parceiro
  }
  seguradora?: string
  insurance_company?: string
  policy_number: string
  tipo_de_seguro?: string
  coverage_type?: 'Auto' | 'Vida' | 'Residencial' | 'Empresarial' | 'Saúde' | 'Outros'
  premium_amount: number
  valor_bruto?: number
  valor_liquido?: number
  placa?: string
  modelo_veiculo?: string
  start_date: string
  end_date: string
  renewal_date?: string
  status: 'Ativa' | 'Expirada' | 'Cancelada' | 'Renovação Pendente'
  commission?: number
  commission_percent?: number
  tipo_de_venda?: 'Produção Própria' | 'Parceiro' | 'Indicação'
  observacao_indicacao?: string
  parceiro?: string
  valor_repasse?: number
  data_pagamento_parceiro?: string
  pago_parceiro?: boolean
  data_recebimento_comissao?: string
  comissao_recebida?: boolean
  notes?: string
  created: string
  updated: string
}

export interface Payment {
  id: string
  policy: string
  expand?: { policy?: Policy & { expand?: { client?: Client } } }
  amount: number
  due_date: string
  paid_date?: string
  status: 'Pendente' | 'Pago' | 'Atrasado'
  payment_method?: 'Boleto' | 'Cartão' | 'Transferência' | 'Dinheiro' | 'Outros'
  notes?: string
  created: string
  updated: string
}

export interface Reminder {
  id: string
  type: 'Renovação' | 'Aniversário' | 'Customizado'
  client?: string
  policy?: string
  expand?: { client?: Client; policy?: Policy }
  date: string
  message?: string
  sent: boolean
  created: string
  updated: string
}

export interface Communication {
  id: string
  type: 'Email' | 'WhatsApp'
  client?: string
  expand?: { client?: Client }
  subject?: string
  body?: string
  recipient_email?: string
  recipient_phone?: string
  status: 'Rascunho' | 'Enviado' | 'Falhou'
  sent_date?: string
  created: string
  updated: string
}

export interface FilterState {
  year?: string
  month?: string
  dateFrom?: string
  dateTo?: string
  partnerId?: string
  seguradoraId?: string
  tipoSeguro?: string
}
