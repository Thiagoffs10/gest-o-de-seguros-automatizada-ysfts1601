const CPF_PATTERN = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/
const CNPJ_PATTERN = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/

export function isValidCpf(value: string): boolean {
  if (!value) return false
  return CPF_PATTERN.test(value.trim())
}

export function isValidCnpj(value: string): boolean {
  if (!value) return false
  return CNPJ_PATTERN.test(value.trim())
}

export function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function maskCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function formatDocumentLabel(client: {
  tipo_pessoa?: string
  cpf?: string
  cnpj?: string
}): string {
  if (client.tipo_pessoa === 'PJ') {
    return client.cnpj ? `CNPJ: ${client.cnpj}` : 'CNPJ: -'
  }
  return client.cpf ? `CPF: ${client.cpf}` : 'CPF: -'
}

export function matchDocument(
  client?: { cpf?: string; cnpj?: string } | null,
  query?: string,
): boolean {
  if (!client || !query) return false
  const cleanQuery = query.replace(/\D/g, '')
  if (!cleanQuery) return false

  const cpfClean = (client.cpf || '').replace(/\D/g, '')
  const cnpjClean = (client.cnpj || '').replace(/\D/g, '')

  return cpfClean.includes(cleanQuery) || cnpjClean.includes(cleanQuery)
}
