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
}

const diffDias = (vencimento: string, hoje: Date): number => {
  if (!vencimento) return 0
  const d = new Date(`${vencimento}T12:00:00`)
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

/**
 * Monta a lista de "Contas a receber de competências fechadas":
 * saldos pendentes de comissões cuja COMPETÊNCIA de previsão já foi FECHADA
 * (existe registro em conciliacoes para o mês/ano da competência).
 * O mês corrente (não fechado) NÃO entra — segue nas pendências normais do Financeiro.
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

  // Bruto recebido por previsão (vínculo direto) e por apólice+competência (fallback)
  const recBrutoByPrevista = new Map<string, number>()
  const recBrutoByPolComp = new Map<string, number>()
  for (const r of recebimentos) {
    if (r.is_estorno) continue
    const bruto = Number(r.valor_bruto) || 0
    if (r.comissao_prevista) {
      recBrutoByPrevista.set(
        r.comissao_prevista,
        (recBrutoByPrevista.get(r.comissao_prevista) || 0) + bruto,
      )
    }
    const compNum = competenciaToNum(r.competencia || undefined)
    if (compNum != null) {
      const key = `${r.policy}|${compNum}`
      recBrutoByPolComp.set(key, (recBrutoByPolComp.get(key) || 0) + bruto)
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
    items.push({
      policyId: pol.id,
      comissaoPrevistaId: prevista.id,
      policyNumber: pol.policy_number || pol.numero_proposta || '-',
      segurado: pol.expand?.client?.name || 'Cliente não informado',
      seguradora: pol.expand?.seguradora?.nome || pol.insurance_company || '-',
      valor: saldo,
      competencia: compLabel,
      diasVencidos: diffDias(vencimento, hoje),
      vencimento,
    })
  }

  // 1) Previsões explícitas (parcelamento / endosso): saldo por parcela
  for (const prev of comissoesPrevistas) {
    if (prev.status === 'Cancelada' || prev.status === 'Recebida') continue
    const compNum = competenciaToNum(prev.competencia)
    if (compNum == null || !fechadasSet.has(compNum)) continue

    const pol = policyById.get(prev.policy)
    if (!pol || pol.status === 'Cancelada') continue

    const recBruto =
      recBrutoByPrevista.get(prev.id) ?? recBrutoByPolComp.get(`${prev.policy}|${compNum}`) ?? 0
    const vPrev = Number(prev.valor_previsto) || 0
    const saldo = Math.max(0, Math.round((vPrev - recBruto) * 100) / 100)
    if (saldo <= 0.009) continue

    pushItem(pol, prev, saldo)
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

    const recBruto = recebimentos
      .filter((r) => r.policy === pol.id && !r.is_estorno)
      .reduce((s, r) => s + (Number(r.valor_bruto) || 0), 0)
    const saldo = Math.max(0, Math.round((previstoBruto - recBruto) * 100) / 100)
    if (saldo <= 0.009) continue

    const ref = pol.data_recebimento_comissao || pol.start_date
    const compNum = dateToCompNum(ref)
    if (compNum == null || !fechadasSet.has(compNum)) continue

    const vencimento = (pol.start_date || '').split('T')[0].split(' ')[0]
    items.push({
      policyId: pol.id,
      policyNumber: pol.policy_number || pol.numero_proposta || '-',
      segurado: pol.expand?.client?.name || 'Cliente não informado',
      seguradora: pol.expand?.seguradora?.nome || pol.insurance_company || '-',
      valor: saldo,
      competencia: compNumToLabel(compNum),
      diasVencidos: diffDias(vencimento, hoje),
      vencimento,
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
