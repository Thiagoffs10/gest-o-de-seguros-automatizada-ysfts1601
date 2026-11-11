import pb from '@/lib/pocketbase/client'

/**
 * Multi-tenant (piloto): o usuário autenticado pode ter uma organização parceira.
 * - organization vazio/ausente = admin CRED10MIX (vê tudo, comportamento de hoje)
 * - organization preenchido = usuário do parceiro (só vê os dados da própria org)
 */

export function getOrgId(): string {
  const record: any = pb.authStore.record
  if (!record) return ''
  const org = record.organization
  if (!org) return ''
  if (typeof org === 'string') return org
  return (org as any)?.id || ''
}

export function hasOrganization(): boolean {
  return getOrgId() !== ''
}

/** Combina o filtro da listagem com a restrição de organização (quando houver). */
export function withOrgFilter(filter?: string): string {
  const org = getOrgId()
  if (!org) return filter || ''
  // Estrito: o parceiro vê SÓ os dados da própria organização (nada da CRED10MIX)
  const orgClause = `organization = "${org}"`
  return filter ? `(${filter}) && ${orgClause}` : orgClause
}
