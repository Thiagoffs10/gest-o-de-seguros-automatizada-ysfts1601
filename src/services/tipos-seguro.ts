import pb from '@/lib/pocketbase/client'
import { TipoSeguro } from '@/types'

export const getTiposSeguro = async () => {
  return pb.collection('tipos_seguro').getFullList<TipoSeguro>({ sort: 'nome' })
}

export const getActiveTiposSeguro = async () => {
  return pb.collection('tipos_seguro').getFullList<TipoSeguro>({
    filter: 'ativo = true',
    sort: 'nome',
  })
}

export const createTipoSeguro = async (data: Partial<TipoSeguro>) => {
  return pb.collection('tipos_seguro').create<TipoSeguro>(data)
}

export const updateTipoSeguro = async (id: string, data: Partial<TipoSeguro>) => {
  return pb.collection('tipos_seguro').update<TipoSeguro>(id, data)
}

export const deleteTipoSeguro = async (id: string) => {
  return pb.collection('tipos_seguro').delete(id)
}
