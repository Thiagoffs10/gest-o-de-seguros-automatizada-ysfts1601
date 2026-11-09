import pb from '@/lib/pocketbase/client'
import { Policy, ComissaoRecebimento, ComissaoPrevista } from '@/types'

const competenciaToNum = (competencia?: string): number | null => {
  if (!competencia) return null
  const d = competencia.split('T')[0].split(' ')[0]
  // Formato "MM/YYYY"
  const parts = d.includes('/') ? d.split('/') : null
  if (parts && parts.length === 2) {
    const mm = Number(parts[0])
    const yy = Number(parts[1])
    if (!mm || !yy || mm > 12) return null
    return yy * 100 + mm
  }
  // Formato "YYYY-MM-DD"
  const iso = d.split('-')
  if (iso.length >= 2) {
    const yy = Number(iso[0])
    const mm = Number(iso[1])
    if (!yy || !mm || mm > 12) return null
    return yy * 100 + mm
  }
  return null
}

/**
 * Retorna os meses/anos de competências JÁ FECHADAS (registros em conciliacoes).
 * Ex.: fechamentos 08/2026 e 09/2026 → [{ mes: 8, ano: 2026 }, { mes: 9, ano: 2026 }]
 */
export const getCompetenciasFechadas = async (): Promise<Array<{ mes: number; ano: number }>> => {
  try {
    const list = await pb.collection('conciliacoes').getFullList<{
      id: string
      mes: number
      ano: number
    }>({ sort: 'ano,mes' })
    return list.map((c) => ({ mes: Number(c.mes), ano: Number(c.ano) }))
  } catch {
    return []
  }
}

export interface ContaAReceberFechada {
  policyId: string
  /** id da previsão de comissão (comissoes_previstas) quando existir */
  comissaoPrevistaId?: string
  policyNumber: string
  segurado: string
  seguradora: string
  valor: number
  /** rótulo da competência fechada, ex.: "10/2026" */
  competencia: string
  diasVencidos: number
  /** data prevista de vencimento (yyyy-mm-dd) */
  vencimento: string
  /** data da última baixa real da apólice (yyyy-mm-dd), quando houver baixa parcial */
  ultimoRecebimento?: string
  /** indica se os dias são contados a partir da última baixa ou do vencimento original */
  origemDias?: 'vencimento' | 'ultimo_recebimento'
}

const diffDias = (dataIso: string, hoje: Date): number => {
  if (!dataIso) return 0
  const d = new Date(`${dataIso}T12:00:00`)
  if (isNaN(d.getTime())) return 0
  return Math.max(0, Math.floor((hoje.getTime() - d.getTime()) / 86400000))
}

interface ContasAReceberInput {
  policies: Policy[]
  recebimentos: ComissaoRecebimento[]
  comissoesPrevistas: ComissaoPrevista[]
  /** Set de "anoMês" (ex.: 202610) de competências fechadas */
  fechadasSet: Set<number>
  hoje?: Date
}

const round2 = (v: number) => Math.round(v * 100) / 100

/**
 * Aloca os recebimentos de uma apólice (descontando estornos) sobre as previsões
 * por FIFO: ordena por competencia/parcela_numero/data_prevista e consome os
 * saldos nessa ordem. NÃO depende de `competencia`/`comissao_prevista` do
 * recebimento — nas baixas manuais esses campos costumam ficar vazios.
 * Retorna um Map<idPrevisão, saldoPendente>.
 */
const calcularSaldosFIFO = (
  prevs: ComissaoPrevista[],
  recebimentosDaApolice: ComissaoRecebimento[],
): Map<string, number> => {
  const saldos = new Map<string, number>()
  if (prevs.length === 0) return saldos

  // Saldo inicial = valor previsto de cada previsão ativa
  for (const p of prevs) {
    const v = p.status === 'Cancelada' ? 0 : Number(p.valor_previsto) || 0
    saldos.set(p.id, round2(v))
  }

  // Total recebido da apólice, em valor LÍQUIDO (o valor_previsto das previsões é a
  // "Comissão Líquida Prevista", então a baixa compara líquido com líquido).
  // Estornos devolvem o valor ao saldo: o hook grava o estorno com valor NEGATIVO, mas
  // normalizamos pela flag is_estorno (−|valor|) para tolerar qualquer convenção —
  // estorno nunca conta como recebimento.
  const totalRecebido = round2(
    recebimentosDaApolice.reduce((s, r) => {
      const bruto = Number(r.valor_bruto) || 0
      const liquido = r.valor_liquido != null ? Number(r.valor_liquido) : bruto
      const magnitude = Number.isFinite(liquido) && liquido !== 0 ? liquido : bruto
      return s + (r.is_estorno ? -magnitude : magnitude)
    }, 0),
  )

  // FIFO: previsões mais antigas primeiro (competência, depois parcela, depois data_prevista)
  const ordenadas = [...prevs].sort((a, b) => {
    const cA = competenciaToNum(a.competencia)
    const cB = competenciaToNum(b.competencia)
    const nA = cA ?? (Number(a.parcela_numero) || 0)
    const nB = cB ?? (Number(b.parcela_numero) || 0)
    if (nA !== nB) return nA - nB
    const pA = Number(a.parcela_numero) || 0
    const pB = Number(b.parcela_numero) || 0
    if (pA !== pB) return pA - pB
    return (a.data_prevista || '').localeCompare(b.data_prevista || '')
  })

  let restante = totalRecebido > 0 ? totalRecebido : 0
  for (const p of ordenadas) {
    if (restante <= 0.009) break
    const saldo = saldos.get(p.id) || 0
    if (saldo <= 0) continue
    const consumido = Math.min(saldo, restante)
    saldos.set(p.id, round2(saldo - consumido))
    restante = round2(restante - consumido)
  }

  return saldos
}

/**
 * Monta a lista de "Contas a receber de competências fechadas":
 * saldos pendentes de comissões cuja COMPETÊNCIA de previsão já foi FECHADA
 * (existe registro em conciliacoes para o mês/ano da competência).
 * O mês corrente (não fechado) NÃO entra — segue nas pendências normais do Financeiro.
 *
 * SALDO = valor_previsto − TUDO que já foi baixado da MESMA apólice
 * (recebimentos de comissao_recebimentos, com estornos devolvendo valor ao saldo),
 * alocado por FIFO entre as previsões da apólice — independente do vínculo
 * `comissao_prevista`/`competencia` gravado no recebimento, que fica vazio nas baixas manuais.
 */
export const montarContasAReceberFechadas = ({
  policies,
  recebimentos,
  comissoesPrevistas,
  fechadasSet,
  hoje = new Date(),
}: ContasAReceberInput): ContaAReceberFechada[] => {
  if (fechadasSet.size === 0) return []

  const policyById = new Map(policies.map((p) => [p.id, p]))

  // Agrupa previsões por apólice e calcula saldos FIFO uma vez por apólice
  const prevsByPolicy = new Map<string, ComissaoPrevista[]>()
  for (const p of comissoesPrevistas) {
    const arr = prevsByPolicy.get(p.policy)
    if (arr) arr.push(p)
    else prevsByPolicy.set(p.policy, [p])
  }

  const recsByPolicy = new Map<string, ComissaoRecebimento[]>()
  for (const r of recebimentos) {
    const arr = recsByPolicy.get(r.policy)
    if (arr) arr.push(r)
    else recsByPolicy.set(r.policy, [r])
  }

  // Mapa do recebimento MAIS RECENTE da apólice (apenas baixas reais, vBruto > 0; estornos não renovam prazo)
  // Regra idêntica à de computePendenciasComissao60
  const lastReceiptByPolicy = new Map<string, string>()
  for (const r of recebimentos) {
    const vBruto = Number(r.valor_bruto) || 0
    if (r.policy && vBruto > 0 && r.data_recebimento) {
      const dPart = r.data_recebimento.split('T')[0].split(' ')[0]
      const curr = lastReceiptByPolicy.get(r.policy)
      if (dPart && (!curr || dPart > curr)) {
        lastReceiptByPolicy.set(r.policy, dPart)
      }
    }
  }

  const items: ContaAReceberFechada[] = []

  const pushItem = (
    pol: Policy,
    prevista: Pick<ComissaoPrevista, 'id' | 'competencia' | 'data_prevista'>,
    saldo: number,
  ) => {
    const vencimento = (prevista.data_prevista || '').split('T')[0].split(' ')[0]
    const mm = competenciaToNum(prevista.competencia)
    const compLabel =
      mm != null
        ? `${String(mm % 100).padStart(2, '0')}/${Math.floor(mm / 100)}`
        : vencimento.slice(0, 7).split('-').reverse().join('/')

    const ultimoRec = lastReceiptByPolicy.get(pol.id)
    const refData = ultimoRec || vencimento
    const origemDias: 'vencimento' | 'ultimo_recebimento' = ultimoRec
      ? 'ultimo_recebimento'
      : 'vencimento'

    items.push({
      policyId: pol.id,
      comissaoPrevistaId: prevista.id,
      policyNumber: pol.policy_number || pol.numero_proposta || '-',
      segurado: pol.expand?.client?.name || 'Cliente não informado',
      seguradora: pol.expand?.seguradora?.nome || pol.insurance_company || '-',
      valor: saldo,
      competencia: compLabel,
      diasVencidos: diffDias(refData, hoje),
      vencimento,
      ultimoRecebimento: ultimoRec,
      origemDias,
    })
  }

  // 1) Previsões explícitas (parcelamento / endosso): saldo FIFO por parcela
  for (const [policyId, prevsApolice] of prevsByPolicy) {
    const pol = policyById.get(policyId)
    if (!pol || pol.status === 'Cancelada') continue

    const saldos = calcularSaldosFIFO(prevsApolice, recsByPolicy.get(policyId) || [])

    for (const prev of prevsApolice) {
      if (prev.status === 'Cancelada' || prev.status === 'Recebida') continue
      const compNum = competenciaToNum(prev.competencia)
      if (compNum == null || !fechadasSet.has(compNum)) continue

      const saldo = saldos.get(prev.id) || 0
      // Item quitado ou recebido acima do previsto não entra na lista
      if (saldo <= 0.01) continue

      pushItem(pol, prev, saldo)
    }
  }

  // 2) Apólices sem previsão cadastrada: competência estimada pelo vencimento/início da vigência
  const policiesWithPrevs = new Set(comissoesPrevistas.map((c) => c.policy))
  for (const pol of policies) {
    if (pol.status === 'Cancelada') continue
    if (policiesWithPrevs.has(pol.id)) continue
    if (pol.comissao_recebida) continue

    const previstoBruto =
      pol.commission != null
        ? Number(pol.commission)
        : Math.round(
            (((pol.valor_liquido || pol.premium_amount || 0) * (pol.commission_percent || 0)) /
              100) *
              100,
          ) / 100
    if (previstoBruto <= 0) continue

    // Mesma métrica do ramo com previsão: líquido recebido, estornos devolvem saldo
    const recLiquido = recebimentos
      .filter((r) => r.policy === pol.id)
      .reduce((s, r) => {
        const bruto = Number(r.valor_bruto) || 0
        const liq = r.valor_liquido != null ? Number(r.valor_liquido) : bruto
        const magnitude = Number.isFinite(liq) && liq !== 0 ? liq : bruto
        return s + (r.is_estorno ? -magnitude : magnitude)
      }, 0)
    const saldo = Math.max(0, round2(previstoBruto - recLiquido))
    // Item quitado ou recebido acima do previsto não entra na lista
    if (saldo <= 0.01) continue

    const ref = pol.data_recebimento_comissao || pol.start_date
    const compNum = dateToCompNum(ref)
    if (compNum == null || !fechadasSet.has(compNum)) continue

    const vencimento = (pol.start_date || '').split('T')[0].split(' ')[0]
    const ultimoRec = lastReceiptByPolicy.get(pol.id)
    const refData = ultimoRec || vencimento
    const origemDias: 'vencimento' | 'ultimo_recebimento' = ultimoRec
      ? 'ultimo_recebimento'
      : 'vencimento'

    items.push({
      policyId: pol.id,
      policyNumber: pol.policy_number || pol.numero_proposta || '-',
      segurado: pol.expand?.client?.name || 'Cliente não informado',
      seguradora: pol.expand?.seguradora?.nome || pol.insurance_company || '-',
      valor: saldo,
      competencia: compNumToLabel(compNum),
      diasVencidos: diffDias(refData, hoje),
      vencimento,
      ultimoRecebimento: ultimoRec,
      origemDias,
    })
  }

  return items.sort(
    (a, b) => b.diasVencidos - a.diasVencidos || a.policyNumber.localeCompare(b.policyNumber),
  )
}

const dateToCompNum = (date?: string): number | null => {
  if (!date) return null
  const d = date.split('T')[0].split(' ')[0]
  const iso = d.split('-')
  if (iso.length < 2) return null
  const yy = Number(iso[0])
  const mm = Number(iso[1])
  if (!yy || !mm || mm > 12) return null
  return yy * 100 + mm
}

const compNumToLabel = (num: number): string =>
  `${String(num % 100).padStart(2, '0')}/${Math.floor(num / 100)}`

/**
 * Carrega fechamentos e monta a lista completa (versão "pronta para usar").
 */
export const getContasAReceberFechadas = async (
  policies: Policy[],
  recebimentos: ComissaoRecebimento[],
  comissoesPrevistas: ComissaoPrevista[],
  hoje: Date = new Date(),
): Promise<ContaAReceberFechada[]> => {
  const fechadas = await getCompetenciasFechadas()
  const fechadasSet = new Set(fechadas.map((f) => f.ano * 100 + f.mes))
  return montarContasAReceberFechadas({
    policies,
    recebimentos,
    comissoesPrevistas,
    fechadasSet,
    hoje,
  })
}

export const competenciaLabel = (mes: number, ano: number): string =>
  `${String(mes).padStart(2, '0')}/${ano}`
