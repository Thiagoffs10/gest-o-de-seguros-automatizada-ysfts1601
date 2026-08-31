import pb from '@/lib/pocketbase/client'
import { Client } from '@/types'

export const getClients = async (
  searchQuery?: string,
  filterString?: string,
  nameSearch?: string,
): Promise<Client[]> => {
  let filter = filterString || ''
  if (searchQuery) {
    const sanitized = searchQuery.replace(/"/g, '')
    const q = `cpf ~ "${sanitized}" || cnpj ~ "${sanitized}"`
    filter = filter ? `${filter} && (${q})` : q
  }
  if (nameSearch && nameSearch.trim()) {
    const sanitizedName = nameSearch.trim().replace(/"/g, '')
    const qName = `name ~ "${sanitizedName}"`
    filter = filter ? `${filter} && (${qName})` : qName
  }
  return pb.collection('clients').getFullList<Client>({
    filter,
    sort: '-created',
  })
}
export const getClient = async (id: string) => {
  return pb.collection('clients').getOne<Client>(id)
}

export const createClient = async (data: Partial<Client>) => {
  return pb.collection('clients').create<Client>(data)
}

export const updateClient = async (id: string, data: Partial<Client>) => {
  return pb.collection('clients').update<Client>(id, data)
}

export const deleteClient = async (id: string) => {
  return pb.collection('clients').delete(id)
}

export const findClientByDocument = async (document: string): Promise<Client | null> => {
  const digits = document.replace(/\D/g, '')
  if (digits.length !== 11 && digits.length !== 14) return null

  const clients = await pb.collection('clients').getFullList<Client>()
  return (
    clients.find((c) => {
      const cpfDigits = (c.cpf || '').replace(/\D/g, '')
      const cnpjDigits = (c.cnpj || '').replace(/\D/g, '')
      return cpfDigits === digits || cnpjDigits === digits
    }) || null
  )
}
