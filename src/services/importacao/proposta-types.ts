/**
 * Tipos canônicos de extração de Proposta de Seguradora a partir do texto/PDF.
 * Segurado e Condutor Principal são campos separados.
 */

export type SeguradoraPropostaFormato =
  | 'PORTO_SEGURO'
  | 'ALLIANZ'
  | 'HDI'
  | 'YELUM'
  | 'MAPFRE'
  | 'BRADESCO'
  | 'GENERICA'

export interface PropostaClienteExtraido {
  nome: string
  cpfCnpj: string
  tipoPessoa: 'PF' | 'PJ'
  dataNascimento?: string // YYYY-MM-DD (Allianz não traz data de nascimento)
  email?: string
  telefone?: string
  cep?: string
  rua?: string
  numero?: string
  bairro?: string
  cidade?: string
  estado?: string
}

export interface PropostaCondutorExtraido {
  nome: string
  cpf?: string
  dataNascimento?: string
  parentesco?: string
  mesmoQueSegurado: boolean
}

export interface PropostaVeiculoExtraido {
  marcaModelo: string
  placa: string
  chassi: string
  codigoFipe?: string
  anoFabricacao?: number
  anoModelo?: number
}

export interface PropostaRenovacaoExtraida {
  isRenovacao: boolean
  apoliceAnterior?: string
  seguradoraAnterior?: string
  classeBonus?: string
}

export interface PropostaExtraida {
  formato: SeguradoraPropostaFormato
  seguradoraNome: string
  numeroProposta: string
  numeroApolice: string // quase sempre vazia no momento da proposta ("-")
  tipoSeguro: string // Auto, Residencial, etc.
  vigenciaInicio: string // YYYY-MM-DD
  vigenciaFim: string // YYYY-MM-DD
  premioLiquido: number
  iof: number
  premioTotal: number
  formaPagamento?: string // Crédito, Boleto, Débito em conta
  quantidadeParcelas?: number // Atenção: Yelum usa "1+11" -> 12 parcelas
  parcelamentoDescricao?: string
  percentualComissao?: number
  segurado: PropostaClienteExtraido
  condutorPrincipal: PropostaCondutorExtraido
  veiculo: PropostaVeiculoExtraido
  renovacao: PropostaRenovacaoExtraida
  camposFaltantes: Array<{
    campo: string
    label: string
    motivo: string
  }>
  textoBrutoOriginal?: string
}
