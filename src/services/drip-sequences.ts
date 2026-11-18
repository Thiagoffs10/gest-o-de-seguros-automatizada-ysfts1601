import pb from '@/lib/pocketbase/client'
import { withOrgFilter } from '@/lib/tenant'

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
