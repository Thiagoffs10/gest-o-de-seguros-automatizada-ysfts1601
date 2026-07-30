import { useAuth } from '@/hooks/use-auth'
import { can, type CollectionName, type ActionType } from '@/lib/permissions'

export function usePermissions() {
  const { user } = useAuth()
  const role = user?.role

  return {
    can: (collection: CollectionName, action: ActionType) => can(role, collection, action),
    role,
    isAdmin: role === 'Admin',
  }
}
