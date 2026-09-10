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
  valor_liquido: number
  aliquota_imposto?: number
  origem?: string
  observacao?: string
  parcela?: number | null
  competencia?: string | null
  idempotency_key?: string
}

export const createComissaoRecebimento = async (
  data: CreateComissaoRecebimentoPayload,
): Promise<ComissaoRecebimento> => {
  const payload: Record<string, any> = {
    policy: data.policy,
    data_recebimento: formatDateForInput(data.data_recebimento),
    valor_bruto: Math.round(Number(data.valor_bruto) * 100) / 100,
    descontos_impostos: Math.round(Number(data.descontos_impostos || 0) * 100) / 100,
    valor_liquido: Math.round(Number(data.valor_liquido) * 100) / 100,
    origem: data.origem || 'Manual',
    observacao: data.observacao ? String(data.observacao).trim() : '',
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

  // Atualizar a apólice com a data do recebimento mais recente e refletir quitação se total atingir comissão prevista
  try {
    // Buscar todos os recebimentos desta apólice (incluindo o que acabamos de criar)
    const allRecs = await pb.collection('comissao_recebimentos').getFullList<ComissaoRecebimento>({
      filter: `policy = "${data.policy}"`,
    })
    const totalRecebido = allRecs.reduce(
      (sum, r) => sum + (Number(r.valor_liquido) || Number(r.valor_bruto) || 0),
      0,
    )
    const pol = await pb.collection('policies').getOne(data.policy)
    const comissaoPrevista =
      pol.commission != null
        ? Number(pol.commission)
        : Math.round(
            (((pol.valor_liquido || pol.premium_amount || 0) * (pol.commission_percent || 0)) /
              100) *
              100,
          ) / 100

    const quitada = comissaoPrevista > 0 ? totalRecebido >= comissaoPrevista : totalRecebido > 0

    await pb.collection('policies').update(data.policy, {
      comissao_recebida: quitada,
      data_recebimento_comissao: payload.data_recebimento,
    })
  } catch (err) {
    console.warn('Aviso: nao foi possivel atualizar status da apolice', err)
  }

  return rec
}

export const deleteComissaoRecebimento = async (id: string, policyId?: string) => {
  await pb.collection('comissao_recebimentos').delete(id)

  if (policyId) {
    try {
      const remaining = await pb
        .collection('comissao_recebimentos')
        .getFullList<ComissaoRecebimento>({ filter: `policy = "${policyId}"` })

      if (remaining.length === 0) {
        await pb.collection('policies').update(policyId, {
          comissao_recebida: false,
          data_recebimento_comissao: null,
        })
      } else {
        const totalRecebido = remaining.reduce(
          (sum, r) => sum + (Number(r.valor_liquido) || Number(r.valor_bruto) || 0),
          0,
        )
        const pol = await pb.collection('policies').getOne(policyId)
        const comissaoPrevista =
          pol.commission != null
            ? Number(pol.commission)
            : Math.round(
                (((pol.valor_liquido || pol.premium_amount || 0) * (pol.commission_percent || 0)) /
                  100) *
                  100,
              ) / 100
        const quitada = comissaoPrevista > 0 ? totalRecebido >= comissaoPrevista : totalRecebido > 0
        const lastRec = remaining.sort(
          (a, b) => new Date(b.data_recebimento).getTime() - new Date(a.data_recebimento).getTime(),
        )[0]

        await pb.collection('policies').update(policyId, {
          comissao_recebida: quitada,
          data_recebimento_comissao: lastRec?.data_recebimento || null,
        })
      }
    } catch (err) {
      console.warn('Aviso: erro ao reavaliar status da apolice apos exclusao de recebimento', err)
    }
  }
}
