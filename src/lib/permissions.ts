export type UserRole = 'Admin' | 'Administrador' | 'Gerente' | 'Operador' | 'Visualizador'

export type CollectionName =
  | 'clients'
  | 'policies'
  | 'payments'
  | 'seguradoras'
  | 'parceiros'
  | 'communications'
  | 'reminders'
  | 'custos_fixos'
  | 'tipos_seguro'
  | 'conciliacoes'
  | 'parceiro_pagamentos'
  | 'parceiro_debitos'
  | 'email_templates'

export type ActionType = 'create' | 'read' | 'update' | 'delete'

const ALL: ActionType[] = ['create', 'read', 'update', 'delete']
const READ: ActionType[] = ['read']
const CRU: ActionType[] = ['create', 'read', 'update']
const RU: ActionType[] = ['read', 'update']

const PERMISSIONS: Record<UserRole, Record<CollectionName, ActionType[]>> = {
  Admin: {
    clients: ALL,
    policies: ALL,
    payments: ALL,
    seguradoras: ALL,
    parceiros: ALL,
    communications: ALL,
    reminders: ALL,
    custos_fixos: ALL,
    tipos_seguro: ALL,
    conciliacoes: ALL,
    parceiro_pagamentos: ALL,
    parceiro_debitos: ALL,
    email_templates: ALL,
  },
  Administrador: {
    clients: ALL,
    policies: ALL,
    payments: ALL,
    seguradoras: ALL,
    parceiros: ALL,
    communications: ALL,
    reminders: ALL,
    custos_fixos: ALL,
    tipos_seguro: ALL,
    conciliacoes: ALL,
    parceiro_pagamentos: ALL,
    parceiro_debitos: ALL,
    email_templates: ALL,
  },
  Gerente: {
    clients: CRU,
    policies: CRU,
    payments: READ,
    seguradoras: READ,
    parceiros: READ,
    communications: ['create', 'read'] as ActionType[],
    reminders: READ,
    custos_fixos: ALL,
    tipos_seguro: READ,
    conciliacoes: READ,
    parceiro_pagamentos: CRU,
    parceiro_debitos: CRU,
    email_templates: CRU,
  },
  Operador: {
    clients: RU,
    policies: READ,
    payments: READ,
    seguradoras: READ,
    parceiros: READ,
    communications: READ,
    reminders: READ,
    custos_fixos: [] as ActionType[],
    tipos_seguro: READ,
    conciliacoes: [] as ActionType[],
    parceiro_pagamentos: READ,
    parceiro_debitos: READ,
    email_templates: READ,
  },
  Visualizador: {
    clients: READ,
    policies: READ,
    payments: READ,
    seguradoras: READ,
    parceiros: READ,
    communications: READ,
    reminders: READ,
    custos_fixos: [] as ActionType[],
    tipos_seguro: READ,
    conciliacoes: [] as ActionType[],
    parceiro_pagamentos: READ,
    parceiro_debitos: READ,
    email_templates: READ,
  },
}

export function can(
  role: string | undefined,
  collection: CollectionName,
  action: ActionType,
): boolean {
  if (!role) return false
  const r = role as UserRole
  if (!(r in PERMISSIONS)) return false
  return PERMISSIONS[r][collection]?.includes(action) ?? false
}

export function canAccessMassSend(role: string | undefined): boolean {
  return role === 'Admin' || role === 'Administrador' || role === 'Gerente'
}
