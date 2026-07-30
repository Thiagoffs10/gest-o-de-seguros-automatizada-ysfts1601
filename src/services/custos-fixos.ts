import pb from '@/lib/pocketbase/client'
import { CustoFixo } from '@/types'

export const getCustosFixos = async (filterString?: string) => {
  return pb.collection('custos_fixos').getFullList<CustoFixo>({
    filter: filterString || '',
    sort: '-data',
  })
}

export const createCustoFixo = async (data: Partial<CustoFixo>) => {
  return pb.collection('custos_fixos').create<CustoFixo>(data)
}

export const updateCustoFixo = async (id: string, data: Partial<CustoFixo>) => {
  return pb.collection('custos_fixos').update<CustoFixo>(id, data)
}

export const deleteCustoFixo = async (id: string) => {
  return pb.collection('custos_fixos').delete(id)
}
