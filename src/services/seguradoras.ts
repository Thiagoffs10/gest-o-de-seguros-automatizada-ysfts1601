import pb from '@/lib/pocketbase/client'
import { Seguradora } from '@/types'

export const getSeguradoras = async () => {
  return pb.collection('seguradoras').getFullList<Seguradora>({ sort: 'nome' })
}

export const createSeguradora = async (data: Partial<Seguradora>) => {
  return pb.collection('seguradoras').create<Seguradora>(data)
}

export const updateSeguradora = async (id: string, data: Partial<Seguradora>) => {
  return pb.collection('seguradoras').update<Seguradora>(id, data)
}

export const deleteSeguradora = async (id: string) => {
  return pb.collection('seguradoras').delete(id)
}
