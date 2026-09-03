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

export interface CreateConciliacaoPayload {
  mes: number
  ano: number
  data_fechamento?: string
  usuario_fechamento?: string
  usuario_id?: string
  resumo?: string
  pendencias?: string
  observacoes?: string
}

export const createConciliacao = async (data: CreateConciliacaoPayload): Promise<Conciliacao> => {
  // Garantir que APENAS campos válidos do schema PocketBase sejam enviados
  const payload: Record<string, any> = {
    mes: Number(data.mes),
    ano: Number(data.ano),
  }

  if (data.data_fechamento) payload.data_fechamento = data.data_fechamento
  if (data.usuario_fechamento) payload.usuario_fechamento = String(data.usuario_fechamento)
  if (data.usuario_id) payload.usuario_id = String(data.usuario_id)
  if (data.resumo !== undefined) payload.resumo = String(data.resumo)
  if (data.pendencias !== undefined) payload.pendencias = String(data.pendencias)
  if (data.observacoes !== undefined) payload.observacoes = String(data.observacoes)

  return pb.collection('conciliacoes').create<Conciliacao>(payload)
}

export const deleteConciliacao = async (id: string): Promise<void> => {
  await pb.collection('conciliacoes').delete(id)
}
