import pb from '@/lib/pocketbase/client'
import { ParceiroPagamento, ParceiroDebito, ParceiroDebitoItem } from '@/types'

export const getParceiroPagamentos = async (parceiroId?: string): Promise<ParceiroPagamento[]> => {
  const filter = parceiroId && parceiroId !== 'all' ? `parceiro = "${parceiroId}"` : ''
  return pb.collection('parceiro_pagamentos').getFullList<ParceiroPagamento>({
    filter,
    sort: '-data_pagamento,-created',
    expand: 'parceiro',
  })
}

export const createParceiroPagamento = async (data: {
  parceiro: string
  data_pagamento: string
  total_comissoes: number
  total_debitos: number
  taxa_pix: number
  valor_liquido: number
  policies_ids?: string
  detalhes_debitos?: string
  observacoes?: string
  usuario_id?: string
  usuario_nome?: string
}): Promise<ParceiroPagamento> => {
  return pb.collection('parceiro_pagamentos').create<ParceiroPagamento>(data)
}

export const getParceiroDebitosPendentes = async (
  parceiroId: string,
): Promise<ParceiroDebito[]> => {
  if (!parceiroId || parceiroId === 'all') return []
  return pb.collection('parceiro_debitos').getFullList<ParceiroDebito>({
    filter: `parceiro = "${parceiroId}" && (status = "Pendente" || status = "" || status = null)`,
    sort: '-created',
  })
}

export const createParceiroDebito = async (data: {
  parceiro: string
  descricao: string
  valor: number
  data?: string
  status?: 'Pendente' | 'Pago' | 'Cancelado'
}): Promise<ParceiroDebito> => {
  return pb.collection('parceiro_debitos').create<ParceiroDebito>({
    ...data,
    status: data.status || 'Pendente',
  })
}

export const updateParceiroDebito = async (
  id: string,
  data: Partial<ParceiroDebito>,
): Promise<ParceiroDebito> => {
  return pb.collection('parceiro_debitos').update<ParceiroDebito>(id, data)
}

export const deleteParceiroDebito = async (id: string): Promise<boolean> => {
  return pb.collection('parceiro_debitos').delete(id)
}

export const liquidarDebitosPagamento = async (
  debitos: ParceiroDebitoItem[],
  parceiroId: string,
  pagamentoId: string,
) => {
  for (const deb of debitos) {
    if (deb.id) {
      try {
        await pb.collection('parceiro_debitos').update(deb.id, {
          status: 'Pago',
          pagamento: pagamentoId,
          descricao: deb.descricao,
          valor: deb.valor,
        })
      } catch {
        // Continue if fails
      }
    } else {
      try {
        await pb.collection('parceiro_debitos').create({
          parceiro: parceiroId,
          descricao: deb.descricao,
          valor: deb.valor,
          status: 'Pago',
          pagamento: pagamentoId,
          data: new Date().toISOString().split('T')[0],
        })
      } catch {
        // Continue
      }
    }
  }
}
