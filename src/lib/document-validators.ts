export function isValidCpf(value: string): boolean {
  if (!value) return false
  const clean = value.replace(/\D/g, '')
  if (clean.length !== 11) return false
  if (/^(\d)\1{10}$/.test(clean)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i)
  }
  let rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(clean.charAt(9), 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i)
  }
  rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(clean.charAt(10), 10)) return false

  return true
}

export function isValidCnpj(value: string): boolean {
  if (!value) return false
  const clean = value.replace(/\D/g, '')
  if (clean.length !== 14) return false
  if (/^(\d)\1{13}$/.test(clean)) return false

  let size = clean.length - 2
  let numbers = clean.substring(0, size)
  const digits = clean.substring(size)
  let sum = 0
  let pos = size - 7

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--
    if (pos < 2) pos = 9
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(0), 10)) return false

  size = size + 1
  numbers = clean.substring(0, size)
  sum = 0
  pos = size - 7
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--
    if (pos < 2) pos = 9
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(1), 10)) return false

  return true
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

export function maskDocument(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 11) {
    return maskCpf(digits)
  }
  return maskCnpj(digits)
}

export function formatClientDocument(client: {
  tipo_pessoa?: string
  cpf?: string
  cnpj?: string
}): string {
  if (client.tipo_pessoa === 'PJ' && client.cnpj) {
    return maskCnpj(client.cnpj)
  }
  if (client.cpf) return maskCpf(client.cpf)
  if (client.cnpj) return maskCnpj(client.cnpj)
  return ''
}
