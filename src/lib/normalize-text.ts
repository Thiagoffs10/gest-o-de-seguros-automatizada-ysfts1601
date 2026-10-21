/**
 * Utilitário central de normalização para letras MAIÚSCULAS no sistema.
 *
 * Regra do usuário: "ao importar as propostas e cadastro do cliente, quero que tudo fique em letras
 * maiusculas quando jogado para o sistema. Não quero ter a possibilidade de alguns cadastros estarem
 * com letras maiúsculas e outras minúsculas, quero sempre tudo em letra maiúscula, independente da forma de cadastro."
 *
 * Preserva acentuação em português ("pt-BR").
 * Campos que NÃO devem ser forçados a maiúsculas:
 * - e-mail (lowercase é padrão mundial)
 * - senhas / credenciais
 * - URLs
 * - valores numéricos / booleanos / datas no formato ISO YYYY-MM-DD
 */

/**
 * Converte uma string para maiúsculas no padrão pt-BR preservando acentos
 */
export function toUpperPT(val?: string | null): string {
  if (val == null) return ''
  const str = String(val)
  return str.toLocaleUpperCase('pt-BR')
}

/**
 * Converte para maiúsculas e remove espaços extras nas pontas
 */
export function toUpperTrim(val?: string | null): string {
  if (val == null) return ''
  return String(val).trim().toLocaleUpperCase('pt-BR')
}

/**
 * Normaliza e-mail (sempre minúsculas e sem espaços)
 */
export function normalizeEmail(val?: string | null): string {
  if (val == null) return ''
  return String(val).trim().toLowerCase()
}

/**
 * Normaliza campos cadastrais de Cliente para letras maiúsculas.
 * E-mail permanece em minúsculas.
 */
export function normalizeClientPayload<T extends Record<string, any>>(data: T): T {
  const result: any = { ...data }

  if (typeof result.name === 'string') {
    result.name = toUpperTrim(result.name)
  }
  if (typeof result.rua === 'string') {
    result.rua = toUpperTrim(result.rua)
  }
  if (typeof result.numero === 'string') {
    result.numero = toUpperTrim(result.numero)
  }
  if (typeof result.bairro === 'string') {
    result.bairro = toUpperTrim(result.bairro)
  }
  if (typeof result.cidade === 'string') {
    result.cidade = toUpperTrim(result.cidade)
  }
  if (typeof result.estado === 'string') {
    result.estado = toUpperTrim(result.estado)
  }
  if (typeof result.notes === 'string') {
    result.notes = toUpperPT(result.notes)
  }
  if (typeof result.email === 'string') {
    result.email = normalizeEmail(result.email)
  }

  return result
}

/**
 * Normaliza campos cadastrais de Apólice para letras maiúsculas.
 */
export function normalizePolicyPayload<T extends Record<string, any>>(data: T): T {
  const result: any = { ...data }

  if (typeof result.policy_number === 'string') {
    result.policy_number = toUpperTrim(result.policy_number)
  }
  if (typeof result.numero_proposta === 'string') {
    result.numero_proposta = toUpperTrim(result.numero_proposta)
  }
  if (typeof result.placa === 'string') {
    result.placa = toUpperTrim(result.placa)
  }
  if (typeof result.chassi === 'string') {
    result.chassi = toUpperTrim(result.chassi)
  }
  if (typeof result.modelo_veiculo === 'string') {
    result.modelo_veiculo = toUpperTrim(result.modelo_veiculo)
  }
  if (typeof result.notes === 'string') {
    result.notes = toUpperPT(result.notes)
  }
  if (typeof result.observacoes === 'string') {
    result.observacoes = toUpperPT(result.observacoes)
  }
  if (typeof result.observacao_indicacao === 'string') {
    result.observacao_indicacao = toUpperTrim(result.observacao_indicacao)
  }
  if (typeof result.motivo_cancelamento === 'string') {
    result.motivo_cancelamento = toUpperPT(result.motivo_cancelamento)
  }
  if (typeof result.motivo_personalizacao === 'string') {
    result.motivo_personalizacao = toUpperTrim(result.motivo_personalizacao)
  }
  if (typeof result.obs_forma_recebimento === 'string') {
    result.obs_forma_recebimento = toUpperPT(result.obs_forma_recebimento)
  }

  return result
}

/**
 * Normaliza campos de Endosso para letras maiúsculas.
 */
export function normalizeEndorsementPayload<T extends Record<string, any>>(data: T): T {
  const result: any = { ...data }

  if (typeof result.numero_proposta === 'string') {
    result.numero_proposta = toUpperTrim(result.numero_proposta)
  }
  if (typeof result.placa === 'string') {
    result.placa = toUpperTrim(result.placa)
  }
  if (typeof result.chassi === 'string') {
    result.chassi = toUpperTrim(result.chassi)
  }
  if (typeof result.modelo_veiculo === 'string') {
    result.modelo_veiculo = toUpperTrim(result.modelo_veiculo)
  }
  if (typeof result.observacao === 'string') {
    result.observacao = toUpperPT(result.observacao)
  }

  return result
}

/**
 * Normaliza campos de Parceiro para letras maiúsculas.
 * E-mail permanece em minúsculas.
 */
export function normalizeParceiroPayload<T extends Record<string, any>>(data: T): T {
  const result: any = { ...data }

  if (typeof result.nome === 'string') {
    result.nome = toUpperTrim(result.nome)
  }
  if (typeof result.dados_bancarios_ou_pix === 'string') {
    result.dados_bancarios_ou_pix = toUpperTrim(result.dados_bancarios_ou_pix)
  }
  if (typeof result.email === 'string') {
    result.email = normalizeEmail(result.email)
  }

  return result
}

/**
 * Normaliza campos de Seguradora para letras maiúsculas.
 */
export function normalizeSeguradoraPayload<T extends Record<string, any>>(data: T): T {
  const result: any = { ...data }

  if (typeof result.nome === 'string') {
    result.nome = toUpperTrim(result.nome)
  }

  return result
}

/**
 * Normaliza campos de Produto para letras maiúsculas.
 */
export function normalizeProdutoPayload<T extends Record<string, any>>(data: T): T {
  const result: any = { ...data }

  if (typeof result.nome === 'string') {
    result.nome = toUpperTrim(result.nome)
  }
  if (typeof result.codigo_comercial === 'string') {
    result.codigo_comercial = toUpperTrim(result.codigo_comercial)
  }
  if (typeof result.descricao === 'string') {
    result.descricao = toUpperPT(result.descricao)
  }

  return result
}

/**
 * Normaliza campos de Tipo de Seguro / Ramo para letras maiúsculas.
 */
export function normalizeTipoSeguroPayload<T extends Record<string, any>>(data: T): T {
  const result: any = { ...data }

  if (typeof result.nome === 'string') {
    result.nome = toUpperTrim(result.nome)
  }

  return result
}

/**
 * Normaliza campos de Modelo de Comissão para letras maiúsculas.
 */
export function normalizeModeloComissaoPayload<T extends Record<string, any>>(data: T): T {
  const result: any = { ...data }

  if (typeof result.nome === 'string') {
    result.nome = toUpperTrim(result.nome)
  }
  if (typeof result.descricao === 'string') {
    result.descricao = toUpperPT(result.descricao)
  }

  return result
}

/**
 * Normaliza campos de Custo Fixo para letras maiúsculas.
 */
export function normalizeCustoFixoPayload<T extends Record<string, any>>(data: T): T {
  const result: any = { ...data }

  if (typeof result.descricao === 'string') {
    result.descricao = toUpperTrim(result.descricao)
  }
  if (typeof result.observacoes === 'string') {
    result.observacoes = toUpperPT(result.observacoes)
  }

  return result
}

/**
 * Normaliza campos de Lembrete para letras maiúsculas.
 */
export function normalizeReminderPayload<T extends Record<string, any>>(data: T): T {
  const result: any = { ...data }

  if (typeof result.title === 'string') {
    result.title = toUpperTrim(result.title)
  }
  if (typeof result.description === 'string') {
    result.description = toUpperPT(result.description)
  }

  return result
}
