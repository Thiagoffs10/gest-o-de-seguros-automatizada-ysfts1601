import pb from '@/lib/pocketbase/client'
import { ParceiroPagamento, ParceiroDebito, ParceiroDebitoItem } from '@/types'
import { todayLocalDate } from '@/lib/utils'

export const getParceiroPagamentos = async (parceiroId?: string): Promise<ParceiroPagamento[]> => {
  const filter = parceiroId && parceiroId !== 'all' ? `parceiro = "${parceiroId}"` : ''
  return pb.collection('parceiro_pagamentos').getFullList<ParceiroPagamento>({
    filter,
    sort: '-data_pagamento,-created',
    expand: 'parceiro',
  })
}

export const createParceiroPagamento = async (data: {
  parceiro: string
  data_pagamento: string
  total_comissoes: number
  total_debitos: number
  taxa_pix: number
  valor_liquido: number
  policies_ids?: string
  detalhes_debitos?: string
  observacoes?: string
  usuario_id?: string
  usuario_nome?: string
}): Promise<ParceiroPagamento> => {
  return pb.collection('parceiro_pagamentos').create<ParceiroPagamento>(data)
}

export const getParceiroDebitosPendentes = async (
  parceiroId?: string,
): Promise<ParceiroDebito[]> => {
  const filter =
    parceiroId && parceiroId !== 'all'
      ? `parceiro = "${parceiroId}" && (status = "Pendente" || status = "" || status = null)`
      : `status = "Pendente" || status = "" || status = null`
  return pb.collection('parceiro_debitos').getFullList<ParceiroDebito>({
    filter,
    sort: '-created',
    expand: 'parceiro',
  })
}

export const getDebitosPendentesPorParceiros = async (
  parceiroIds: string[],
): Promise<ParceiroDebito[]> => {
  if (!parceiroIds || parceiroIds.length === 0) return []
  const uniqueIds = Array.from(new Set(parceiroIds.filter(Boolean)))
  if (uniqueIds.length === 0) return []
  const filter = uniqueIds.map((id) => `parceiro = "${id}"`).join(' || ')
  return pb.collection('parceiro_debitos').getFullList<ParceiroDebito>({
    filter: `(${filter}) && (status = "Pendente" || status = "" || status = null)`,
    sort: '-created',
    expand: 'parceiro',
  })
}

export const createParceiroDebito = async (data: {
  parceiro: string
  descricao: string
  valor: number
  data?: string
  status?: 'Pendente' | 'Pago' | 'Cancelado'
}): Promise<ParceiroDebito> => {
  return pb.collection('parceiro_debitos').create<ParceiroDebito>({
    ...data,
    status: data.status || 'Pendente',
  })
}

export const updateParceiroDebito = async (
  id: string,
  data: Partial<ParceiroDebito>,
): Promise<ParceiroDebito> => {
  return pb.collection('parceiro_debitos').update<ParceiroDebito>(id, data)
}

export const deleteParceiroDebito = async (id: string): Promise<boolean> => {
  return pb.collection('parceiro_debitos').delete(id)
}

export interface FechamentoParceiroResult {
  success: boolean
  pagamento_id: string
  parceiro_id: string
  data_pagamento: string
  total_comissoes: number
  total_debitos_abatidos: number
  taxa_pix: number
  valor_liquido: number
  policies_count: number
  policies_ids: string[]
  debitos_detalhes?: any[]
  error?: string
}

// Normaliza data para o padrão exigido pelo PocketBase: 'YYYY-MM-DD 00:00:00.000Z'
export function normalizeDateForPocketBase(val?: string | null): string {
  if (!val) {
    const now = new Date()
    const yNow = now.getFullYear()
    const mNow = String(now.getMonth() + 1).padStart(2, '0')
    const dNow = String(now.getDate()).padStart(2, '0')
    return `${yNow}-${mNow}-${dNow} 00:00:00.000Z`
  }
  const str = String(val).trim()
  const matchIso = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (matchIso) {
    return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]} 00:00:00.000Z`
  }
  const matchBr = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (matchBr) {
    return `${matchBr[3]}-${matchBr[2]}-${matchBr[1]} 00:00:00.000Z`
  }
  return str
}

export const executarFechamentoParceiro = async (data: {
  parceiro_id: string
  data_pagamento: string
  observacoes?: string
  debitos?: ParceiroDebitoItem[]
  taxa_pix_manual?: number | null
  policy_ids?: string[]
}): Promise<FechamentoParceiroResult> => {
  const normalizedDataPagamento = normalizeDateForPocketBase(data.data_pagamento)
  const normalizedDebitos = (data.debitos || []).map((d) => ({
    ...d,
    data: normalizeDateForPocketBase(d.data || data.data_pagamento),
  }))

  const payload = {
    ...data,
    data_pagamento: normalizedDataPagamento,
    debitos: normalizedDebitos,
  }

  try {
    const res = await pb.send<FechamentoParceiroResult>('/backend/v1/parceiro-fechamento', {
      method: 'POST',
      body: payload,
    })
    return res
  } catch (err: any) {
    const serverMessage =
      err?.response?.message ||
      err?.response?.error ||
      err?.data?.message ||
      err?.data?.error ||
      err?.message ||
      'Falha no endpoint do servidor.'
    console.warn(
      '[executarFechamentoParceiro] Endpoint falhou, tentando fallback client seguro:',
      serverMessage,
      err,
    )

    // FALLBACK SEGURO: se a rota do hook falhar, executar a liquidação pela
    // MESMA rotina client que funciona no Financeiro
    try {
      // 1. Obter apólices pendentes
      const parceiroId = data.parceiro_id
      const filterPols =
        data.policy_ids && data.policy_ids.length > 0
          ? `(${data.policy_ids.map((id) => `id = "${id}"`).join(' || ')}) && parceiro = "${parceiroId}"`
          : `parceiro = "${parceiroId}" && (pago_parceiro = false || pago_parceiro = null)`

      const policiesToPay = await pb.collection('policies').getFullList<any>({
        filter: filterPols,
        sort: '-start_date',
      })

      const eligiblePolicies = policiesToPay.filter((p) => !p.pago_parceiro)
      if (eligiblePolicies.length === 0) {
        throw new Error(
          'Nenhum repasse pendente encontrado para este parceiro. Itens já pagos não podem compor novo pagamento.',
        )
      }

      let totalComissoes = 0
      const paidPolicyIds: string[] = []
      for (const pol of eligiblePolicies) {
        const rep = Number(pol.valor_repasse) || 0
        totalComissoes += Math.max(0, rep)
        paidPolicyIds.push(pol.id)
      }
      totalComissoes = Math.round(totalComissoes * 100) / 100

      // 2. Calcular débitos e PIX
      const debList = data.debitos || []
      const totalDebitos = debList.reduce((acc, d) => acc + (Number(d.valor) || 0), 0)
      const debitoAbatidoEfetivo = Math.min(totalComissoes, totalDebitos)
      const baseTransferencia = Math.max(0, totalComissoes - debitoAbatidoEfetivo)

      let taxaPix = 0
      if (baseTransferencia > 0) {
        if (
          data.taxa_pix_manual !== undefined &&
          data.taxa_pix_manual !== null &&
          !isNaN(Number(data.taxa_pix_manual)) &&
          Number(data.taxa_pix_manual) >= 0
        ) {
          taxaPix = Number(data.taxa_pix_manual)
        } else {
          taxaPix = Math.round(Math.min(10, (baseTransferencia * 1) / 100) * 100) / 100
        }
      }

      const valorLiquido = Math.max(0, Math.round((baseTransferencia - taxaPix) * 100) / 100)

      // 3. Criar registro parceiro_pagamentos
      const currentAuth = pb.authStore.record
      const pagRecord = await createParceiroPagamento({
        parceiro: parceiroId,
        data_pagamento: normalizedDataPagamento,
        total_comissoes: totalComissoes,
        total_debitos: debitoAbatidoEfetivo,
        taxa_pix: taxaPix,
        valor_liquido: valorLiquido,
        policies_ids: JSON.stringify(paidPolicyIds),
        detalhes_debitos: JSON.stringify(debList),
        observacoes: data.observacoes || '',
        usuario_id: currentAuth?.id,
        usuario_nome: (currentAuth?.name as string) || (currentAuth?.email as string) || '',
      })

      // 4. Liquidar débitos vinculando o id do pagamento
      if (debList.length > 0) {
        await liquidarDebitosPagamento(debList, parceiroId, pagRecord.id, totalComissoes)
      }

      // 5. Atualizar apólices para pago_parceiro: true
      for (const pol of eligiblePolicies) {
        await pb.collection('policies').update(pol.id, {
          pago_parceiro: true,
          data_pagamento_parceiro: normalizedDataPagamento,
          forma_pagamento_repasse: 'PIX',
        })
      }

      return {
        success: true,
        pagamento_id: pagRecord.id,
        parceiro_id: parceiroId,
        data_pagamento: normalizedDataPagamento,
        total_comissoes: totalComissoes,
        total_debitos_abatidos: debitoAbatidoEfetivo,
        taxa_pix: taxaPix,
        valor_liquido: valorLiquido,
        policies_count: paidPolicyIds.length,
        policies_ids: paidPolicyIds,
      }
    } catch (fallbackErr: any) {
      const fullErrorMsg =
        serverMessage || fallbackErr?.message || 'Erro ao processar fechamento do parceiro.'
      throw new Error(fullErrorMsg)
    }
  }
}

export const liquidarDebitosPagamento = async (
  debitos: ParceiroDebitoItem[],
  parceiroId: string,
  pagamentoId: string,
  totalRepasseDisponivel?: number,
) => {
  let repasseRestante =
    totalRepasseDisponivel !== undefined ? Math.max(0, totalRepasseDisponivel) : Infinity

  for (const deb of debitos) {
    const val = Number(deb.valor) || 0
    if (val <= 0) continue

    if (deb.id) {
      try {
        if (repasseRestante >= val) {
          // Liquidado integralmente
          await pb.collection('parceiro_debitos').update(deb.id, {
            status: 'Pago',
            saldo_pendente: 0,
            pagamento: pagamentoId,
            descricao: deb.descricao,
            valor: deb.valor,
          })
          repasseRestante = Math.round((repasseRestante - val) * 100) / 100
        } else if (repasseRestante > 0) {
          // Abate parcial: mantém pendente com saldo reduzido
          const saldo = Math.round((val - repasseRestante) * 100) / 100
          await pb.collection('parceiro_debitos').update(deb.id, {
            status: 'Pendente',
            saldo_pendente: saldo,
            descricao: deb.descricao,
          })
          repasseRestante = 0
        }
      } catch (e) {
        console.error('[liquidarDebitosPagamento] Erro ao atualizar débito:', e)
        throw e
      }
    } else {
      try {
        if (repasseRestante >= val) {
          await pb.collection('parceiro_debitos').create({
            parceiro: parceiroId,
            descricao: deb.descricao,
            valor: deb.valor,
            saldo_pendente: 0,
            status: 'Pago',
            pagamento: pagamentoId,
            data: todayLocalDate(),
          })
          repasseRestante = Math.round((repasseRestante - val) * 100) / 100
        } else if (repasseRestante > 0) {
          const saldo = Math.round((val - repasseRestante) * 100) / 100
          await pb.collection('parceiro_debitos').create({
            parceiro: parceiroId,
            descricao: deb.descricao,
            valor: deb.valor,
            saldo_pendente: saldo,
            status: 'Pendente',
            data: todayLocalDate(),
          })
          repasseRestante = 0
        }
      } catch (e) {
        console.error('[liquidarDebitosPagamento] Erro ao criar débito:', e)
        throw e
      }
    }
  }
}
