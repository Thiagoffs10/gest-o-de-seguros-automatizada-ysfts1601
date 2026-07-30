import pb from '@/lib/pocketbase/client'
import { Payment } from '@/types'

export const getPayments = async (filterString?: string) => {
  return pb.collection('payments').getFullList<Payment>({
    filter: filterString || '',
    expand: 'policy,policy.client',
    sort: 'due_date',
  })
}

export const createPayment = async (data: Partial<Payment>) => {
  return pb.collection('payments').create<Payment>(data)
}

export const updatePayment = async (id: string, data: Partial<Payment>) => {
  return pb.collection('payments').update<Payment>(id, data)
}

export const deletePayment = async (id: string) => {
  return pb.collection('payments').delete(id)
}
