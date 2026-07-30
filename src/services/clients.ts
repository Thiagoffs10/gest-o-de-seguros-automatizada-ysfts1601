import pb from '@/lib/pocketbase/client'
import { Client } from '@/types'

export const getClients = async (searchQuery?: string, filterString?: string) => {
  let filter = filterString || ''
  if (searchQuery) {
    const q = `name ~ "${searchQuery}" || email ~ "${searchQuery}" || cpf ~ "${searchQuery}" || cnpj ~ "${searchQuery}"`
    filter = filter ? `${filter} && (${q})` : q
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
