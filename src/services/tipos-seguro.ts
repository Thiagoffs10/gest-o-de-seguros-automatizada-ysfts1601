import pb from '@/lib/pocketbase/client'
import { TipoSeguro } from '@/types'
import { normalizeTipoSeguroPayload } from '@/lib/normalize-text'

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
  return pb.collection('tipos_seguro').create<TipoSeguro>(normalizeTipoSeguroPayload(data))
}

export const updateTipoSeguro = async (id: string, data: Partial<TipoSeguro>) => {
  return pb.collection('tipos_seguro').update<TipoSeguro>(id, normalizeTipoSeguroPayload(data))
}

export const deleteTipoSeguro = async (id: string) => {
  return pb.collection('tipos_seguro').delete(id)
}
