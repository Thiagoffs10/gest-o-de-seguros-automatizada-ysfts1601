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
