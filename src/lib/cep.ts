export interface CepResult {
  logradouro: string
  bairro: string
  localidade: string
  uf: string
}

export async function lookupCep(cep: string): Promise<CepResult | null> {
  const cleaned = cep.replace(/\D/g, '')
  if (cleaned.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`)
    const data = await res.json()
    if (data.erro) return null
    return {
      logradouro: data.logradouro || '',
      bairro: data.bairro || '',
      localidade: data.localidade || '',
      uf: data.uf || '',
    }
  } catch {
    return null
  }
}
