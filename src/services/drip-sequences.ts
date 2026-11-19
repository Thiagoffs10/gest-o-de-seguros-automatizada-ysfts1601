import pb from '@/lib/pocketbase/client'
import { getOrgId, withOrgFilter } from '@/lib/tenant'

// ============ TIPOS ============

export interface DripSequence {
  id: string
  nome: string
  ramo: string
  descricao: string
  ativo: boolean
  intervalo_dias: number
  organization: string
  passos: DripStep[] // JSON embutido
  created: string
  updated: string
}

export interface DripStep {
  ordem: number
  tipo: 'educativo' | 'oferta'
  assunto: string
  corpo: string
}

export interface DripSendLog {
  id: string
  client: string
  sequence: string
  passo_ordem: number
  tipo_mensagem: 'educativo' | 'oferta'
  ramo: string
  assunto: string
  recipient_email: string
  data_envio: string
  status_envio: 'ENVIADO' | 'FALHOU'
  erro_log: string
  created: string
  expand?: {
    client?: { id: string; name: string; email: string }
    sequence?: { id: string; nome: string; ramo: string }
  }
}

export const DRIP_RAMO_LABELS: Record<string, string> = {
  viagem: 'Viagem',
  celular: 'Aparelhos Celular',
  notebook: 'Notebook',
  auto: 'Auto',
  residencia: 'Residência',
  saude: 'Saúde',
}

// ============ CRUD ============

export async function getDripSequences(): Promise<DripSequence[]> {
  return pb.collection('email_sequences').getFullList<DripSequence>({
    sort: 'created',
  })
}

export async function updateDripSequence(
  id: string,
  data: Partial<Pick<DripSequence, 'ativo' | 'intervalo_dias' | 'nome' | 'descricao' | 'passos'>>,
): Promise<DripSequence> {
  return pb.collection('email_sequences').update<DripSequence>(id, data)
}

export async function getDripLogs(filter?: string): Promise<DripSendLog[]> {
  return pb.collection('email_sequence_logs').getFullList<DripSendLog>({
    // withOrgFilter aplica o isolamento por organização do usuário autenticado
    // (parceiro vê só os logs da própria org; admin vê tudo, ou a org selecionada).
    filter: withOrgFilter(filter || ''),
    expand: 'client,sequence',
    sort: '-data_envio,-created',
  })
}

// ============ E-MAIL DE ANIVERSÁRIO ============
// Coleções criadas pela migração 0067 e consumidas pelo hook birthday_emails.js
// (roda diário antes do drip, mesmo teto de 100 envios/dia).
// A resolução do texto espelha o hook: config da org → config global
// (organization vazia) → padrão embutido no próprio hook.

export interface BirthdayConfig {
  id: string
  ativo: boolean
  assunto: string
  corpo: string
  organization: string
  created: string
  updated: string
}

export interface BirthdayLog {
  id: string
  client: string
  ano: number
  assunto: string
  recipient_email: string
  data_envio: string
  status_envio: 'ENVIADO' | 'FALHOU'
  erro_log: string
  organization: string
  created: string
  expand?: {
    client?: { id: string; name: string; email: string }
  }
}

/** Texto padrão — igual ao seed da migração 0067 / fallback do hook. */
export const BIRTHDAY_DEFAULT_ASSUNTO = 'Feliz aniversário, {primeiro_nome}! 🎉'
export const BIRTHDAY_DEFAULT_CORPO =
  'Olá, {primeiro_nome}!\n\n' +
  'A equipe da CRED10MIX Seguros deseja a você um aniversário cheio de saúde, alegria e conquistas! 🎂\n\n' +
  'É uma alegria ter você com a gente. E se precisar de qualquer seguro — auto, residência, viagem ou saúde — é só chamar que nós cuidamos de tudo para você.\n\n' +
  'Atenciosamente,\n' +
  'Equipe CRED10MIX Seguros'

/**
 * Busca a config de aniversário aplicável à organização atual.
 * Diferente do withOrgFilter comum: inclui o registro GLOBAL (organization vazia)
 * como fallback, espelhando a bdayGetConfig do hook. Prefere o registro da org.
 */
export async function getBirthdayConfig(): Promise<BirthdayConfig | null> {
  const orgId = getOrgId()
  const filter = orgId ? `(organization = "${orgId}" || organization = "")` : 'organization = ""'
  const records = await pb.collection('birthday_emails_config').getFullList<BirthdayConfig>({
    filter,
    sort: '-updated',
  })
  return records.find((r) => r.organization === orgId) || records[0] || null
}

/**
 * Grava assunto/corpo/ativo. Atualiza o registro existente da org (ou o global
 * como fallback); se não houver nenhum, cria um para a organização atual.
 */
export async function updateBirthdayConfig(
  data: Partial<Pick<BirthdayConfig, 'ativo' | 'assunto' | 'corpo'>>,
  current?: BirthdayConfig | null,
): Promise<BirthdayConfig> {
  if (current?.id) {
    return pb.collection('birthday_emails_config').update<BirthdayConfig>(current.id, data)
  }
  return pb.collection('birthday_emails_config').create<BirthdayConfig>({
    ativo: true,
    assunto: BIRTHDAY_DEFAULT_ASSUNTO,
    corpo: BIRTHDAY_DEFAULT_CORPO,
    organization: getOrgId(),
    ...data,
  })
}

/** Logs de envio de aniversário (sucesso e falha), mais recentes primeiro. */
export async function getBirthdayLogs(): Promise<BirthdayLog[]> {
  return pb.collection('birthday_email_logs').getFullList<BirthdayLog>({
    filter: withOrgFilter(''),
    expand: 'client',
    sort: '-data_envio,-created',
  })
}

// ============ DISPARO MANUAL ============

export interface DripRunResult {
  success: boolean
  enviados: number
  falhas: number
  pulados_cross_sell: number
  aguardando_intervalo: number
  teto_atingido: boolean
  detalhe: Array<{ sequencia: string; ramo: string; enviados: number }>
  message: string
}

export async function runDripNow(): Promise<DripRunResult> {
  return pb.send('/backend/v1/drip/run-now', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
}
