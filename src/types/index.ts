export interface User {
  id: string
  name?: string
  email: string
  role?: 'Admin' | 'Gerente' | 'Operador' | 'Visualizador'
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

export interface TipoSeguro {
  id: string
  nome: string
  ativo: boolean
  created: string
  updated: string
}

export interface Parceiro {
  id: string
  partner_code?: number
  nome: string
  cpf?: string
  tipo_documento?: 'CPF' | 'CNPJ'
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
  forma_pagamento?: 'Crédito' | 'Débito em conta' | 'Boleto' | string
  parcelas?: number
  forma_recebimento?:
    | 'Total definido'
    | 'Parcelada'
    | 'Recorrente'
    | 'Por esgotamento'
    | 'Outra / Manual'
    | string
  qtde_parcelas_esperadas?: number
  obs_forma_recebimento?: string
  placa?: string
  chassi?: string
  modelo_veiculo?: string
  start_date: string
  end_date: string
  renewal_date?: string
  status: 'Ativa' | 'Vencida' | 'Expirada' | 'Cancelada' | 'Renovação Pendente'
  commission?: number
  commission_percent?: number
  iss?: number
  tipo_de_venda?: 'Produção Própria' | 'Parceiro' | 'Indicação'
  observacao_indicacao?: string
  parceiro?: string
  percentual_repasse?: number
  valor_repasse?: number
  data_pagamento_parceiro?: string
  pago_parceiro?: boolean
  forma_pagamento_repasse?: string
  data_recebimento_comissao?: string
  comissao_recebida?: boolean
  data_cancelamento?: string
  motivo_cancelamento?: string
  notes?: string
  created: string
  updated: string
  previous_policy?: string
  modelo_comissao?: string
  comissao_personalizada?: boolean
  comissao_personalizada_config?: ModeloComissaoConfig & {
    tipo_modelo?: TipoModeloComissao
    percentual_padrao?: number
  }
  historico_alteracao_comissao?: ComissaoAlteracaoHistorico[]
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

export interface CustoFixo {
  id: string
  descricao: string
  valor: number
  data: string
  categoria:
    | 'Contador'
    | 'Impostos'
    | 'Energia'
    | 'Aluguel'
    | 'Telecomunicação'
    | 'Marketing'
    | 'Outros'
  observacoes?: string
  tipo?: 'Fixo' | 'Variável'
  pago?: boolean
  data_pagamento?: string
  forma_pagamento?: 'PIX' | 'Transferência' | 'Dinheiro' | 'Cartão' | 'Boleto' | 'Outro'
  recorrente?: boolean
  frequencia_recorrencia?: 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual'
  created: string
  updated: string
}

export interface EmailTemplate {
  id: string
  name: string
  key?: string
  subject: string
  body: string
  type: 'Aniversário' | 'Renovação' | 'Comercial' | 'Personalizado'
  is_system?: boolean
  created: string
  updated: string
}

export interface Conciliacao {
  id: string
  mes: number
  ano: number
  data_fechamento?: string
  usuario_fechamento?: string
  usuario_id?: string
  resumo?: string
  pendencias?: string
  observacoes?: string
  created: string
  updated: string
}

export type TipoModeloComissao =
  | 'A_VISTA'
  | 'PARCELADA'
  | 'RECORRENTE'
  | 'POR_FASES'
  | 'POR_ESGOTAMENTO'

export interface FaseModelo {
  id?: string
  mes_inicio: number
  mes_fim?: number | null // null indica "em diante"
  percentual: number // % sobre prêmio líquido ou % do comissionamento
}

export interface ParcelaModelo {
  numero: number
  percentual?: number // % da comissão ou % sobre prêmio líquido
  valor_fixo?: number
}

export interface ModeloComissaoConfig {
  // Para PARCELADA:
  quantidade_competencias?: number
  parcelas?: ParcelaModelo[] // pode ter percentuais diferentes por competência

  // Para RECORRENTE:
  recorrencia_meses_horizonte?: number // padrão 12 meses
  percentual_recorrente?: number

  // Para POR_FASES:
  fases?: FaseModelo[]

  // Para POR_ESGOTAMENTO:
  saldo_total?: number // ou comissão total definida
  valor_estimado_parcela?: number
}

export interface ModeloComissao {
  id: string
  nome: string
  tipo_modelo: TipoModeloComissao
  seguradora?: string
  tipo_seguro?: string
  percentual_padrao?: number
  config_json?: ModeloComissaoConfig
  valido_a_partir_de?: string
  versao?: number
  ativo?: boolean
  descricao?: string
  created: string
  updated: string
  expand?: {
    seguradora?: Seguradora
  }
}

export interface ComissaoPrevista {
  id: string
  policy: string
  competencia: string // Ex: "08/2026"
  data_prevista: string // YYYY-MM-DD
  valor_previsto: number
  parcela_numero?: number
  origem_modelo?: string
  status: 'Pendente' | 'Parcial' | 'Recebida' | 'Cancelada'
  observacao?: string
  created: string
  updated: string
  expand?: {
    policy?: Policy
  }
}

export interface ComissaoAlteracaoHistorico {
  data: string
  usuario: string
  motivo: string
  alteracao: string
  detalhes?: any
}

export interface ComissaoRecebimento {
  id: string
  policy: string
  expand?: {
    policy?: Policy & {
      expand?: {
        client?: Client
        seguradora?: Seguradora
        parceiro?: Parceiro
      }
    }
    recebimento_original?: ComissaoRecebimento
    comissao_prevista?: ComissaoPrevista
  }
  data_recebimento: string
  valor_bruto: number
  descontos_impostos?: number
  valor_liquido: number
  aliquota_imposto?: number
  origem: string
  observacao?: string
  parcela?: number
  competencia?: string
  idempotency_key?: string
  is_estorno?: boolean
  recebimento_original?: string
  motivo_estorno?: string
  comissao_prevista?: string
  created: string
  updated: string
}

export interface ParceiroDebitoItem {
  id?: string
  descricao: string
  valor: number
  data?: string
}

export interface ParceiroDebito {
  id: string
  parceiro: string
  descricao: string
  valor: number
  data?: string
  status?: 'Pendente' | 'Pago' | 'Cancelado'
  pagamento?: string
  created: string
  updated: string
}

export interface ParceiroPagamento {
  id: string
  parceiro: string
  data_pagamento: string
  total_comissoes: number
  total_debitos: number
  taxa_pix: number
  valor_liquido: number
  policies_ids?: string
  detalhes_debitos?: string // JSON stringified array of ParceiroDebitoItem
  observacoes?: string
  usuario_id?: string
  usuario_nome?: string
  created: string
  updated: string
  expand?: {
    parceiro?: Parceiro
  }
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
