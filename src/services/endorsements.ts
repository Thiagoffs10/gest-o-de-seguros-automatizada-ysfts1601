import pb from '@/lib/pocketbase/client'
import {
  Endorsement,
  Policy,
  ComissaoPrevista,
  ComissaoRecebimento,
  EndorsementFinancialStatus,
} from '@/types'
import { formatDateForInput } from '@/lib/utils'
import { addMonthsToDateWithClamp } from '@/services/comissao-engine'
import {
  createComissaoRecebimento,
  recalcularStatusApolice,
} from '@/services/comissao-recebimentos'

export const getEndorsementsByPolicy = async (policyId: string): Promise<Endorsement[]> => {
  return pb.collection('endorsements').getFullList<Endorsement>({
    filter: `policy = "${policyId}"`,
    sort: '-data_endosso,-created',
  })
}

export const getEndorsement = async (id: string): Promise<Endorsement> => {
  return pb.collection('endorsements').getOne<Endorsement>(id, {
    expand: 'policy',
  })
}

export interface CreateEndorsementPayload {
  policy: string
  tipo: string
  data_endosso: string
  numero_proposta?: string
  placa?: string
  chassi?: string
  modelo_veiculo?: string
  valor_bruto?: number
  valor_liquido?: number
  observacao?: string
}

export interface UpdateEndorsementPayload {
  tipo?: string
  data_endosso?: string
  numero_proposta?: string
  placa?: string
  chassi?: string
  modelo_veiculo?: string
  valor_bruto?: number
  valor_liquido?: number
  observacao?: string
}

/**
 * Deriva o status financeiro do endosso a partir das movimentações reais
 */
export function computeEndorsementFinancialStatus(
  endorsement: Endorsement,
  previsoes: ComissaoPrevista[],
  recebimentos: ComissaoRecebimento[],
): EndorsementFinancialStatus {
  const liquido = Number(endorsement.valor_liquido || 0)
  if (liquido === 0) {
    return 'Sem impacto financeiro'
  }

  // Endosso negativo: gera ajuste/estorno de comissão
  if (liquido < 0) {
    const estornosDoEndosso = recebimentos.filter(
      (r) =>
        r.endorsement === endorsement.id ||
        (r.is_estorno && r.observacao?.includes(endorsement.id)),
    )
    if (estornosDoEndosso.length > 0) {
      return 'Estornado / Ajustado'
    }
    return 'Pendente'
  }

  // Endosso positivo: verifica a previsão vinculada ao endosso
  const prev = previsoes.find((p) => p.endorsement === endorsement.id)
  if (!prev) {
    // Se não encontrou previsão direta, busca por recebimento vinculado
    const recs = recebimentos.filter((r) => r.endorsement === endorsement.id)
    if (recs.length > 0) {
      return 'Recebido'
    }
    return 'Pendente'
  }

  // Previsão existe: verificar recebimentos vinculados
  const recs = recebimentos.filter(
    (r) => r.endorsement === endorsement.id || r.comissao_prevista === prev.id,
  )
  const totalRecebido =
    Math.round(recs.reduce((sum, r) => sum + (Number(r.valor_bruto) || 0), 0) * 100) / 100
  const valorPrevisto = Number(prev.valor_previsto || 0)

  if (totalRecebido >= valorPrevisto - 0.009 && valorPrevisto > 0) {
    return 'Recebido'
  }
  if (totalRecebido > 0) {
    return 'Parcialmente recebido'
  }
  return 'Pendente'
}

/**
 * Cria um endosso e orquestra seus impactos na arquitetura financeira existente:
 * 1. Salva registro na collection endorsements
 * 2. Se valor_liquido > 0: calcula comissão pelo motor da apólice e cria comissao_prevista com chave estável idempotente
 * 3. Se valor_liquido == 0: histórico operacional, NÃO cria previsão
 * 4. Se valor_liquido < 0: lança ajuste/estorno proporcional em comissao_recebimentos (NUNCA recebimento negativo)
 */
export async function createEndorsement(data: CreateEndorsementPayload): Promise<Endorsement> {
  if (!data.policy) {
    throw new Error('A apólice de origem é obrigatória para o endosso.')
  }
  if (!data.tipo || data.tipo.trim() === '') {
    throw new Error('O tipo de endosso é obrigatório.')
  }
  if (!data.data_endosso) {
    throw new Error('A data do endosso é obrigatória.')
  }

  // Carregar apólice original
  const policy = await pb.collection('policies').getOne<Policy>(data.policy)

  const vBruto =
    data.valor_bruto !== undefined ? Math.round(Number(data.valor_bruto) * 100) / 100 : 0
  const vLiquido =
    data.valor_liquido !== undefined ? Math.round(Number(data.valor_liquido) * 100) / 100 : 0
  const commPercent = Number(policy.commission_percent || 0)
  const commValor = Math.round(((vLiquido * commPercent) / 100) * 100) / 100

  const payload: Record<string, any> = {
    policy: policy.id,
    tipo: data.tipo.trim(),
    data_endosso: formatDateForInput(data.data_endosso),
    numero_proposta: data.numero_proposta ? data.numero_proposta.trim() : '',
    placa: data.placa ? data.placa.trim().toUpperCase() : '',
    chassi: data.chassi ? data.chassi.trim().toUpperCase() : '',
    modelo_veiculo: data.modelo_veiculo ? data.modelo_veiculo.trim() : '',
    valor_bruto: vBruto,
    valor_liquido: vLiquido,
    comissao_percent: commPercent,
    comissao_valor: commValor,
    observacao: data.observacao ? data.observacao.trim() : '',
  }

  const endorsement = await pb.collection('endorsements').create<Endorsement>(payload)

  // Impacto Financeiro Reutilizando a Arquitetura Existente
  const dataFormatada =
    formatDateForInput(data.data_endosso) || new Date().toISOString().split('T')[0]
  const { comp } = addMonthsToDateWithClamp(dataFormatada, 0)

  if (vLiquido > 0 && commValor > 0) {
    // 1. ENDOSSO POSITIVO: Criar comissao_prevista própria e identificável
    const stableKey = `prev_end_${endorsement.id}_1_${comp.replace('/', '_')}`
    const obsPrev = `Endosso (${endorsement.tipo || 'Alteração'}) — ${commPercent}% sobre líq. R$ ${vLiquido.toFixed(2)}`

    try {
      await pb.collection('comissoes_previstas').create<ComissaoPrevista>({
        policy: policy.id,
        competencia: comp,
        data_prevista: dataFormatada,
        valor_previsto: commValor,
        parcela_numero: 1,
        origem_modelo: `Endosso: ${endorsement.tipo}`,
        status: 'Pendente',
        observacao: obsPrev,
        chave_estavel: stableKey,
        endorsement: endorsement.id,
      })
    } catch (err) {
      console.warn('Possível colisão ou aviso ao criar comissão prevista de endosso:', err)
    }
  } else if (vLiquido < 0 && commValor < 0) {
    // 2. ENDOSSO NEGATIVO: Ajuste/estorno de comissão conforme arquitetura existente
    // Lançar ajuste de estorno em comissao_recebimentos com valor negativo explícito
    const valorEstornoPositivo = Math.abs(commValor)
    const idempotencyKey = `end_est_${endorsement.id}_${Date.now()}`

    try {
      await createComissaoRecebimento({
        policy: policy.id,
        data_recebimento: dataFormatada,
        valor_bruto: -valorEstornoPositivo,
        descontos_impostos: 0,
        valor_liquido: -valorEstornoPositivo,
        aliquota_imposto: 0,
        origem: 'Ajuste de Endosso',
        observacao: `[Ajuste de Endosso ${endorsement.tipo} ref. ${endorsement.id}]: Redução de comissão por devolução de prêmio (líq. R$ ${vLiquido.toFixed(2)})`,
        competencia: comp,
        is_estorno: true,
        motivo_estorno: `Endosso negativo: ${endorsement.tipo}`,
        endorsement: endorsement.id,
        idempotency_key: idempotencyKey,
      })
    } catch (err) {
      console.warn('Aviso ao registrar ajuste de endosso negativo:', err)
    }
  }
  // 3. ENDOSSO ZERO: Registro operacional no histórico, nenhuma previsão criada

  return endorsement
}

/**
 * Atualiza um endosso existente com checagem de integridade:
 * Se o endosso já tiver recebimentos vinculados, valores financeiros não podem ser alterados sem aviso
 */
export async function updateEndorsement(
  id: string,
  data: UpdateEndorsementPayload,
): Promise<Endorsement> {
  const current = await pb.collection('endorsements').getOne<Endorsement>(id)

  // Verificar se há recebimentos vinculados
  const recs = await pb.collection('comissao_recebimentos').getFullList<ComissaoRecebimento>({
    filter: `endorsement = "${id}"`,
  })
  const temRecebimentos = recs.some((r) => !r.is_estorno && (Number(r.valor_bruto) || 0) > 0)

  if (
    temRecebimentos &&
    data.valor_liquido !== undefined &&
    Number(data.valor_liquido) !== Number(current.valor_liquido)
  ) {
    throw new Error(
      'Não é permitido alterar os valores financeiros deste endosso porque já existem recebimentos de comissão efetivados.',
    )
  }

  const payload: Record<string, any> = {}
  if (data.tipo !== undefined) payload.tipo = data.tipo.trim()
  if (data.data_endosso !== undefined) payload.data_endosso = formatDateForInput(data.data_endosso)
  if (data.numero_proposta !== undefined) payload.numero_proposta = data.numero_proposta.trim()
  if (data.placa !== undefined) payload.placa = data.placa.trim().toUpperCase()
  if (data.chassi !== undefined) payload.chassi = data.chassi.trim().toUpperCase()
  if (data.modelo_veiculo !== undefined) payload.modelo_veiculo = data.modelo_veiculo.trim()
  if (data.observacao !== undefined) payload.observacao = data.observacao.trim()

  if (data.valor_bruto !== undefined) {
    payload.valor_bruto = Math.round(Number(data.valor_bruto) * 100) / 100
  }

  if (data.valor_liquido !== undefined) {
    const vLiq = Math.round(Number(data.valor_liquido) * 100) / 100
    payload.valor_liquido = vLiq
    const commPct = Number(current.comissao_percent || 0)
    const commVal = Math.round(((vLiq * commPct) / 100) * 100) / 100
    payload.comissao_valor = commVal

    // Sincronizar com a comissão prevista correspondente caso exista e esteja Pendente
    const prevs = await pb.collection('comissoes_previstas').getFullList<ComissaoPrevista>({
      filter: `endorsement = "${id}"`,
    })
    for (const prev of prevs) {
      if (prev.status === 'Pendente') {
        await pb.collection('comissoes_previstas').update(prev.id, {
          valor_previsto: commVal,
        })
      }
    }
  }

  return pb.collection('endorsements').update<Endorsement>(id, payload)
}

/**
 * Exclui um endosso com bloqueio de integridade se houver movimentação financeira recebida
 */
export async function deleteEndorsement(id: string): Promise<boolean> {
  const current = await pb.collection('endorsements').getOne<Endorsement>(id)

  // 1. Verificar se há comissões recebidas ou estornos para este endosso
  const recs = await pb.collection('comissao_recebimentos').getFullList<ComissaoRecebimento>({
    filter: `endorsement = "${id}"`,
  })

  const prevs = await pb.collection('comissoes_previstas').getFullList<ComissaoPrevista>({
    filter: `endorsement = "${id}"`,
  })

  // Se houver algum recebimento vinculado ao endosso ou à previsão do endosso
  const temRecebimentosDiretos = recs.length > 0
  const temRecebimentosPrevisao = prevs.some(
    (p) => p.status === 'Recebida' || p.status === 'Parcial',
  )

  if (temRecebimentosDiretos || temRecebimentosPrevisao) {
    throw new Error(
      'Este endosso não pode ser excluído pois possui movimentações financeiras (recebimento ou ajuste) efetivadas no sistema.',
    )
  }

  // 2. Remover previsões estritamente pendentes do endosso
  for (const prev of prevs) {
    if (prev.status === 'Pendente') {
      try {
        await pb.collection('comissoes_previstas').delete(prev.id)
      } catch {
        /* intentionally ignored */
      }
    }
  }

  // 3. Excluir o endosso
  await pb.collection('endorsements').delete(id)

  // 4. Recalcular apólice
  if (current.policy) {
    await recalcularStatusApolice(current.policy)
  }

  return true
}

/**
 * Retorna os dados vigentes do veículo (veículo original se nenhum endosso, ou o mais recente)
 */
export function getVeiculoVigente(
  policy: Policy,
  endorsements: Endorsement[],
): {
  placa?: string
  chassi?: string
  modelo_veiculo?: string
  origem: string
} {
  const vehicleEndorsements = endorsements
    .filter((e) => Boolean(e.placa || e.modelo_veiculo || e.chassi))
    .sort((a, b) => (b.data_endosso || '').localeCompare(a.data_endosso || ''))

  if (vehicleEndorsements.length > 0) {
    const latest = vehicleEndorsements[0]
    return {
      placa: latest.placa || policy.placa,
      chassi: latest.chassi || policy.chassi,
      modelo_veiculo: latest.modelo_veiculo || policy.modelo_veiculo,
      origem: `Endosso (${latest.tipo} - ${latest.data_endosso ? new Date(latest.data_endosso).toLocaleDateString('pt-BR') : ''})`,
    }
  }

  return {
    placa: policy.placa,
    chassi: policy.chassi,
    modelo_veiculo: policy.modelo_veiculo,
    origem: 'Apólice original',
  }
}
