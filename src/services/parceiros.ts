import pb from '@/lib/pocketbase/client'
import { Parceiro } from '@/types'

export const getParceiros = async () => {
  return pb.collection('parceiros').getFullList<Parceiro>({ sort: 'nome' })
}

export const createParceiro = async (data: Partial<Parceiro>) => {
  return pb.collection('parceiros').create<Parceiro>(data)
}

export const updateParceiro = async (id: string, data: Partial<Parceiro>) => {
  return pb.collection('parceiros').update<Parceiro>(id, data)
}

export const deleteParceiro = async (id: string) => {
  return pb.collection('parceiros').delete(id)
}
