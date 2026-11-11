// Serviços de organizações parceiras (multi-tenant, piloto)
import pb from '@/lib/pocketbase/client'
import { getOrgId } from '@/lib/tenant'

export interface Organization {
  id: string
  nome: string
  ativa: boolean
  created?: string
}

/** Lista organizações. Admin vê todas; usuário de organização vê a própria. */
export const getOrganizations = async (): Promise<Organization[]> => {
  const org = getOrgId()
  const res = await pb.send<{ result: Organization[] }>('/backend/v1/organizations', {
    method: 'GET',
  })
  const list = Array.isArray(res) ? (res as unknown as Organization[]) : res?.result || []
  // Se usuário tem organização, restringe à própria (defesa extra no cliente)
  return org ? list.filter((o) => o.id === org) : list
}

export const createOrganization = async (nome: string, ativa = true): Promise<Organization> => {
  return pb.send<Organization>('/backend/v1/organizations', {
    method: 'POST',
    body: { nome, ativa },
  })
}

export const updateOrganization = async (
  id: string,
  data: { nome?: string; ativa?: boolean },
): Promise<Organization> => {
  return pb.send<Organization>(`/backend/v1/organizations/${id}`, {
    method: 'PATCH',
    body: data,
  })
}
