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

export const completeReminder = async (id: string) => {
  return pb.collection('reminders').update<Reminder>(id, {
    sent: true,
  })
}

export const completeAllPendingReminders = async (): Promise<number> => {
  const pending = await pb.collection('reminders').getFullList<Reminder>({
    filter: 'sent = false',
    requestKey: null,
  })
  let updatedCount = 0
  for (const item of pending) {
    try {
      await pb.collection('reminders').update(item.id, {
        sent: true,
      })
      updatedCount++
    } catch {
      /* continue */
    }
  }
  return updatedCount
}
