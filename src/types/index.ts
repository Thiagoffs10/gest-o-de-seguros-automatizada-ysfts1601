export interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  birth_date?: string
  notes?: string
  created: string
  updated: string
}

export interface Policy {
  id: string
  client: string
  expand?: { client?: Client }
  insurance_company?: string
  policy_number: string
  coverage_type: 'Auto' | 'Vida' | 'Residencial' | 'Empresarial' | 'Saúde' | 'Outros'
  premium_amount: number
  start_date: string
  end_date: string
  renewal_date?: string
  status: 'Ativa' | 'Expirada' | 'Cancelada' | 'Renovação Pendente'
  commission?: number
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
