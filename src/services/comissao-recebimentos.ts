import pb from '@/lib/pocketbase/client'
import { ComissaoRecebimento } from '@/types'
import { formatDateForInput, extractDateOnly } from '@/lib/utils'

export interface ComissaoPrevistaSimples {
  id: string
  policy: string
  competencia?: string | null
  valor_previsto?: number
  parcela_numero?: number
  data_prevista?: string
  origem_modelo?: string
  status?: string
  endorsement?: string | null
}

export interface ReconciliacaoPrevisaoResult {
  previsaoId: string
  valorPrevisto: number
  valorRecebidoBruto: number
  valorRecebidoLiquido: number
  saldo: number
  status: 'Pendente' | 'Parcial' | 'Recebida' | 'Cancelada'
  recebimentosVinculados: ComissaoRecebimento[]
}

/**
 * Infere a competência (MM/YYYY) a partir da data de recebimento quando competencia não estiver gravada.
 * Ex: '2026-09-11' -> '09/2026'
 */
export function inferirCompetenciaRecebimento(dataRecebimento?: string | null): string {
  if (!dataRecebimento) return ''
  const dateOnly = extractDateOnly(dataRecebimento)
  if (!dateOnly || !dateOnly.includes('-')) return ''
  const parts = dateOnly.split('-')
  if (parts.length >= 2) {
    const y = parts[0]
    const m = parts[1].padStart(2, '0')
    return `${m}/${y}`
  }
  return ''
}

/**
 * Helper centralizado de reconciliação de recebimentos com previsões de comissão.
 *
 * REGRAS CRÍTICAS DE NEGÓCIO:
 * 1. Vínculo Direto: Se o recebimento tiver `comissao_prevista` preenchido com o ID da previsão, vincula diretamente.
 * 2. Inferência de Competência por Data: Quando `comissao_prevista` e `competencia` estiverem vazios no recebimento,
 *    infere a competência pela data do recebimento (ex: 2026-09-11 -> 09/2026) e vincula à previsão da mesma policy
 *    e mesma competência.
 * 3. Fallback FIFO (Por Saldo/Esgotamento ou competências em aberto): Caso o recebimento não tenha previsão vinculada
 *    e não encontre previsão de mesma competência exata, aloca em ordem FIFO sobre as previsões abertas da apólice
 *    (mais antiga primeiro, ordenadas por data_prevista ou parcela_numero).
 * 4. Não altera registros históricos nem duplica previsões.
 *
 * Retorna um Map<string, ReconciliacaoPrevisaoResult> indexado pelo ID da previsão.
 */
export function reconciliarRecebimentosComPrevisoes(
  prevs: ComissaoPrevistaSimples[],
  allRecs: ComissaoRecebimento[],
): Map<string, ReconciliacaoPrevisaoResult> {
  const result = new Map<string, ReconciliacaoPrevisaoResult>()

  // Inicializa mapa de resultados
  for (const p of prevs) {
    const vPrevisto = Number(p.valor_previsto) || 0
    result.set(p.id, {
      previsaoId: p.id,
      valorPrevisto: vPrevisto,
      valorRecebidoBruto: 0,
      valorRecebidoLiquido: 0,
      saldo: vPrevisto,
      status: p.status === 'Cancelada' ? 'Cancelada' : 'Pendente',
      recebimentosVinculados: [],
    })
  }

  // Agrupar previsões por apólice para alocação restrita à mesma apólice
  const prevsByPolicy = new Map<string, ComissaoPrevistaSimples[]>()
  for (const p of prevs) {
    if (!prevsByPolicy.has(p.policy)) {
      prevsByPolicy.set(p.policy, [])
    }
    prevsByPolicy.get(p.policy)!.push(p)
  }

  // Ordenar previsões de cada apólice cronologicamente para uso seguro no FIFO
  for (const polPrevs of prevsByPolicy.values()) {
    polPrevs.sort((a, b) => {
      const dA = a.data_prevista || ''
      const dB = b.data_prevista || ''
      if (dA && dB && dA !== dB) return dA.localeCompare(dB)
      const pA = a.parcela_numero || 0
      const pB = b.parcela_numero || 0
      return pA - pB
    })
  }

  // Rastrear saldo restante de cada previsão durante a alocação
  const saldoRestantePrevisao = new Map<string, number>()
  for (const p of prevs) {
    saldoRestantePrevisao.set(p.id, Number(p.valor_previsto) || 0)
  }

  // Conjunto de recebimentos alocados
  const allocatedRecIds = new Set<string>()

  // PASSO 1: Vínculo DIRETO por ID (comissao_prevista)
  for (const r of allRecs) {
    if (r.comissao_prevista && result.has(r.comissao_prevista)) {
      const entry = result.get(r.comissao_prevista)!
      const bruto = Number(r.valor_bruto) || 0
      const liquido = r.valor_liquido != null ? Number(r.valor_liquido) : bruto
      entry.valorRecebidoBruto = Math.round((entry.valorRecebidoBruto + bruto) * 100) / 100
      entry.valorRecebidoLiquido = Math.round((entry.valorRecebidoLiquido + liquido) * 100) / 100
      entry.recebimentosVinculados.push(r)
      allocatedRecIds.add(r.id)

      const sAtual = saldoRestantePrevisao.get(r.comissao_prevista) || 0
      saldoRestantePrevisao.set(
        r.comissao_prevista,
        Math.max(0, Math.round((sAtual - bruto) * 100) / 100),
      )
    }
  }

  // PASSO 2: Vínculo por Competência Exata ou Inferida pela Data do Recebimento
  // Para recebimentos que ainda não foram alocados
  for (const r of allRecs) {
    if (allocatedRecIds.has(r.id)) continue

    const polPrevs = prevsByPolicy.get(r.policy) || []
    if (polPrevs.length === 0) continue

    // Competência original ou inferida pela data_recebimento
    const compRec =
      r.competencia && r.competencia.trim() !== ''
        ? r.competencia.trim()
        : inferirCompetenciaRecebimento(r.data_recebimento)

    if (compRec) {
      // Buscar primeira previsão com a mesma competência que ainda tenha saldo ou que corresponda
      const matchedPrev =
        polPrevs.find((p) => {
          if (!p.competencia) return false
          return p.competencia.trim() === compRec && (saldoRestantePrevisao.get(p.id) || 0) > 0.009
        }) || polPrevs.find((p) => p.competencia && p.competencia.trim() === compRec)

      if (matchedPrev) {
        const entry = result.get(matchedPrev.id)!
        const bruto = Number(r.valor_bruto) || 0
        const liquido = r.valor_liquido != null ? Number(r.valor_liquido) : bruto
        entry.valorRecebidoBruto = Math.round((entry.valorRecebidoBruto + bruto) * 100) / 100
        entry.valorRecebidoLiquido = Math.round((entry.valorRecebidoLiquido + liquido) * 100) / 100
        entry.recebimentosVinculados.push(r)
        allocatedRecIds.add(r.id)

        const sAtual = saldoRestantePrevisao.get(matchedPrev.id) || 0
        saldoRestantePrevisao.set(
          matchedPrev.id,
          Math.max(0, Math.round((sAtual - bruto) * 100) / 100),
        )
      }
    }
  }

  // PASSO 3: Fallback FIFO para recebimentos restantes da apólice
  // (Aplicável para modelo "Por saldo/esgotamento" ou quando não houver correspondência exata de competência)
  for (const r of allRecs) {
    if (allocatedRecIds.has(r.id)) continue

    const polPrevs = prevsByPolicy.get(r.policy) || []
    if (polPrevs.length === 0) continue

    // Encontrar primeira previsão aberta com saldo restante > 0
    const targetPrev =
      polPrevs.find((p) => (saldoRestantePrevisao.get(p.id) || 0) > 0.009) || polPrevs[0]

    if (targetPrev) {
      const entry = result.get(targetPrev.id)!
      const bruto = Number(r.valor_bruto) || 0
      const liquido = r.valor_liquido != null ? Number(r.valor_liquido) : bruto
      entry.valorRecebidoBruto = Math.round((entry.valorRecebidoBruto + bruto) * 100) / 100
      entry.valorRecebidoLiquido = Math.round((entry.valorRecebidoLiquido + liquido) * 100) / 100
      entry.recebimentosVinculados.push(r)
      allocatedRecIds.add(r.id)

      const sAtual = saldoRestantePrevisao.get(targetPrev.id) || 0
      saldoRestantePrevisao.set(
        targetPrev.id,
        Math.max(0, Math.round((sAtual - bruto) * 100) / 100),
      )
    }
  }

  // Atualizar saldos finais e status de cada previsão
  for (const p of prevs) {
    const entry = result.get(p.id)!
    const vPrev = entry.valorPrevisto
    const recBruto = entry.valorRecebidoBruto
    const saldo = Math.max(0, Math.round((vPrev - recBruto) * 100) / 100)
    entry.saldo = saldo

    if (p.status === 'Cancelada') {
      entry.status = 'Cancelada'
    } else if (recBruto >= vPrev - 0.009 && vPrev > 0) {
      entry.status = 'Recebida'
    } else if (recBruto > 0) {
      entry.status = 'Parcial'
    } else {
      entry.status = 'Pendente'
    }
  }

  return result
}

export const getComissaoRecebimentos = async (
  filter?: string,
  sort = '-data_recebimento',
  expand = 'policy,policy.client,policy.seguradora,policy.parceiro,endorsement',
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
    expand: 'policy,endorsement',
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
  endorsement?: string | null
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

    // Sincronizar status das comissões previstas vinculadas (Pendente, Parcial, Recebida)
    // Usando helper centralizado de reconciliação (com suporte a vínculo direto, inferência por data e FIFO de esgotamento)
    try {
      const prevs = await pb
        .collection('comissoes_previstas')
        .getFullList<ComissaoPrevistaSimples>({
          filter: `policy = "${policyId}"`,
        })
      if (prevs.length > 0) {
        const reconciliacao = reconciliarRecebimentosComPrevisoes(prevs, allRecs)
        for (const p of prevs) {
          const recItem = reconciliacao.get(p.id)
          const novoStatus =
            recItem?.status || (p.status === 'Cancelada' ? 'Cancelada' : 'Pendente')

          if (p.status !== novoStatus) {
            await pb.collection('comissoes_previstas').update(p.id, { status: novoStatus })
          }
        }
      }
    } catch (_) {
      /* intentionally ignored */
    }

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
  // ITEM A: Validação no serviço: se informado comissao_prevista, garantir que não é vazio/inválido
  if (data.comissao_prevista && data.comissao_prevista.trim() !== '') {
    payload.comissao_prevista = data.comissao_prevista.trim()
  } else if (data.comissao_prevista === '') {
    throw new Error('O ID da comissão prevista não pode ser uma string vazia.')
  }

  if (data.endorsement && data.endorsement.trim() !== '') {
    payload.endorsement = data.endorsement.trim()
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
