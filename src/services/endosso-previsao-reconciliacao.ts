/**
 * Recuperação idempotente de previsões de comissão de endossos ausentes:
 * varre endossos com comissão > 0 sem previsão vinculada e cria a linha em
 * comissoes_previstas (mesmo formato do fluxo de criação/edição de endosso).
 * Não mexe em regras de cálculo, baixas, estornos nem alerta de 60 dias.
 */
import type { Endorsement, Policy } from '@/types'

export interface PrevEndossoCriada {
  endossoId: string
  policyId: string
  competencia: string
  valor: number
}

export interface ReconciliacaoEndossosResult {
  verificadas: number
  criadas: number
  puladas: number
  erros: number
  detalhes: PrevEndossoCriada[]
}

const ARRED = (v: number) => Math.round(v * 100) / 100

/** Converte data endosso/criação em competência "MM/AAAA" e data prevista "AAAA-MM-DD". */
export function competenciaDoEndosso(end: Endorsement): {
  comp: string
  dataPrevista: string
} {
  const dataEndosso =
    (end.data_endosso || '').split('T')[0].split(' ')[0] ||
    (end.created || '').split('T')[0].split(' ')[0] ||
    ''
  const parts = dataEndosso.split('-')
  if (parts.length >= 3) {
    return { comp: `${parts[1]}/${parts[0]}`, dataPrevista: dataEndosso }
  }
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const y = String(now.getFullYear())
  return { comp: `${m}/${y}`, dataPrevista: `${y}-${m}-01` }
}

/**
 * Percorre endossos em memória (já carregados) e cria as previsões que faltam.
 * Usado tanto pela rotina agendada (hook server-side, sem auth) quanto para
 * reconciliação sob demanda no app — idempotente por endorsement/chave_estavel.
 */
export async function reconciliarPrevisoesEndossos(
  endorsements: Endorsement[],
  policiesById: Map<string, Policy>,
  isCreateAllowed: boolean,
): Promise<ReconciliacaoEndossosResult> {
  const res: ReconciliacaoEndossosResult = {
    verificadas: 0,
    criadas: 0,
    puladas: 0,
    erros: 0,
    detalhes: [],
  }
  const { criarPrevisaoEndosso } = await import('./previsoes-comissao')

  for (const end of endorsements) {
    res.verificadas++
    try {
      const policy = policiesById.get(end.policy)
      if (!policy) {
        res.puladas++
        continue
      }
      const liquido = Number(end.valor_liquido || 0)
      let valor = ARRED(Number(end.comissao_valor || 0))
      if (!(valor > 0)) {
        const percent = Number(end.comissao_percent || 0) || Number(policy.commission_percent || 0)
        valor = ARRED((liquido * percent) / 100)
      }
      if (!(valor > 0)) {
        res.puladas++
        continue
      }
      const { comp, dataPrevista } = competenciaDoEndosso(end)
      const criou = await criarPrevisaoEndosso({
        endossoId: end.id,
        policyId: end.policy,
        organization: (end as any).organization || '',
        tipo: end.tipo,
        valor,
        percent: Number(end.comissao_percent || 0) || Number(policy.commission_percent || 0),
        liquido,
        comp,
        dataPrevista,
        isCreateAllowed,
      })
      if (criou) {
        res.criadas++
        res.detalhes.push({
          endossoId: end.id,
          policyId: end.policy,
          competencia: comp,
          valor,
        })
      } else {
        res.puladas++
      }
    } catch {
      res.erros++
    }
  }
  return res
}
