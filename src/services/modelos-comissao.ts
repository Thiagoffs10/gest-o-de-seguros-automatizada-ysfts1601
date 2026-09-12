import pb from '@/lib/pocketbase/client'
import {
  ModeloComissao,
  TipoModeloComissao,
  ComissaoPrevista,
  ComissaoRecebimento,
  Policy,
  TIPOS_NATIVOS_RECEBIMENTO,
} from '@/types'
import { calcularPrevisoesComissao, PrevisaoItemCalculada } from '@/services/comissao-engine'
import { formatDateForInput } from '@/lib/utils'

export const getModelosComissao = async (
  filter?: string,
  sort = '-created',
): Promise<ModeloComissao[]> => {
  return pb.collection('modelos_comissao').getFullList<ModeloComissao>({
    filter,
    sort,
    expand: 'seguradora',
  })
}

export const getModeloComissao = async (id: string): Promise<ModeloComissao> => {
  return pb.collection('modelos_comissao').getOne<ModeloComissao>(id, {
    expand: 'seguradora',
  })
}

export interface CreateModeloComissaoPayload {
  nome: string
  tipo_modelo: TipoModeloComissao
  seguradora?: string | null
  tipo_seguro?: string | null
  percentual_padrao?: number
  config_json?: any
  valido_a_partir_de?: string | null
  ativo?: boolean
  descricao?: string
}

export const createModeloComissao = async (
  data: CreateModeloComissaoPayload,
): Promise<ModeloComissao> => {
  const payload: Record<string, any> = {
    nome: data.nome.trim(),
    tipo_modelo: data.tipo_modelo,
    percentual_padrao: data.percentual_padrao != null ? Number(data.percentual_padrao) : null,
    config_json: data.config_json || {},
    valido_a_partir_de: data.valido_a_partir_de
      ? formatDateForInput(data.valido_a_partir_de)
      : null,
    versao: 1,
    ativo: data.ativo !== false,
    descricao: data.descricao ? data.descricao.trim() : '',
  }

  if (data.seguradora && data.seguradora.trim() !== '') {
    payload.seguradora = data.seguradora.trim()
  } else {
    payload.seguradora = null
  }

  if (data.tipo_seguro && data.tipo_seguro.trim() !== '') {
    payload.tipo_seguro = data.tipo_seguro.trim()
  } else {
    payload.tipo_seguro = ''
  }

  return pb.collection('modelos_comissao').create<ModeloComissao>(payload)
}

export const updateModeloComissao = async (
  id: string,
  data: Partial<CreateModeloComissaoPayload>,
): Promise<ModeloComissao> => {
  const current = await pb.collection('modelos_comissao').getOne<ModeloComissao>(id)
  const payload: Record<string, any> = {}

  if (data.nome !== undefined) payload.nome = data.nome.trim()
  if (data.tipo_modelo !== undefined) payload.tipo_modelo = data.tipo_modelo
  if (data.percentual_padrao !== undefined) {
    payload.percentual_padrao =
      data.percentual_padrao != null ? Number(data.percentual_padrao) : null
  }
  if (data.config_json !== undefined) payload.config_json = data.config_json
  if (data.valido_a_partir_de !== undefined) {
    payload.valido_a_partir_de = data.valido_a_partir_de
      ? formatDateForInput(data.valido_a_partir_de)
      : null
  }
  if (data.ativo !== undefined) payload.ativo = data.ativo
  if (data.descricao !== undefined) payload.descricao = data.descricao.trim()

  if (data.seguradora !== undefined) {
    payload.seguradora =
      data.seguradora && data.seguradora.trim() !== '' ? data.seguradora.trim() : null
  }
  if (data.tipo_seguro !== undefined) {
    payload.tipo_seguro = data.tipo_seguro ? data.tipo_seguro.trim() : ''
  }

  // Versionamento automático interno: se alterou condições, incrementa versão
  const novaVersao = (current.versao || 1) + 1
  payload.versao = novaVersao

  return pb.collection('modelos_comissao').update<ModeloComissao>(id, payload)
}

export const deleteModeloComissao = async (id: string): Promise<boolean> => {
  return pb.collection('modelos_comissao').delete(id)
}

/**
 * Busca sugestão de modelo para Seguradora + Produto (tipo_seguro).
 * ITEM B.1:
 * - Filtro ESTRITO por seguradora + produto (tipo_seguro).
 * - Usar `valido_a_partir_de` para excluir modelos com vigência futura (só aceita se nulo ou <= data de hoje).
 * - REMOVER qualquer fallback que sugira modelo de OUTRA seguradora ou apenas por tipo de seguro.
 * - Caso a seguradora tenha um modelo padrão sem produto específico (tipo_seguro vazio/nulo),
 *   pode ser aceito SOMENTE SE for da mesma seguradora e com vigência atual.
 */
export const findSuggestedModelo = async (
  seguradoraId?: string | null,
  tipoSeguro?: string | null,
  referenceDateStr?: string,
): Promise<ModeloComissao | null> => {
  if (!seguradoraId) return null

  try {
    const list = await pb.collection('modelos_comissao').getFullList<ModeloComissao>({
      filter: 'ativo = true',
      sort: '-created',
    })

    if (list.length === 0) return null

    const todayStr = referenceDateStr || formatDateForInput(new Date().toISOString()) || ''

    // Filtrar apenas modelos da MESMA seguradora e cuja vigência não seja futura
    const validosParaSeguradora = list.filter((m) => {
      if (m.seguradora !== seguradoraId) return false
      // Excluir modelos com vigência futura
      if (m.valido_a_partir_de && todayStr && m.valido_a_partir_de > todayStr) {
        return false
      }
      return true
    })

    if (validosParaSeguradora.length === 0) return null

    // 1. Match estrito por seguradora E produto (tipo_seguro)
    if (tipoSeguro && tipoSeguro.trim() !== '') {
      const normalizedTipo = tipoSeguro.trim().toLowerCase()
      const matchExact = validosParaSeguradora.find(
        (m) => m.tipo_seguro && m.tipo_seguro.trim().toLowerCase() === normalizedTipo,
      )
      if (matchExact) return matchExact
    }

    // 2. Modelo geral da mesma seguradora sem produto restrito (tipo_seguro vazio)
    const matchSeguradoraGeral = validosParaSeguradora.find(
      (m) => !m.tipo_seguro || m.tipo_seguro.trim() === '',
    )
    if (matchSeguradoraGeral) return matchSeguradoraGeral

    return null
  } catch {
    return null
  }
}

/**
 * Obtém comissões previstas por apólice
 */
export interface ComissaoPrevistaFilterParams {
  periodStart?: string
  periodEnd?: string
  seguradoraId?: string
  produtoId?: string
  status?: string
  page?: number
  perPage?: number
}

export interface ComissoesPrevistasPaginatedResult {
  items: ComissaoPrevista[]
  page: number
  perPage: number
  totalItems: number
  totalPages: number
}

export const getComissoesPrevistasPaginated = async (
  params: ComissaoPrevistaFilterParams = {},
): Promise<ComissoesPrevistasPaginatedResult> => {
  const page = params.page || 1
  const perPage = params.perPage || 15
  const filters: string[] = []

  if (params.status && params.status !== 'ALL') {
    filters.push(`status = "${params.status}"`)
  }
  if (params.seguradoraId && params.seguradoraId !== 'ALL') {
    filters.push(`policy.seguradora = "${params.seguradoraId}"`)
  }
  if (params.produtoId && params.produtoId !== 'ALL') {
    filters.push(`policy.produto = "${params.produtoId}"`)
  }
  if (params.periodStart) {
    filters.push(`data_prevista >= "${params.periodStart}"`)
  }
  if (params.periodEnd) {
    filters.push(`data_prevista <= "${params.periodEnd}"`)
  }

  const filterStr = filters.join(' && ')

  try {
    const res = await pb
      .collection('comissoes_previstas')
      .getList<ComissaoPrevista>(page, perPage, {
        filter: filterStr || undefined,
        sort: 'data_prevista,parcela_numero',
        expand: 'policy,policy.client,policy.seguradora,policy.produto,modelo_comissao,endorsement',
      })
    return {
      items: res.items,
      page: res.page,
      perPage: res.perPage,
      totalItems: res.totalItems,
      totalPages: res.totalPages,
    }
  } catch (err: any) {
    console.error('Erro ao buscar comissoes_previstas paginadas:', err)
    return {
      items: [],
      page: 1,
      perPage,
      totalItems: 0,
      totalPages: 1,
    }
  }
}

export const getComissoesPrevistasByPolicy = async (
  policyId: string,
): Promise<ComissaoPrevista[]> => {
  return pb.collection('comissoes_previstas').getFullList<ComissaoPrevista>({
    filter: `policy = "${policyId}"`,
    sort: 'data_prevista,parcela_numero',
  })
}

/**
 * Sincroniza/gera as previsões de comissão para uma apólice com base no modelo ou customização.
 * Não altera nem remove previsões que já possuam baixas/recebimentos vinculados.
 */
export const syncPrevisoesForPolicy = async (
  policy: Policy,
  modeloOuConfig?: {
    tipo_modelo: TipoModeloComissao
    percentual_padrao?: number
    nome?: string
    config_json?: any
  },
): Promise<ComissaoPrevista[]> => {
  if (!policy.id) return []

  // Se o modelo não foi passado explicitamente, tenta carregar o modelo vinculado
  let modelo = modeloOuConfig
  if (!modelo) {
    if (policy.comissao_personalizada_config?.tipo_modelo) {
      modelo = {
        tipo_modelo: policy.comissao_personalizada_config.tipo_modelo,
        percentual_padrao:
          policy.comissao_personalizada_config.percentual_padrao || policy.commission_percent,
        nome: policy.comissao_personalizada
          ? 'Personalizado nesta apólice'
          : TIPOS_NATIVOS_RECEBIMENTO[policy.comissao_personalizada_config.tipo_modelo]?.nome ||
            'Padrão',
        config_json: policy.comissao_personalizada_config,
      }
    } else if (policy.modelo_comissao) {
      try {
        const m = await pb
          .collection('modelos_comissao')
          .getOne<ModeloComissao>(policy.modelo_comissao)
        modelo = {
          tipo_modelo: m.tipo_modelo,
          percentual_padrao: m.percentual_padrao,
          nome: m.nome,
          config_json: m.config_json,
        }
      } catch {
        /* intentionally ignored */
      }
    }
  }

  if (!modelo) {
    // Apólice sem modelo usa o fluxo legado (à vista direto na apólice)
    return []
  }

  // 1. Calcular lista de previsões futuras
  const itensCalculados = calcularPrevisoesComissao(
    {
      start_date: policy.start_date,
      valor_liquido: policy.valor_liquido,
      premium_amount: policy.premium_amount,
      commission_percent: policy.commission_percent,
      commission: policy.commission,
      iss: policy.iss,
    },
    modelo,
  )

  // 2. Buscar previsões existentes
  const existentes = await getComissoesPrevistasByPolicy(policy.id)
  const recebimentos = await pb
    .collection('comissao_recebimentos')
    .getFullList<ComissaoRecebimento>({
      filter: `policy = "${policy.id}"`,
    })

  // Mapear por chave estável para idempotência sem apagar dados à toa:
  // prev_{policy}_{parcela}_{competencia}
  const existingByKey = new Map<string, ComissaoPrevista>()
  for (const p of existentes) {
    const compClean = (p.competencia || '').replace('/', '_')
    const k = p.chave_estavel || `prev_${p.policy}_${p.parcela_numero || 1}_${compClean}`
    existingByKey.set(k, p)
  }

  // Identificar chaves calculadas para saber se alguma previsão não vinculada e pendente sobrou
  const calculatedKeys = new Set<string>()

  // 3. Inserir ou atualizar com idempotência
  const resultado: ComissaoPrevista[] = []
  for (const item of itensCalculados) {
    const compClean = (item.competencia || '').replace('/', '_')
    const stableKey = `prev_${policy.id}_${item.parcela_numero || 1}_${compClean}`
    calculatedKeys.add(stableKey)

    const jaExiste =
      existingByKey.get(stableKey) ||
      existentes.find(
        (e) =>
          e.chave_estavel === stableKey ||
          (e.parcela_numero === item.parcela_numero && e.competencia === item.competencia),
      )

    if (jaExiste) {
      // Se já existe e está Pendente, pode apenas sincronizar valores se necessário, sem apagar
      if (jaExiste.status === 'Pendente') {
        const precisaAtualizar =
          jaExiste.valor_previsto !== item.valor_previsto ||
          jaExiste.data_prevista !== item.data_prevista ||
          !jaExiste.chave_estavel

        if (precisaAtualizar) {
          try {
            const updated = await pb
              .collection('comissoes_previstas')
              .update<ComissaoPrevista>(jaExiste.id, {
                valor_previsto: item.valor_previsto,
                data_prevista: item.data_prevista,
                chave_estavel: stableKey,
                origem_modelo: item.origem_modelo,
              })
            resultado.push(updated)
            continue
          } catch {
            /* intentionally ignored */
          }
        }
      }
      resultado.push(jaExiste)
      continue
    }

    // Criar nova previsão com chave_estavel
    const payload = {
      policy: policy.id,
      competencia: item.competencia,
      data_prevista: item.data_prevista,
      valor_previsto: item.valor_previsto,
      parcela_numero: item.parcela_numero,
      origem_modelo: item.origem_modelo,
      status: 'Pendente',
      observacao: item.observacao || '',
      chave_estavel: stableKey,
    }
    try {
      const rec = await pb.collection('comissoes_previstas').create<ComissaoPrevista>(payload)
      resultado.push(rec)
    } catch {
      // Se falhar por colisão de índice único, carregar existente
      try {
        const found = await pb
          .collection('comissoes_previstas')
          .getFirstListItem<ComissaoPrevista>(`chave_estavel = "${stableKey}"`)
        resultado.push(found)
      } catch {
        /* intentionally ignored */
      }
    }
  }

  // Previsões antigas que NÃO foram calculadas no novo modelo:
  // Apenas deletamos se forem estritamente PENDENTES, NÃO tiverem NENHUM recebimento vinculado
  // e NÃO forem vinculadas a um endosso (previsões de endosso têm seu próprio ciclo de vida!)
  for (const prev of existentes) {
    // Se a previsão pertence a um endosso, preserva sempre!
    if (prev.endorsement) {
      resultado.push(prev)
      continue
    }

    const compClean = (prev.competencia || '').replace('/', '_')
    const k = prev.chave_estavel || `prev_${prev.policy}_${prev.parcela_numero || 1}_${compClean}`
    if (!calculatedKeys.has(k)) {
      const temRecebimento = recebimentos.some((r) => r.comissao_prevista === prev.id)
      if (!temRecebimento && prev.status === 'Pendente') {
        try {
          await pb.collection('comissoes_previstas').delete(prev.id)
        } catch {
          /* intentionally ignored */
        }
      } else {
        // Preserva o histórico financeiro intacto
        resultado.push(prev)
      }
    }
  }

  return resultado
}
