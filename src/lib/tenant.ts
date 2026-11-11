import pb from '@/lib/pocketbase/client'
import { readStoredOrgFilter } from '@/hooks/use-org-filter'

/**
 * Multi-tenant (piloto): o usuário autenticado pode ter uma organização parceira.
 * - organization vazio/ausente = admin CRED10MIX (vê tudo, comportamento de hoje),
 *   podendo OPCIONALMENTE restringir a visualização via seletor de organização
 *   (filtro persistido em localStorage pelo contexto use-org-filter).
 * - organization preenchido = usuário do parceiro (só vê os dados da própria org,
 *   filtro fixo — não pode trocar).
 */

export function getOrgId(): string {
  const record: any = pb.authStore.record
  if (!record) return ''
  const ownOrg = record.organization
  const ownOrgId = !ownOrg ? '' : typeof ownOrg === 'string' ? ownOrg : (ownOrg as any)?.id || ''

  // Usuário com organização própria: fixo nela (comportamento de hoje).
  if (ownOrgId) return ownOrgId

  // Admin sem organização: aplica o filtro escolhido no seletor ('all' = sem filtro).
  const selected = readStoredOrgFilter()
  return selected && selected !== 'all' ? selected : ''
}

export function hasOrganization(): boolean {
  return Boolean(pb.authStore.record?.organization)
}

/** Combina o filtro da listagem com a restrição de organização (quando houver). */
export function withOrgFilter(filter?: string): string {
  const org = getOrgId()
  if (!org) return filter || ''
  // Estrito: o parceiro (ou admin com filtro ativo) vê SÓ os dados da organização
  const orgClause = `organization = "${org}"`
  return filter ? `(${filter}) && ${orgClause}` : orgClause
}
