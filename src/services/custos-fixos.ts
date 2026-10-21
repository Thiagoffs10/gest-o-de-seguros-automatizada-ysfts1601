import pb from '@/lib/pocketbase/client'
import { CustoFixo } from '@/types'
import { normalizeCustoFixoPayload } from '@/lib/normalize-text'

export const getCustosFixos = async (filterString?: string) => {
  return pb.collection('custos_fixos').getFullList<CustoFixo>({
    filter: filterString || '',
    sort: '-data',
  })
}

export const createCustoFixo = async (data: Partial<CustoFixo>) => {
  return pb.collection('custos_fixos').create<CustoFixo>(normalizeCustoFixoPayload(data))
}

export const updateCustoFixo = async (id: string, data: Partial<CustoFixo>) => {
  return pb.collection('custos_fixos').update<CustoFixo>(id, normalizeCustoFixoPayload(data))
}

export const deleteCustoFixo = async (id: string) => {
  return pb.collection('custos_fixos').delete(id)
}
