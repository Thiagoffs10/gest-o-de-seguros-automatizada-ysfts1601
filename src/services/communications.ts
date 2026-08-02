import pb from '@/lib/pocketbase/client'
import { Communication } from '@/types'

export const getCommunications = async (filterString?: string) => {
  return pb.collection('communications').getFullList<Communication>({
    filter: filterString || '',
    expand: 'client',
    sort: '-created',
  })
}

export const createCommunication = async (data: Partial<Communication>) => {
  return pb.collection('communications').create<Communication>(data)
}

export const updateCommunication = async (id: string, data: Partial<Communication>) => {
  return pb.collection('communications').update<Communication>(id, data)
}

export interface MassEmailRecipient {
  to: string
  client_id: string
  subject: string
  body: string
}

export interface SingleEmailResult {
  success: boolean
  status: string
  message: string
}

export const sendSingleEmail = async (data: {
  to: string
  client_id?: string
  subject: string
  body: string
  from?: string
}): Promise<SingleEmailResult> => {
  return pb.send('/backend/v1/send-single-email', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const sendMassEmail = async (recipients: MassEmailRecipient[], from?: string) => {
  return pb.send('/backend/v1/send-mass-email', {
    method: 'POST',
    body: JSON.stringify({ recipients, from }),
    headers: { 'Content-Type': 'application/json' },
  })
}
