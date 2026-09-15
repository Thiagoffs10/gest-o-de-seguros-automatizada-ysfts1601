export interface CnpjResult {
  razao_social: string
  nome_fantasia?: string
  data_inicio_atividade?: string
  logradouro?: string
  numero?: string
  bairro?: string
  municipio?: string
  uf?: string
  cep?: string
  ddd_telefone_1?: string
  email?: string
}

/**
 * Consulta pública e gratuita via BrasilAPI para CNPJ.
 * Retorna dados cadastrais da empresa para preenchimento ágil.
 */
export async function lookupCnpj(cnpj: string): Promise<CnpjResult | null> {
  const clean = cnpj.replace(/\D/g, '')
  if (clean.length !== 14) return null

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()

    return {
      razao_social: data.razao_social || data.nome_fantasia || '',
      nome_fantasia: data.nome_fantasia || '',
      data_inicio_atividade: data.data_inicio_atividade || '',
      logradouro: data.logradouro
        ? `${data.descricao_tipo_de_logradouro ? `${data.descricao_tipo_de_logradouro} ` : ''}${data.logradouro}`.trim()
        : '',
      numero: data.numero || '',
      bairro: data.bairro || '',
      municipio: data.municipio || '',
      uf: data.uf || '',
      cep: data.cep || '',
      ddd_telefone_1: data.ddd_telefone_1 || '',
      email: data.email || '',
    }
  } catch {
    return null
  }
}
