/**
 * Cria a previsão de comissão de um endosso em comissoes_previstas — idempotente.
 * Tenta primeiro por chave_estavel (índice UNIQUE com WHERE chave_estavel != ""),
 * depois por endorsement; pula se já existir. Nunca lança para colisão esperada.
 */
import pb from '@/lib/pocketbase/client'
import { getOrgId } from '@/lib/tenant'

export async function criarPrevisaoEndosso(input: {
  endossoId: string
  policyId: string
  organization: string
  tipo: string
  valor: number
  percent: number
  liquido: number
  comp: string
  dataPrevista: string
  isCreateAllowed: boolean
}): Promise<boolean> {
  const stableKey = `prev_end_${input.endossoId}_1_${input.comp.replace('/', '_')}`

  // Idempotência primária: já existe previsão com esta chave estável?
  try {
    const exists = await pb.collection('comissoes_previstas').getList(1, 1, {
      filter: `chave_estavel = "${stableKey}"`,
      fields: 'id',
    })
    if (exists.items.length > 0) return false
  } catch {
    /* segue para tentativa de criação */
  }

  const obs = `Endosso (${input.tipo || 'Alteração'}) — ${input.percent}% sobre líq. R$ ${input.liquido.toFixed(2)}`

  try {
    await pb.collection('comissoes_previstas').create({
      policy: input.policyId,
      organization: input.organization || '',
      competencia: input.comp,
      data_prevista: input.dataPrevista,
      valor_previsto: input.valor,
      parcela_numero: 1,
      origem_modelo: `Endosso: ${input.tipo || 'Alteração'}`,
      status: 'Pendente',
      observacao: obs,
      chave_estavel: stableKey,
      endorsement: input.endossoId,
    })
    return true
  } catch (err: any) {
    const msg = String(err?.message || err?.response?.message || err || '')
    // Colisão de chave estável → previsão já existe (idempotente)
    if (msg.includes('chave_estavel')) return false
    console.warn('[previsao-endosso] falha ao criar previsão:', msg)
    return false
  }
}
