import pb from '@/lib/pocketbase/client'
import { RecebimentoLegado } from '@/types'
import { LinhaConferida } from './extrato-service'

export type { RecebimentoLegado } from '@/types'

export interface CreateRecebimentoLegadoPayload {
  seguradora_nome: string
  data_credito: string
  valor_liquido: number
  valor_bruto?: number
  impostos?: number
  numero_documento?: string
  numero_proposta?: string
  numero_apolice?: string
  parcela?: number
  segurado_nome?: string
  observacao?: string
  idempotency_hash?: string
  lote_id?: string
  lote_nome?: string
}

/**
 * Busca todos os recebimentos legados (ordenados decrescente por data de crédito)
 */
export async function getRecebimentosLegados(filter?: string): Promise<RecebimentoLegado[]> {
  try {
    return await pb.collection('recebimentos_legados').getFullList<RecebimentoLegado>({
      filter: filter || '',
      sort: '-data_credito,-created',
    })
  } catch (err) {
    console.warn('Erro ao carregar recebimentos legados:', err)
    return []
  }
}

/**
 * Registra um recebimento como LEGADO no sistema contábil, sem vínculo a apólices.
 * Garante idempotência: se a idempotency_hash já foi gravada, retorna o registro existente.
 */
export async function registrarRecebimentoLegado(
  payload: CreateRecebimentoLegadoPayload,
): Promise<RecebimentoLegado> {
  const user = pb.authStore.record
  const userNome = user?.name || user?.email || 'Sistema'

  const dataCredito = payload.data_credito ? payload.data_credito.substring(0, 10) : ''
  if (!dataCredito) {
    throw new Error('A data de crédito é obrigatória para o lançamento legado.')
  }

  const liquido = Math.round(Number(payload.valor_liquido || 0) * 100) / 100
  if (isNaN(liquido) || liquido <= 0) {
    throw new Error('O valor líquido deve ser maior que zero.')
  }

  // Verificar idempotência se fornecido hash
  if (payload.idempotency_hash) {
    try {
      const existing = await pb
        .collection('recebimentos_legados')
        .getFirstListItem<RecebimentoLegado>(`idempotency_hash = "${payload.idempotency_hash}"`)
      if (existing) {
        return existing
      }
    } catch {
      // Nenhum existente, prosseguir
    }
  }

  const docRef =
    payload.numero_documento || payload.numero_apolice || payload.numero_proposta || '-'

  const obs = payload.observacao
    ? payload.observacao.trim()
    : `[Lançamento Legado] Ref: ${docRef} | Seguradora: ${payload.seguradora_nome}`

  return await pb.collection('recebimentos_legados').create<RecebimentoLegado>({
    seguradora_nome: payload.seguradora_nome,
    data_credito: dataCredito,
    valor_liquido: liquido,
    valor_bruto:
      payload.valor_bruto !== undefined
        ? Math.round(Number(payload.valor_bruto) * 100) / 100
        : liquido,
    impostos: payload.impostos !== undefined ? Math.round(Number(payload.impostos) * 100) / 100 : 0,
    numero_documento: payload.numero_documento || '',
    numero_proposta: payload.numero_proposta || '',
    numero_apolice: payload.numero_apolice || '',
    parcela: payload.parcela || 1,
    segurado_nome: payload.segurado_nome || '',
    observacao: obs,
    idempotency_hash: payload.idempotency_hash || '',
    lote_id: payload.lote_id || '',
    lote_nome: payload.lote_nome || '',
    usuario_id: user?.id || '',
    usuario_nome: userNome,
  })
}

/**
 * Registra múltiplas linhas da fila Sem Previsão como LEGADO em lote.
 * Preserva histórico, gera registros em import_rows e retorna estatísticas completas.
 */
export async function registrarLinhasComoLegadoEmLote(
  linhas: LinhaConferida[],
  contexto: {
    loteId?: string
    loteNome?: string
    seguradoraNome?: string
  },
): Promise<{
  sucessos: number
  totalValor: number
  falhas: Array<{ linhaId: string; erro: string }>
  registros: RecebimentoLegado[]
}> {
  let sucessos = 0
  let totalValor = 0
  const falhas: Array<{ linhaId: string; erro: string }> = []
  const registros: RecebimentoLegado[] = []

  for (const item of linhas) {
    try {
      const l = item.linha
      const docRef = l.numeroExtrato || l.numeroApolice || l.numeroProposta || '-'
      const rec = await registrarRecebimentoLegado({
        seguradora_nome: l.seguradoraNome || contexto.seguradoraNome || 'Não informada',
        data_credito: l.dataCredito,
        valor_liquido: l.liquidoPago,
        valor_bruto: l.comissaoBruta,
        impostos: l.impostos,
        numero_documento: l.numeroExtrato || '',
        numero_proposta: l.numeroProposta || '',
        numero_apolice: l.numeroApolice || '',
        parcela: l.parcela || 1,
        segurado_nome: l.seguradoNome || '',
        observacao: `[Registrado como Legado] Doc: ${docRef} | Parcela: ${l.parcela || 1}`,
        idempotency_hash: item.idempotencyHash,
        lote_id: contexto.loteId || '',
        lote_nome: contexto.loteNome || '',
      })

      sucessos++
      totalValor = Math.round((totalValor + l.liquidoPago) * 100) / 100
      registros.push(rec)

      // Registrar em import_rows se houver lote ativo
      if (contexto.loteId) {
        try {
          await pb.collection('import_rows').create({
            lote: contexto.loteId,
            seguradora_nome: l.seguradoraNome || contexto.seguradoraNome || '',
            numero_extrato: l.numeroExtrato || '',
            tipo_referencia: l.tipoReferencia || 'DOCUMENTO',
            numero_apolice: l.numeroApolice || '',
            numero_proposta: l.numeroProposta || '',
            endosso: l.endosso || '',
            parcela: l.parcela || 1,
            data_credito: l.dataCredito,
            premio_liquido: l.premioLiquido || 0,
            comissao_bruta: l.comissaoBruta || 0,
            impostos: l.impostos || 0,
            liquido_pago: l.liquidoPago,
            percentual_comissao: l.percentualComissao || 0,
            segurado_nome: l.seguradoNome || '',
            fila: 'SEM_PREVISAO',
            motivo_fila: 'Registrado como Legado (sem vínculo a apólice)',
            recebimento_id: rec.id,
            baixado: true,
            idempotency_hash: item.idempotencyHash,
          })
        } catch {
          // Erro silencioso em import_rows para não interromper a baixa contábil
        }
      }
    } catch (err: any) {
      falhas.push({
        linhaId: item.linha.id,
        erro: err?.message || 'Falha ao registrar recebimento como legado.',
      })
    }
  }

  return {
    sucessos,
    totalValor,
    falhas,
    registros,
  }
}
