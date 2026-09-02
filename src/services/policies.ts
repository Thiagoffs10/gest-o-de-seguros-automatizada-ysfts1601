import pb from '@/lib/pocketbase/client'
import { Policy } from '@/types'

import { formatDateForInput, todayLocalDate, toLocalDate } from '@/lib/utils'

export function preparePolicyPayload(data: Partial<Policy> & Record<string, any>) {
  const tipoSeguro = data.tipo_de_seguro || data.coverage_type || 'Auto'
  const validCoverageTypes = ['Auto', 'Vida', 'Residencial', 'Empresarial', 'Saúde', 'Outros']
  const coverageType = validCoverageTypes.includes(tipoSeguro) ? tipoSeguro : 'Outros'

  const valorBruto = data.valor_bruto != null ? Number(data.valor_bruto) : 0
  const valorLiquido =
    data.valor_liquido != null
      ? Number(data.valor_liquido)
      : data.premium_amount != null
        ? Number(data.premium_amount)
        : 0
  const premiumAmount =
    data.premium_amount != null ? Number(data.premium_amount) : valorLiquido || valorBruto || 0

  const rawCommPercent = data.commission_percent != null ? Number(data.commission_percent) : 0
  const rawCommission =
    data.commission != null
      ? Number(data.commission)
      : Math.round(((valorLiquido * rawCommPercent) / 100) * 100) / 100
  const rawIss = data.iss != null ? Number(data.iss) : 0
  const rawPercentualRepasse =
    data.percentual_repasse != null ? Number(data.percentual_repasse) : 50
  const rawRepasse =
    data.valor_repasse != null
      ? Number(data.valor_repasse)
      : Math.round(((valorLiquido * rawPercentualRepasse) / 100) * 100) / 100

  const payload: Record<string, any> = {
    ...data,
    tipo_de_seguro: tipoSeguro,
    coverage_type: coverageType,
    premium_amount: Math.round(premiumAmount * 100) / 100,
    valor_bruto: Math.round(valorBruto * 100) / 100,
    valor_liquido: Math.round(valorLiquido * 100) / 100,
    commission_percent: Math.round(rawCommPercent * 100) / 100,
    commission: Math.round(rawCommission * 100) / 100,
    iss: Math.round(rawIss * 100) / 100,
    percentual_repasse: Math.round(rawPercentualRepasse * 100) / 100,
    valor_repasse: Math.round(rawRepasse * 100) / 100,
  }

  if ('forma_pagamento' in data) {
    payload.forma_pagamento = data.forma_pagamento ? String(data.forma_pagamento).trim() : ''
  }
  if ('parcelas' in data) {
    const rawP = (data as Record<string, any>).parcelas
    const pNum = rawP != null && rawP !== '' ? Math.round(Number(rawP)) : null
    payload.parcelas = pNum && pNum > 0 ? pNum : null
  }

  if ('placa' in data) payload.placa = data.placa ? String(data.placa).trim() : ''
  if ('chassi' in data) payload.chassi = data.chassi ? String(data.chassi).trim() : ''
  if ('modelo_veiculo' in data)
    payload.modelo_veiculo = data.modelo_veiculo ? String(data.modelo_veiculo).trim() : ''

  // Relations: PocketBase rejects empty string "" for relation fields
  if (!payload.client || (typeof payload.client === 'string' && payload.client.trim() === '')) {
    delete payload.client
  }
  if (
    !payload.seguradora ||
    (typeof payload.seguradora === 'string' && payload.seguradora.trim() === '')
  ) {
    payload.seguradora = null
  }
  if (
    payload.tipo_de_venda !== 'Parceiro' ||
    !payload.parceiro ||
    (typeof payload.parceiro === 'string' && payload.parceiro.trim() === '')
  ) {
    payload.parceiro = null
    payload.percentual_repasse = 0
    payload.valor_repasse = 0
  }

  // Dates & financial tracking
  if ('data_pagamento_parceiro' in data) {
    if (
      !payload.data_pagamento_parceiro ||
      (typeof payload.data_pagamento_parceiro === 'string' &&
        payload.data_pagamento_parceiro.trim() === '')
    ) {
      payload.data_pagamento_parceiro = null
    } else {
      payload.data_pagamento_parceiro = formatDateForInput(payload.data_pagamento_parceiro)
    }
  } else {
    delete payload.data_pagamento_parceiro
  }

  if ('data_recebimento_comissao' in data) {
    if (
      !payload.data_recebimento_comissao ||
      (typeof payload.data_recebimento_comissao === 'string' &&
        payload.data_recebimento_comissao.trim() === '')
    ) {
      payload.data_recebimento_comissao = null
    } else {
      payload.data_recebimento_comissao = formatDateForInput(payload.data_recebimento_comissao)
    }
  } else {
    delete payload.data_recebimento_comissao
  }

  if ('data_cancelamento' in data) {
    if (
      !payload.data_cancelamento ||
      (typeof payload.data_cancelamento === 'string' && payload.data_cancelamento.trim() === '')
    ) {
      payload.data_cancelamento = null
    } else {
      payload.data_cancelamento = formatDateForInput(payload.data_cancelamento)
    }
  } else {
    delete payload.data_cancelamento
  }

  if ('motivo_cancelamento' in data) {
    payload.motivo_cancelamento = data.motivo_cancelamento
      ? String(data.motivo_cancelamento).trim()
      : ''
  } else {
    delete payload.motivo_cancelamento
  }

  if (!('pago_parceiro' in data)) {
    delete payload.pago_parceiro
  }
  if (!('comissao_recebida' in data)) {
    delete payload.comissao_recebida
  }

  if (
    !payload.renewal_date ||
    (typeof payload.renewal_date === 'string' && payload.renewal_date.trim() === '')
  ) {
    payload.renewal_date = null
  } else {
    payload.renewal_date = formatDateForInput(payload.renewal_date)
  }

  if (payload.start_date) {
    payload.start_date = formatDateForInput(payload.start_date) || todayLocalDate()
  } else {
    payload.start_date = todayLocalDate()
  }

  if (payload.end_date) {
    payload.end_date =
      formatDateForInput(payload.end_date) || toLocalDate(new Date(Date.now() + 365 * 86400000))
  } else {
    payload.end_date = toLocalDate(new Date(Date.now() + 365 * 86400000))
  }

  // Remove expand helper property before sending to PocketBase
  delete payload.expand

  // Remove system fields that should never be sent on create or update
  delete payload.id
  delete payload.created
  delete payload.updated
  delete payload.policy_code

  return payload
}

export const sortPoliciesPrioritized = (policies: Policy[]): Policy[] => {
  const getStatusPriority = (status: string) => {
    if (status === 'Ativa') return 1
    if (status === 'Renovação Pendente') return 2
    if (status === 'Vencida' || status === 'Expirada') return 3
    if (status === 'Cancelada') return 4
    return 5
  }

  return [...policies].sort((a, b) => {
    const prioA = getStatusPriority(a.status)
    const prioB = getStatusPriority(b.status)
    if (prioA !== prioB) return prioA - prioB

    // Dentro do mesmo grupo de status, ordenar cronologicamente decrescente (mais recentes / data fim mais recente primeiro)
    const dateA = a.end_date || a.start_date || a.created || ''
    const dateB = b.end_date || b.start_date || b.created || ''
    if (dateA !== dateB) return dateB.localeCompare(dateA)

    return (b.policy_code || 0) - (a.policy_code || 0)
  })
}

export const syncExpiredPolicies = async (policies: Policy[]): Promise<Policy[]> => {
  const today = todayLocalDate()
  const toUpdate: Policy[] = []

  const updatedPolicies = policies.map((p) => {
    const end = p.end_date ? p.end_date.split('T')[0].split(' ')[0] : ''
    if (p.status === 'Ativa' && end && end < today) {
      toUpdate.push(p)
      return { ...p, status: 'Vencida' as const }
    }
    return p
  })

  // Se houver apólices que expiraram, atualiza de forma assíncrona no backend
  if (toUpdate.length > 0) {
    Promise.allSettled(
      toUpdate.map((p) =>
        pb
          .collection('policies')
          .update(p.id, { status: 'Vencida' })
          .catch(() => {}),
      ),
    ).catch(() => {})
  }

  return updatedPolicies
}

export const getPolicies = async (
  filterString?: string,
  searchQuery?: string,
  nameSearch?: string,
): Promise<Policy[]> => {
  let filter = filterString || ''
  if (nameSearch && nameSearch.trim()) {
    const sanitizedName = nameSearch.trim().replace(/"/g, '')
    const qName = `client.name ~ "${sanitizedName}"`
    filter = filter ? `${filter} && (${qName})` : qName
  }
  const rawList = await pb.collection('policies').getFullList<Policy>({
    expand: 'client,seguradora,parceiro',
    filter,
    sort: '-created',
  })

  const syncedList = await syncExpiredPolicies(rawList)
  return sortPoliciesPrioritized(syncedList)
}
export const getPolicy = async (id: string) => {
  return pb.collection('policies').getOne<Policy>(id, {
    expand: 'client,seguradora,parceiro',
  })
}

export const createPolicy = async (data: Partial<Policy>) => {
  const cleanData = preparePolicyPayload(data)
  return pb.collection('policies').create<Policy>(cleanData)
}

export const updatePolicy = async (id: string, data: Partial<Policy>) => {
  const cleanData = preparePolicyPayload(data)
  return pb.collection('policies').update<Policy>(id, cleanData)
}

export const updatePolicyFinancial = async (
  id: string,
  data: {
    comissao_recebida?: boolean
    data_recebimento_comissao?: string | null
    pago_parceiro?: boolean
    data_pagamento_parceiro?: string | null
    forma_pagamento_repasse?: string | null
  },
) => {
  return pb.collection('policies').update<Policy>(id, data)
}

export const deletePolicy = async (id: string) => {
  return pb.collection('policies').delete(id)
}

export const deletePolicyWithRelations = async (id: string) => {
  const payments = await pb.collection('payments').getFullList({ filter: `policy = "${id}"` })
  for (const p of payments) {
    await pb.collection('payments').delete(p.id)
  }
  const reminders = await pb.collection('reminders').getFullList({ filter: `policy = "${id}"` })
  for (const r of reminders) {
    await pb.collection('reminders').delete(r.id)
  }
  await pb.collection('policies').delete(id)
}

export function prepareRenewalData(policy: Policy): Partial<Policy> {
  const data: any = { ...policy }
  delete data.id
  delete data.expand
  delete data.created
  delete data.updated
  delete data.policy_code
  return {
    ...data,
    policy_number: '',
    start_date: todayLocalDate(),
    end_date: toLocalDate(new Date(Date.now() + 365 * 86400000)),
    renewal_date: undefined,
    status: 'Ativa',
    comissao_recebida: false,
    data_recebimento_comissao: null,
    pago_parceiro: false,
    data_pagamento_parceiro: null,
    previous_policy: policy.id,
  }
}

export const countActivePolicies = async () => {
  const today = todayLocalDate()
  const result = await pb.collection('policies').getList(1, 1, {
    filter: `status = "Ativa" && end_date >= "${today}"`,
  })
  return result.totalItems
}
