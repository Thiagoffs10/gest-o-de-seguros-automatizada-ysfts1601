import pb from '@/lib/pocketbase/client'

export type CampaignPublicoTipo =
  | 'MONO_AUTO'
  | 'RENOVACOES_PROXIMAS'
  | 'ENDOSSOS_RECENTES'
  | 'SEM_APOLICE_ATIVA'
  | 'GERAL_CARTEIRA'

export interface CampaignStep {
  ordem: number
  tipo: 'educativo' | 'oferta'
  tema: string
  titulo: string
  objetivo: string
}

export interface CampaignAutomation {
  id: string
  nome: string
  descricao?: string
  tipo_publico: CampaignPublicoTipo
  filtros_config?: Record<string, any>
  frequencia_dias: number
  ciclo_passos: CampaignStep[]
  ativo: boolean
  total_preparados?: number
  total_enviados?: number
  created: string
  updated: string
}

export type QueueStatus =
  | 'AGUARDANDO_APROVACAO'
  | 'APROVADO'
  | 'REJEITADO'
  | 'ENVIADO'
  | 'FALHOU'
  | 'ESGOTAMENTO_ESPERA'

export interface CampaignQueueItem {
  id: string
  campanha: string
  client: string
  passo_ordem: number
  tipo_mensagem: 'educativo' | 'oferta'
  tema: string
  assunto: string
  corpo: string
  status: QueueStatus
  data_programada?: string
  data_envio?: string
  prioridade?: number
  tentativas?: number
  erro_log?: string
  dados_cliente_snapshot?: {
    nome?: string
    primeiro_nome?: string
    email?: string
    possui_auto?: boolean
    veiculo?: string
    possui_residencial?: boolean
    possui_vida?: boolean
    total_apolices?: number
    renovacoes_proximas?: number
  }
  redigido_por_ia?: boolean
  created: string
  updated: string
  expand?: {
    client?: {
      id: string
      name: string
      email: string
      phone?: string
    }
    campanha?: {
      id: string
      nome: string
      tipo_publico: CampaignPublicoTipo
    }
  }
}

export interface CampaignSendLog {
  id: string
  campanha: string
  client: string
  passo_ordem?: number
  tipo_mensagem?: 'educativo' | 'oferta'
  tema?: string
  assunto?: string
  recipient_email: string
  data_envio: string
  status_envio: 'ENVIADO' | 'FALHOU'
  resend_id?: string
  created: string
  updated: string
  expand?: {
    client?: {
      name: string
      email: string
    }
    campanha?: {
      nome: string
    }
  }
}

export interface PrepareCampaignDailyResult {
  success: boolean
  message: string
  prepared_count: number
  skipped_count: number
}

export interface DispatchCampaignQueueResult {
  success: boolean
  sent: number
  failed: number
  overflow_in_waiting: number
  daily_total: number
  daily_cap: number
  monthly_total: number
  monthly_cap: number
  near_monthly_cap: boolean
  message: string
}

// Data access functions
export async function getCampaignAutomations(): Promise<CampaignAutomation[]> {
  return pb.collection('campaign_automations').getFullList<CampaignAutomation>({
    sort: '-created',
  })
}

export async function createCampaignAutomation(
  data: Partial<CampaignAutomation>,
): Promise<CampaignAutomation> {
  return pb.collection('campaign_automations').create<CampaignAutomation>(data)
}

export async function updateCampaignAutomation(
  id: string,
  data: Partial<CampaignAutomation>,
): Promise<CampaignAutomation> {
  return pb.collection('campaign_automations').update<CampaignAutomation>(id, data)
}

export async function deleteCampaignAutomation(id: string): Promise<boolean> {
  return pb.collection('campaign_automations').delete(id)
}

export async function getCampaignQueue(filter?: string): Promise<CampaignQueueItem[]> {
  return pb.collection('campaign_queue').getFullList<CampaignQueueItem>({
    filter: filter || '',
    expand: 'client,campanha',
    sort: '-created',
  })
}

export async function updateQueueItem(
  id: string,
  data: Partial<CampaignQueueItem>,
): Promise<CampaignQueueItem> {
  return pb.collection('campaign_queue').update<CampaignQueueItem>(id, data)
}

export async function deleteQueueItem(id: string): Promise<boolean> {
  return pb.collection('campaign_queue').delete(id)
}

export async function approveQueueItem(id: string): Promise<CampaignQueueItem> {
  return pb.collection('campaign_queue').update<CampaignQueueItem>(id, {
    status: 'APROVADO',
  })
}

export async function rejectQueueItem(id: string): Promise<CampaignQueueItem> {
  return pb.collection('campaign_queue').update<CampaignQueueItem>(id, {
    status: 'REJEITADO',
  })
}

export async function approveAllQueueItems(ids: string[]): Promise<number> {
  let count = 0
  for (const id of ids) {
    try {
      await pb.collection('campaign_queue').update(id, { status: 'APROVADO' })
      count++
    } catch {
      /* ignore */
    }
  }
  return count
}

export async function getCampaignSendLogs(filter?: string): Promise<CampaignSendLog[]> {
  return pb.collection('campaign_send_logs').getFullList<CampaignSendLog>({
    filter: filter || '',
    expand: 'client,campanha',
    sort: '-data_envio,-created',
  })
}

export async function prepareCampaignDaily(
  campaignId?: string,
): Promise<PrepareCampaignDailyResult> {
  return pb.send('/backend/v1/campaigns/prepare-daily', {
    method: 'POST',
    body: JSON.stringify({ campaign_id: campaignId }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function dispatchCampaignQueue(limit = 100): Promise<DispatchCampaignQueueResult> {
  return pb.send('/backend/v1/campaigns/dispatch-queue', {
    method: 'POST',
    body: JSON.stringify({ limit }),
    headers: { 'Content-Type': 'application/json' },
  })
}
