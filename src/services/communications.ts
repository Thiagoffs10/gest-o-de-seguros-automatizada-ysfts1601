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

export interface EmailAttachmentPayload {
  filename: string
  content: string // Base64 encoded string (sem prefixo data:image/...;base64,)
  content_type: string
}

export interface MassEmailRecipient {
  to: string
  client_id: string
  subject: string
  body: string
  attachment?: EmailAttachmentPayload
}

export interface SingleEmailResult {
  success: boolean
  status: string
  message: string
  resend_id?: string
}

export const sendSingleEmail = async (data: {
  to: string
  client_id?: string
  subject: string
  body: string
  from?: string
  attachment?: EmailAttachmentPayload
}): Promise<SingleEmailResult> => {
  return pb.send('/backend/v1/send-single-email', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const sendMassEmail = async (
  recipients: MassEmailRecipient[],
  from?: string,
  attachment?: EmailAttachmentPayload,
) => {
  return pb.send('/backend/v1/send-mass-email', {
    method: 'POST',
    body: JSON.stringify({ recipients, from, attachment }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface MonthlyBirthdaysSendResult {
  success: boolean
  sent: number
  failed: number
  skipped_no_email: number
  total: number
  message: string
}

export const sendMonthlyBirthdaysEmail = async (data: {
  month?: number
  reminder_id?: string
  subject?: string
  body?: string
  from?: string
}): Promise<MonthlyBirthdaysSendResult> => {
  return pb.send('/backend/v1/send-monthly-birthdays', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
}
