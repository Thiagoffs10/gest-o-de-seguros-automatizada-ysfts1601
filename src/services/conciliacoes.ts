import pb from '@/lib/pocketbase/client'
import { Conciliacao } from '@/types'

export const getConciliacao = async (mes: number, ano: number): Promise<Conciliacao | null> => {
  try {
    return await pb
      .collection('conciliacoes')
      .getFirstListItem<Conciliacao>(`mes = ${mes} && ano = ${ano}`)
  } catch {
    return null
  }
}

export const getAllConciliacoes = async (): Promise<Conciliacao[]> => {
  return pb.collection('conciliacoes').getFullList<Conciliacao>({ sort: '-ano,-mes' })
}

export const createConciliacao = async (data: Partial<Conciliacao>): Promise<Conciliacao> => {
  return pb.collection('conciliacoes').create<Conciliacao>(data)
}

export const deleteConciliacao = async (id: string): Promise<void> => {
  await pb.collection('conciliacoes').delete(id)
}
