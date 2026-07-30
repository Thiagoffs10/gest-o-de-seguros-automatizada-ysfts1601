import pb from '@/lib/pocketbase/client'
import { Policy } from '@/types'

export const getPolicies = async (filterString?: string) => {
  return pb.collection('policies').getFullList<Policy>({
    filter: filterString || '',
    expand: 'client',
    sort: '-created',
  })
}

export const getPolicy = async (id: string) => {
  return pb.collection('policies').getOne<Policy>(id, {
    expand: 'client',
  })
}

export const createPolicy = async (data: Partial<Policy>) => {
  return pb.collection('policies').create<Policy>(data)
}

export const updatePolicy = async (id: string, data: Partial<Policy>) => {
  return pb.collection('policies').update<Policy>(id, data)
}

export const deletePolicy = async (id: string) => {
  return pb.collection('policies').delete(id)
}
