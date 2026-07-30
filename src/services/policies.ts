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
  if (
    !payload.data_pagamento_parceiro ||
    (typeof payload.data_pagamento_parceiro === 'string' &&
      payload.data_pagamento_parceiro.trim() === '')
  ) {
    payload.data_pagamento_parceiro = null
  }
  if (
    !payload.data_recebimento_comissao ||
    (typeof payload.data_recebimento_comissao === 'string' &&
      payload.data_recebimento_comissao.trim() === '')
  ) {
    payload.data_recebimento_comissao = null
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
