import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'

/**
 * Contexto de filtro de organização do ADMIN (multi-tenant, piloto).
 *
 * - Admin SEM organization própria: pode escolher "all" (tudo, comportamento de hoje)
 *   ou restringir a visualização a uma organização específica (ex.: só o parceiro).
 *   A escolha é persistida em localStorage.
 * - Usuário COM organization: o filtro é FIXO na própria organização (não pode trocar)
 *   — comportamento de hoje preservado; nem aparece seletor.
 */

const STORAGE_KEY = 'admin_org_filter'

export type OrgFilterValue = string // 'all' | organization id

interface OrgFilterContextType {
  /** Valor atual do filtro: 'all' ou id da organização. */
  value: OrgFilterValue
  /** true quando o usuário tem organização própria (filtro fixo, sem seletor). */
  isFixedToOwnOrg: boolean
  /** id da organização do usuário autenticado ('' quando admin sem organização). */
  ownOrgId: string
  setFilter: (v: OrgFilterValue) => void
}

const OrgFilterContext = createContext<OrgFilterContextType | undefined>(undefined)

/** Filtro escolhido pelo admin, lido diretamente do localStorage (para uso fora do React). */
export function readStoredOrgFilter(): OrgFilterValue {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'all'
  } catch {
    return 'all'
  }
}

export function OrgFilterProvider({
  children,
  ownOrgId,
  isAuthenticated,
}: {
  children: ReactNode
  ownOrgId: string
  isAuthenticated: boolean
}) {
  // Só permite escolha quando o usuário NÃO tem organização própria (admin).
  const isFixedToOwnOrg = Boolean(ownOrgId)

  const [value, setValue] = useState<OrgFilterValue>(() => {
    if (isFixedToOwnOrg) return ownOrgId
    return readStoredOrgFilter()
  })

  // Se o usuário logar/deslogar ou trocar de conta, o filtro se recompõe:
  // - usuário de organização: fixo na própria
  // - admin: volta ao valor salvo (ou 'all')
  useEffect(() => {
    if (isFixedToOwnOrg) {
      setValue(ownOrgId)
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
    } else if (isAuthenticated) {
      setValue(readStoredOrgFilter())
    } else {
      setValue('all')
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [ownOrgId, isFixedToOwnOrg, isAuthenticated])

  const setFilter = (v: OrgFilterValue) => {
    if (isFixedToOwnOrg) return
    setValue(v)
    try {
      if (v === 'all') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, v)
    } catch {
      /* ignore */
    }
  }

  const ctx = useMemo(
    () => ({ value, isFixedToOwnOrg, ownOrgId, setFilter }),
    [value, isFixedToOwnOrg, ownOrgId],
  )

  return <OrgFilterContext.Provider value={ctx}>{children}</OrgFilterContext.Provider>
}

export function useOrgFilter(): OrgFilterContextType {
  const ctx = useContext(OrgFilterContext)
  if (!ctx) throw new Error('useOrgFilter must be used within an OrgFilterProvider')
  return ctx
}
