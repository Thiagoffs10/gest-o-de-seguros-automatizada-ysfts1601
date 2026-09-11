import pb from '@/lib/pocketbase/client'
import { ComissaoRecebimento } from '@/types'
import { formatDateForInput } from '@/lib/utils'

export const getComissaoRecebimentos = async (
  filter?: string,
  sort = '-data_recebimento',
  expand = 'policy,policy.client,policy.seguradora,policy.parceiro',
): Promise<ComissaoRecebimento[]> => {
  return pb.collection('comissao_recebimentos').getFullList<ComissaoRecebimento>({
    filter,
    sort,
    expand,
  })
}

export const getComissaoRecebimentosByPolicy = async (
  policyId: string,
): Promise<ComissaoRecebimento[]> => {
  return pb.collection('comissao_recebimentos').getFullList<ComissaoRecebimento>({
    filter: `policy = "${policyId}"`,
    sort: '-data_recebimento',
    expand: 'policy',
  })
}

export interface CreateComissaoRecebimentoPayload {
  policy: string
  data_recebimento: string
  valor_bruto: number
  descontos_impostos?: number
  valor_liquido?: number
  aliquota_imposto?: number
  origem?: string
  observacao?: string
  parcela?: number | null
  competencia?: string | null
  idempotency_key?: string
  is_estorno?: boolean
  recebimento_original?: string | null
  motivo_estorno?: string
  comissao_prevista?: string | null
}

export interface UpdateComissaoRecebimentoPayload {
  data_recebimento?: string
  valor_bruto?: number
  descontos_impostos?: number
  valor_liquido?: number
  aliquota_imposto?: number
  origem?: string
  observacao?: string
  parcela?: number | null
  competencia?: string | null
  idempotency_key?: string
  editor_info?: string
}

/**
 * Recalcula o status `comissao_recebida` e a `data_recebimento_comissao` da apólice
 * baseado na soma dos valores BRUTOS recebidos em comissao_recebimentos.
 * Regra: comissao_recebida = true quando total BRUTO recebido >= comissão prevista bruta.
 */
export const recalcularStatusApolice = async (policyId: string) => {
  try {
    const allRecs = await pb.collection('comissao_recebimentos').getFullList<ComissaoRecebimento>({
      filter: `policy = "${policyId}"`,
      sort: '-data_recebimento',
    })

    if (allRecs.length === 0) {
      await pb.collection('policies').update(policyId, {
        comissao_recebida: false,
        data_recebimento_comissao: null,
      })
      return { totalBrutoRecebido: 0, totalLiquidoRecebido: 0, quitada: false }
    }

    // Regra correta: Já recebido = soma dos valores BRUTOS recebidos
    const totalBrutoRecebido =
      Math.round(allRecs.reduce((sum, r) => sum + (Number(r.valor_bruto) || 0), 0) * 100) / 100

    const totalLiquidoRecebido =
      Math.round(
        allRecs.reduce(
          (sum, r) =>
            sum + (r.valor_liquido != null ? Number(r.valor_liquido) : Number(r.valor_bruto) || 0),
          0,
        ) * 100,
      ) / 100

    const pol = await pb.collection('policies').getOne(policyId)
    const comissaoPrevista =
      pol.commission != null
        ? Number(pol.commission)
        : Math.round(
            (((pol.valor_liquido || pol.premium_amount || 0) * (pol.commission_percent || 0)) /
              100) *
              100,
          ) / 100

    // Comissao recebida vira true quando a soma dos BRUTOS atingir ou superar a comissão prevista bruta
    const quitada =
      comissaoPrevista > 0 ? totalBrutoRecebido >= comissaoPrevista - 0.009 : totalBrutoRecebido > 0

    // Data mais recente de recebimento
    const lastRec = allRecs[0]

    await pb.collection('policies').update(policyId, {
      comissao_recebida: quitada,
      data_recebimento_comissao: lastRec?.data_recebimento
        ? formatDateForInput(lastRec.data_recebimento)
        : null,
    })

    return { totalBrutoRecebido, totalLiquidoRecebido, quitada }
  } catch (err) {
    console.warn('Aviso: erro ao recalcular status da apolice', err)
    return null
  }
}

export const createComissaoRecebimento = async (
  data: CreateComissaoRecebimentoPayload,
): Promise<ComissaoRecebimento> => {
  // Regra crítica 6: Para novos recebimentos manuais, exigir data de recebimento válida
  if (!data.data_recebimento || String(data.data_recebimento).trim() === '') {
    throw new Error('A data de recebimento é obrigatória para registrar a comissão.')
  }

  const bruto = Math.round(Number(data.valor_bruto) * 100) / 100
  if (isNaN(bruto)) {
    throw new Error('O valor da comissão informado é inválido.')
  }
  if (!data.is_estorno && bruto <= 0) {
    throw new Error('O valor bruto da comissão deve ser maior que zero.')
  }
  if (data.is_estorno && bruto >= 0) {
    throw new Error('O valor de estorno deve ser lançado como valor negativo.')
  }

  const descontos = Math.round(Number(data.descontos_impostos || 0) * 100) / 100
  const liquido =
    data.valor_liquido !== undefined
      ? Math.round(Number(data.valor_liquido) * 100) / 100
      : data.is_estorno
        ? Math.round((bruto - descontos) * 100) / 100
        : Math.round(Math.max(0, bruto - descontos) * 100) / 100

  // Auditoria do usuário responsável e data/hora da ação
  const currentUser = pb.authStore.record
  const userAuditoria = currentUser
    ? `${currentUser.name || currentUser.email || currentUser.id}`
    : 'Sistema'
  const auditoriaTag = `[Recebido em ${new Date().toLocaleString('pt-BR')} por ${userAuditoria}]`

  let obs = data.observacao ? String(data.observacao).trim() : ''
  if (!obs.includes(auditoriaTag)) {
    obs = obs ? `${obs} ${auditoriaTag}` : auditoriaTag
  }

  const payload: Record<string, any> = {
    policy: data.policy,
    data_recebimento: formatDateForInput(data.data_recebimento),
    valor_bruto: bruto,
    descontos_impostos: descontos,
    valor_liquido: liquido,
    origem: data.origem || 'Manual',
    observacao: obs,
    is_estorno: Boolean(data.is_estorno),
  }

  if (data.recebimento_original) {
    payload.recebimento_original = data.recebimento_original
  }
  if (data.motivo_estorno) {
    payload.motivo_estorno = data.motivo_estorno.trim()
  }
  if (data.comissao_prevista) {
    payload.comissao_prevista = data.comissao_prevista
  }

  if (data.aliquota_imposto !== undefined && data.aliquota_imposto !== null) {
    payload.aliquota_imposto = Number(data.aliquota_imposto)
  }
  if (data.parcela !== undefined && data.parcela !== null) {
    payload.parcela = Number(data.parcela)
  }
  if (data.competencia) {
    payload.competencia = String(data.competencia).trim()
  }
  if (data.idempotency_key) {
    payload.idempotency_key = String(data.idempotency_key).trim()
  }

  const rec = await pb.collection('comissao_recebimentos').create<ComissaoRecebimento>(payload)

  // Recalcular status da apólice
  await recalcularStatusApolice(data.policy)

  return rec
}

export const updateComissaoRecebimento = async (
  id: string,
  data: UpdateComissaoRecebimentoPayload,
): Promise<ComissaoRecebimento> => {
  // Buscar o registro atual para saber a apólice e valores existentes
  const current = await pb.collection('comissao_recebimentos').getOne<ComissaoRecebimento>(id)

  const payload: Record<string, any> = {}

  if (data.data_recebimento !== undefined) {
    if (!data.data_recebimento || String(data.data_recebimento).trim() === '') {
      throw new Error('A data de recebimento não pode ser vazia.')
    }
    payload.data_recebimento = formatDateForInput(data.data_recebimento)
  }

  const bruto =
    data.valor_bruto !== undefined
      ? Math.round(Number(data.valor_bruto) * 100) / 100
      : Number(current.valor_bruto)

  const descontos =
    data.descontos_impostos !== undefined
      ? Math.round(Number(data.descontos_impostos || 0) * 100) / 100
      : Number(current.descontos_impostos || 0)

  if (data.valor_bruto !== undefined) {
    payload.valor_bruto = bruto
  }
  if (data.descontos_impostos !== undefined) {
    payload.descontos_impostos = descontos
  }

  if (data.valor_liquido !== undefined) {
    payload.valor_liquido = Math.round(Number(data.valor_liquido) * 100) / 100
  } else if (data.valor_bruto !== undefined || data.descontos_impostos !== undefined) {
    payload.valor_liquido = Math.round(Math.max(0, bruto - descontos) * 100) / 100
  }

  if (data.aliquota_imposto !== undefined) {
    payload.aliquota_imposto = Number(data.aliquota_imposto)
  }
  if (data.parcela !== undefined) {
    payload.parcela = data.parcela !== null ? Number(data.parcela) : null
  }
  if (data.competencia !== undefined) {
    payload.competencia = data.competencia ? String(data.competencia).trim() : ''
  }
  if (data.origem !== undefined) {
    payload.origem = data.origem
  }

  // Rastreabilidade de edição técnica na observação
  let obs =
    data.observacao !== undefined ? String(data.observacao).trim() : current.observacao || ''
  if (data.editor_info) {
    const editTag = `[Editado em ${new Date().toLocaleString('pt-BR')}${data.editor_info ? ` por ${data.editor_info}` : ''}]`
    // Evita duplicar tags idênticas se já existir
    if (!obs.includes(editTag)) {
      obs = obs ? `${obs} ${editTag}` : editTag
    }
  }
  if (data.observacao !== undefined || data.editor_info) {
    payload.observacao = obs
  }

  if (data.idempotency_key) {
    payload.idempotency_key = String(data.idempotency_key).trim()
  }

  const updatedRec = await pb
    .collection('comissao_recebimentos')
    .update<ComissaoRecebimento>(id, payload)

  // Recalcular apólice vinculada
  const policyId = current.policy
  if (policyId) {
    await recalcularStatusApolice(policyId)
  }

  return updatedRec
}

export interface RegistrarEstornoPayload {
  recebimento_original_id: string
  valor_estorno: number // valor positivo a ser estornado (será negativado no banco)
  data_estorno: string
  motivo: string
}

/**
 * Registra um Estorno de recebimento de comissão.
 * Regra: NUNCA apagar o recebimento original.
 * O estorno é registrado como um novo lançamento com valor NEGATIVO em comissao_recebimentos,
 * vinculado ao recebimento_original, preservando histórico e rastreabilidade total (usuário, data, motivo).
 */
export const registrarEstornoComissao = async (
  payload: RegistrarEstornoPayload,
): Promise<ComissaoRecebimento> => {
  if (!payload.recebimento_original_id) {
    throw new Error('O recebimento original é obrigatório para registrar o estorno.')
  }
  const valorPositivo = Math.abs(Number(payload.valor_estorno))
  if (isNaN(valorPositivo) || valorPositivo <= 0) {
    throw new Error('Informe um valor de estorno válido maior que zero.')
  }
  if (!payload.motivo || payload.motivo.trim() === '') {
    throw new Error('O motivo do estorno é obrigatório para auditoria.')
  }
  if (!payload.data_estorno || payload.data_estorno.trim() === '') {
    throw new Error('A data do estorno é obrigatória.')
  }

  // 1. Carregar recebimento original
  const original = await pb
    .collection('comissao_recebimentos')
    .getOne<ComissaoRecebimento>(payload.recebimento_original_id)

  const originalBruto = Number(original.valor_bruto) || 0

  // 2. Buscar outros estornos já feitos para este recebimento
  const outrosEstornos = await pb
    .collection('comissao_recebimentos')
    .getFullList<ComissaoRecebimento>({
      filter: `recebimento_original = "${original.id}"`,
    })
  const jaEstornado = Math.abs(
    outrosEstornos.reduce((acc, est) => acc + (Number(est.valor_bruto) || 0), 0),
  )

  const saldoDisponivelParaEstorno = Math.max(
    0,
    Math.round((originalBruto - jaEstornado) * 100) / 100,
  )
  if (valorPositivo > saldoDisponivelParaEstorno + 0.009) {
    throw new Error(
      `O valor de estorno (R$ ${valorPositivo.toFixed(2)}) não pode exceder o saldo restante deste recebimento (R$ ${saldoDisponivelParaEstorno.toFixed(2)}).`,
    )
  }

  // 3. Proporcional de imposto se houver
  const aliq = Number(original.aliquota_imposto || 0)
  const descImpostoEstorno = aliq > 0 ? Math.round(((valorPositivo * aliq) / 100) * 100) / 100 : 0

  const valorBrutoNegativo = -Math.abs(valorPositivo)
  const valorLiquidoNegativo = -Math.abs(
    Math.round((valorPositivo - descImpostoEstorno) * 100) / 100,
  )

  const currentUser = pb.authStore.record
  const userAuditoria = currentUser
    ? `${currentUser.name || currentUser.email || currentUser.id}`
    : 'Sistema'

  const idempotencyKey = `est_${original.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

  return createComissaoRecebimento({
    policy: original.policy,
    data_recebimento: payload.data_estorno,
    valor_bruto: valorBrutoNegativo,
    descontos_impostos: -descImpostoEstorno,
    valor_liquido: valorLiquidoNegativo,
    aliquota_imposto: aliq,
    origem: 'Estorno',
    observacao: `[Estorno ref. recebimento ${original.id}]: ${payload.motivo.trim()} [Responsável: ${userAuditoria}]`,
    parcela: original.parcela,
    competencia: original.competencia,
    idempotency_key: idempotencyKey,
    is_estorno: true,
    recebimento_original: original.id,
    motivo_estorno: payload.motivo.trim(),
    comissao_prevista: original.comissao_prevista || null,
  })
}

export const deleteComissaoRecebimento = async (id: string, policyId?: string) => {
  // Se não foi fornecido policyId, descobre antes de deletar
  let targetPolicyId = policyId
  if (!targetPolicyId) {
    try {
      const rec = await pb.collection('comissao_recebimentos').getOne<ComissaoRecebimento>(id)
      targetPolicyId = rec.policy
    } catch (_) {
      // continua
    }
  }

  await pb.collection('comissao_recebimentos').delete(id)

  if (targetPolicyId) {
    await recalcularStatusApolice(targetPolicyId)
  }
}
