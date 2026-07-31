import pb from '@/lib/pocketbase/client'
import { Policy } from '@/types'

import { formatDateForInput } from '@/lib/utils'

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
    payload.start_date =
      formatDateForInput(payload.start_date) || new Date().toISOString().split('T')[0]
  } else {
    payload.start_date = new Date().toISOString().split('T')[0]
  }

  if (payload.end_date) {
    payload.end_date =
      formatDateForInput(payload.end_date) ||
      new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
  } else {
    payload.end_date = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
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

export const getPolicies = async (filterString?: string) => {
  return pb.collection('policies').getFullList<Policy>({
    filter: filterString || '',
    expand: 'client,seguradora,parceiro',
    sort: '-created',
  })
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
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    renewal_date: undefined,
    status: 'Ativa',
    comissao_recebida: false,
    data_recebimento_comissao: null,
    pago_parceiro: false,
    data_pagamento_parceiro: null,
  }
}

export const countActivePolicies = async () => {
  const result = await pb.collection('policies').getList(1, 1, {
    filter: 'status = "Ativa"',
  })
  return result.totalItems
}
