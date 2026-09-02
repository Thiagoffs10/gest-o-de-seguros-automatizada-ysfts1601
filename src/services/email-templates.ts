import pb from '@/lib/pocketbase/client'
import { EmailTemplate } from '@/types'

export const getEmailTemplates = async (): Promise<EmailTemplate[]> => {
  return pb.collection('email_templates').getFullList<EmailTemplate>({
    sort: 'name',
  })
}

export const getEmailTemplate = async (id: string): Promise<EmailTemplate> => {
  return pb.collection('email_templates').getOne<EmailTemplate>(id)
}

export const createEmailTemplate = async (
  data: Partial<Omit<EmailTemplate, 'id' | 'created' | 'updated'>>,
): Promise<EmailTemplate> => {
  return pb.collection('email_templates').create<EmailTemplate>(data)
}

export const updateEmailTemplate = async (
  id: string,
  data: Partial<Omit<EmailTemplate, 'id' | 'created' | 'updated'>>,
): Promise<EmailTemplate> => {
  return pb.collection('email_templates').update<EmailTemplate>(id, data)
}

export const deleteEmailTemplate = async (id: string): Promise<boolean> => {
  return pb.collection('email_templates').delete(id)
}
