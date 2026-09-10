import { Client, Policy, TipoSeguro } from '@/types'

export type CrossSellType =
  | 'auto_without_residencial'
  | 'mono_produto'
  | 'sem_apolice_ativa'
  | 'recuperacao_cancelada'
  | 'renovacao_proxima'

export interface CrossSellOpportunity {
  id: string
  clientId: string
  clientName: string
  clientEmail?: string
  clientPhone?: string
  type: CrossSellType
  title: string
  product: string
  reason: string
  actionLabel: string
  priority: 'alta' | 'media' | 'baixa'
  matchedPolicyNumber?: string
}

export interface ClientCrossSellProfile {
  client: Client
  ownedProducts: string[]
  activePolicies: Policy[]
  expiredOrCancelledPolicies: Policy[]
  upcomingRenewals: Policy[]
  opportunities: CrossSellOpportunity[]
}

/**
 * Normaliza o nome do ramo para comparação consistente
 */
export function normalizeProduct(tipo?: string): string {
  if (!tipo) return 'Outros'
  const t = tipo.trim().toLowerCase()
  if (t.includes('auto') || t.includes('carro') || t.includes('veículo') || t.includes('veiculo')) {
    return 'Auto'
  }
  if (t.includes('residenc') || t.includes('casa') || t.includes('lar')) {
    return 'Residencial'
  }
  if (t.includes('vida')) {
    return 'Vida'
  }
  if (t.includes('empres') || t.includes('pj') || t.includes('comerc')) {
    return 'Empresarial'
  }
  if (t.includes('saúde') || t.includes('saude') || t.includes('médic') || t.includes('odonto')) {
    return 'Saúde'
  }
  if (t.includes('condom')) {
    return 'Condomínio'
  }
  if (t.includes('viagem')) {
    return 'Viagem'
  }
  return tipo.trim()
}

/**
 * Avalia as oportunidades de cross-sell e recuperação para um cliente específico
 */
export function evaluateClientCrossSell(
  client: Client,
  clientPolicies: Policy[],
  _allTipos: TipoSeguro[] = [],
): CrossSellOpportunity[] {
  const opps: CrossSellOpportunity[] = []
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const in30Days = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0]

  const activePolicies = clientPolicies.filter((p) => p.status === 'Ativa')
  const cancelledOrExpired = clientPolicies.filter(
    (p) => p.status === 'Cancelada' || p.status === 'Vencida' || p.status === 'Expirada',
  )
  const renewals = clientPolicies.filter((p) => {
    if (p.status === 'Renovação Pendente') return true
    if (p.status === 'Ativa' && p.end_date) {
      const endClean = p.end_date.split('T')[0].split(' ')[0]
      return endClean >= todayStr && endClean <= in30Days
    }
    return false
  })

  // Conjunto de produtos ativos ou já possuídos pelo cliente
  const activeProducts = Array.from(
    new Set(
      activePolicies.map((p) => normalizeProduct(p.tipo_de_seguro || p.coverage_type || 'Outros')),
    ),
  )

  const hasAuto = activeProducts.includes('Auto')
  const hasResidencial = activeProducts.includes('Residencial')
  const hasVida = activeProducts.includes('Vida')

  // Regra 1: Possui Auto e não possui Residencial
  if (hasAuto && !hasResidencial) {
    opps.push({
      id: `${client.id}-auto-no-res`,
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      type: 'auto_without_residencial',
      title: 'Oferta de Seguro Residencial',
      product: 'Seguro Residencial',
      reason: 'Cliente possui seguro Auto ativo, mas ainda não protege sua residência.',
      actionLabel: 'Oferecer Residencial',
      priority: 'alta',
    })
  }

  // Regra 2: Cliente mono-produto (possui apenas 1 ramo ativo)
  if (activeProducts.length === 1) {
    const singleProd = activeProducts[0]
    const suggestedProd =
      singleProd === 'Auto' ? 'Seguro Residencial ou Vida' : 'Seguro Auto ou Vida'
    opps.push({
      id: `${client.id}-mono`,
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      type: 'mono_produto',
      title: 'Cliente Mono-produto',
      product: suggestedProd,
      reason: `Cliente contratou somente ${singleProd}. Oportunidade de expansão e fidelização de carteira.`,
      actionLabel: 'Diversificar Carteira',
      priority: 'media',
    })
  }

  // Regra 3: Não possui nenhuma apólice ativa (Reativação de cliente)
  if (activePolicies.length === 0) {
    const reasonText =
      clientPolicies.length === 0
        ? 'Cliente cadastrado no sistema, mas sem nenhuma apólice contratada.'
        : 'Todas as apólices do cliente expiraram ou foram canceladas.'

    opps.push({
      id: `${client.id}-reativacao`,
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      type: 'sem_apolice_ativa',
      title: 'Oportunidade de Reativação',
      product: 'Nova Cotação Geral',
      reason: reasonText,
      actionLabel: 'Reativar Cliente',
      priority: 'alta',
    })
  }

  // Regra 4: Apólice cancelada ou vencida recente (Recuperação de apólice)
  if (cancelledOrExpired.length > 0) {
    const lastCancelled = cancelledOrExpired[0]
    const ramo = normalizeProduct(
      lastCancelled.tipo_de_seguro || lastCancelled.coverage_type || 'Seguro',
    )
    opps.push({
      id: `${client.id}-recuperacao`,
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      type: 'recuperacao_cancelada',
      title: 'Recuperação de Apólice',
      product: `Recuperação: ${ramo}`,
      reason: `Cliente teve apólice ${lastCancelled.policy_number || ''} (${ramo}) com status ${lastCancelled.status}.`,
      actionLabel: 'Tentar Recuperação',
      priority: 'alta',
      matchedPolicyNumber: lastCancelled.policy_number,
    })
  }

  // Regra 5: Renovações/Vencimentos próximos (próximos 30 dias)
  if (renewals.length > 0) {
    const firstRen = renewals[0]
    const ramo = normalizeProduct(firstRen.tipo_de_seguro || firstRen.coverage_type || 'Seguro')
    opps.push({
      id: `${client.id}-renovacao`,
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      type: 'renovacao_proxima',
      title: 'Renovação Próxima',
      product: `Renovação ${ramo}`,
      reason: `Apólice ${firstRen.policy_number || ''} vence nos próximos 30 dias.`,
      actionLabel: 'Iniciar Renovação',
      priority: 'alta',
      matchedPolicyNumber: firstRen.policy_number,
    })
  }

  return opps
}

export interface PortfolioOpportunitiesSummary {
  autoWithoutResidencial: CrossSellOpportunity[]
  monoProduto: CrossSellOpportunity[]
  semApoliceAtiva: CrossSellOpportunity[]
  recuperacaoCancelada: CrossSellOpportunity[]
  renovacaoProxima: CrossSellOpportunity[]
  allOpportunities: CrossSellOpportunity[]
  totalClientsWithOpportunity: number
}

/**
 * Calcula o resumo consolidado de oportunidades de toda a carteira de clientes
 */
export function computePortfolioOpportunities(
  clients: Client[],
  policies: Policy[],
  tiposSeguro: TipoSeguro[] = [],
): PortfolioOpportunitiesSummary {
  const policiesByClient: Record<string, Policy[]> = {}
  for (const pol of policies) {
    if (!pol.client) continue
    if (!policiesByClient[pol.client]) {
      policiesByClient[pol.client] = []
    }
    policiesByClient[pol.client].push(pol)
  }

  const autoWithoutResidencial: CrossSellOpportunity[] = []
  const monoProduto: CrossSellOpportunity[] = []
  const semApoliceAtiva: CrossSellOpportunity[] = []
  const recuperacaoCancelada: CrossSellOpportunity[] = []
  const renovacaoProxima: CrossSellOpportunity[] = []
  const clientsWithOpp = new Set<string>()

  for (const client of clients) {
    const cPols = policiesByClient[client.id] || []
    const opps = evaluateClientCrossSell(client, cPols, tiposSeguro)
    if (opps.length > 0) {
      clientsWithOpp.add(client.id)
    }

    for (const opp of opps) {
      if (opp.type === 'auto_without_residencial') autoWithoutResidencial.push(opp)
      else if (opp.type === 'mono_produto') monoProduto.push(opp)
      else if (opp.type === 'sem_apolice_ativa') semApoliceAtiva.push(opp)
      else if (opp.type === 'recuperacao_cancelada') recuperacaoCancelada.push(opp)
      else if (opp.type === 'renovacao_proxima') renovacaoProxima.push(opp)
    }
  }

  const allOpportunities = [
    ...autoWithoutResidencial,
    ...monoProduto,
    ...semApoliceAtiva,
    ...recuperacaoCancelada,
    ...renovacaoProxima,
  ]

  return {
    autoWithoutResidencial,
    monoProduto,
    semApoliceAtiva,
    recuperacaoCancelada,
    renovacaoProxima,
    allOpportunities,
    totalClientsWithOpportunity: clientsWithOpp.size,
  }
}
