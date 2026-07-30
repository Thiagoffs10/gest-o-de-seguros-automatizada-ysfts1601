import pb from '@/lib/pocketbase/client'
import { Reminder } from '@/types'

export const getReminders = async (filterString?: string) => {
  return pb.collection('reminders').getFullList<Reminder>({
    filter: filterString || '',
    expand: 'client,policy',
    sort: 'date',
  })
}

export const createReminder = async (data: Partial<Reminder>) => {
  return pb.collection('reminders').create<Reminder>(data)
}

export const updateReminder = async (id: string, data: Partial<Reminder>) => {
  return pb.collection('reminders').update<Reminder>(id, data)
}

export const deleteReminder = async (id: string) => {
  return pb.collection('reminders').delete(id)
}
