import pb from '@/lib/pocketbase/client'
import { Policy } from '@/types'

export function preparePolicyPayload(data: Partial<Policy> & Record<string, any>) {
  const tipoSeguro = data.tipo_de_seguro || data.coverage_type || 'Auto'
  const validCoverageTypes = ['Auto', 'Vida', 'Residencial', 'Empresarial', 'Saúde', 'Outros']
  const coverageType = validCoverageTypes.includes(tipoSeguro) ? tipoSeguro : 'Outros'

  const valorBruto = Number(data.valor_bruto) || 0
  const valorLiquido = Number(data.valor_liquido) || Number(data.premium_amount) || 0
  const premiumAmount = Number(data.premium_amount) || valorBruto || valorLiquido || 0

  const payload: Record<string, any> = {
    ...data,
    tipo_de_seguro: tipoSeguro,
    coverage_type: coverageType,
    premium_amount: premiumAmount,
    valor_bruto: valorBruto,
    valor_liquido: valorLiquido,
    commission_percent: Number(data.commission_percent) || 0,
    commission: Number(data.commission) || 0,
    iss: Number(data.iss) || 0,
    valor_repasse: Number(data.valor_repasse) || 0,
  }

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
  }

  // Dates: PocketBase rejects empty string "" for date fields
  // Only process financial tracking fields if they were explicitly provided
  // (e.g. from Finance tab or renewal). When absent (policy form), preserve
  // existing DB values by removing them from the payload entirely.
  if ('data_pagamento_parceiro' in data) {
    if (
      !payload.data_pagamento_parceiro ||
      (typeof payload.data_pagamento_parceiro === 'string' &&
        payload.data_pagamento_parceiro.trim() === '')
    ) {
      payload.data_pagamento_parceiro = null
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
  if (!('commission_percent' in data)) {
    delete payload.commission_percent
  }
  if (
    !payload.renewal_date ||
    (typeof payload.renewal_date === 'string' && payload.renewal_date.trim() === '')
  ) {
    payload.renewal_date = null
  }
  if (
    !payload.start_date ||
    (typeof payload.start_date === 'string' && payload.start_date.trim() === '')
  ) {
    payload.start_date = new Date().toISOString().split('T')[0]
  }
  if (
    !payload.end_date ||
    (typeof payload.end_date === 'string' && payload.end_date.trim() === '')
  ) {
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
