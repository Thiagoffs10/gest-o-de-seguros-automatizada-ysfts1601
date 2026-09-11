import {
  TipoModeloComissao,
  ModeloComissao,
  ModeloComissaoConfig,
  ComissaoPrevista,
  Policy,
} from '@/types'
import { formatDateForInput } from '@/lib/utils'

export interface PrevisaoItemCalculada {
  competencia: string // MM/YYYY
  data_prevista: string // YYYY-MM-DD
  valor_previsto: number
  parcela_numero: number
  origem_modelo: string
  observacao?: string
}

/**
 * Adiciona meses a uma data YYYY-MM-DD mantendo o dia aproximado.
 */
function addMonthsToDate(
  baseDateStr: string,
  monthsToAdd: number,
): { dateStr: string; comp: string } {
  const parts = baseDateStr.split('-')
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1 // 0-based
  const day = parseInt(parts[2], 10)

  const d = new Date(year, month + monthsToAdd, day)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dayStr = String(d.getDate()).padStart(2, '0')

  const comp = `${m}/${y}`
  const dateStr = `${y}-${m}-${dayStr}`
  return { dateStr, comp }
}

/**
 * Motor central de cálculo de previsão de comissões para os 5 modelos:
 * 1. A_VISTA: Seguradora paga 1 única vez. Ex.: Prêmio R$ 1.000, 20% -> R$ 200.
 * 2. PARCELADA: Recebida em N competências (percentuais iguais ou customizados por competência).
 * 3. RECORRENTE: Periódico (mensal) durante horizonte razoável (padrão 12 meses). Ex.: 5% mensal.
 * 4. POR_FASES: Fases ao longo do tempo (ex: Mês 1 a 3: 100%, Mês 4+: 2%).
 * 5. POR_ESGOTAMENTO: Saldo total com parcelas consumindo até o valor esgotar.
 */
export function calcularPrevisoesComissao(
  policy: {
    start_date: string
    valor_liquido?: number
    premium_amount?: number
    commission_percent?: number
    commission?: number
  },
  modelo: {
    tipo_modelo: TipoModeloComissao
    percentual_padrao?: number
    nome?: string
    config_json?: ModeloComissaoConfig
  },
): PrevisaoItemCalculada[] {
  const basePremio = Number(policy.valor_liquido || policy.premium_amount || 0)
  const startDateStr =
    formatDateForInput(policy.start_date) || new Date().toISOString().split('T')[0]
  const config = modelo.config_json || {}
  const nomeModelo = modelo.nome || modelo.tipo_modelo
  const previsoes: PrevisaoItemCalculada[] = []

  switch (modelo.tipo_modelo) {
    case 'A_VISTA': {
      // Exemplo: Prêmio R$ 1.000, comissão 20% -> R$ 200
      const pct =
        modelo.percentual_padrao != null && modelo.percentual_padrao > 0
          ? Number(modelo.percentual_padrao)
          : Number(policy.commission_percent || 0)

      let valorPrevisto =
        policy.commission != null && Number(policy.commission) > 0
          ? Number(policy.commission)
          : Math.round(((basePremio * pct) / 100) * 100) / 100

      if (valorPrevisto <= 0 && policy.commission) {
        valorPrevisto = Number(policy.commission)
      }

      const { dateStr, comp } = addMonthsToDate(startDateStr, 0)
      previsoes.push({
        competencia: comp,
        data_prevista: dateStr,
        valor_previsto: Math.max(0, Math.round(valorPrevisto * 100) / 100),
        parcela_numero: 1,
        origem_modelo: nomeModelo,
        observacao: `À Vista — ${pct}% sobre prêmio líquido`,
      })
      break
    }

    case 'PARCELADA': {
      // Exemplo: 7 competências com percentuais definidos ou distribuídos
      const nComp = Math.max(1, Number(config.quantidade_competencias || 1))
      const customParcelas = config.parcelas || []

      // Se há parcelas customizadas definidas com percentual ou valor fixo
      if (customParcelas.length > 0) {
        for (let i = 0; i < customParcelas.length; i++) {
          const p = customParcelas[i]
          const { dateStr, comp } = addMonthsToDate(startDateStr, i)
          let val = 0
          if (p.valor_fixo != null && p.valor_fixo > 0) {
            val = Number(p.valor_fixo)
          } else if (p.percentual != null && p.percentual > 0) {
            val = Math.round(((basePremio * Number(p.percentual)) / 100) * 100) / 100
          } else {
            // Percentual padrão dividido
            const pctPadrao = Number(modelo.percentual_padrao || policy.commission_percent || 0)
            val = Math.round(((basePremio * pctPadrao) / 100 / nComp) * 100) / 100
          }

          previsoes.push({
            competencia: comp,
            data_prevista: dateStr,
            valor_previsto: Math.max(0, Math.round(val * 100) / 100),
            parcela_numero: p.numero || i + 1,
            origem_modelo: nomeModelo,
            observacao: `Parcela ${i + 1}/${customParcelas.length}`,
          })
        }
      } else {
        // Distribui o valor total ou percentual igualmente em nComp
        const pctTotal = Number(modelo.percentual_padrao || policy.commission_percent || 0)
        const valorTotal =
          policy.commission != null && Number(policy.commission) > 0
            ? Number(policy.commission)
            : Math.round(((basePremio * pctTotal) / 100) * 100) / 100

        const valorBaseParcela = Math.floor((valorTotal / nComp) * 100) / 100
        const resto = Math.round((valorTotal - valorBaseParcela * nComp) * 100) / 100

        for (let i = 0; i < nComp; i++) {
          const { dateStr, comp } = addMonthsToDate(startDateStr, i)
          // Na última parcela ajusta o arredondamento de centavos
          const val =
            i === nComp - 1 ? Math.round((valorBaseParcela + resto) * 100) / 100 : valorBaseParcela
          previsoes.push({
            competencia: comp,
            data_prevista: dateStr,
            valor_previsto: Math.max(0, val),
            parcela_numero: i + 1,
            origem_modelo: nomeModelo,
            observacao: `Parcela ${i + 1}/${nComp} — ${nComp} competências`,
          })
        }
      }
      break
    }

    case 'RECORRENTE': {
      // Exemplo: 5% mensal. Gera horizonte razoável (ex: 12 meses)
      const horizonte = Math.max(1, Number(config.recorrencia_meses_horizonte || 12))
      const pctMensal = Number(
        config.percentual_recorrente != null
          ? config.percentual_recorrente
          : modelo.percentual_padrao != null
            ? modelo.percentual_padrao
            : policy.commission_percent || 0,
      )

      const valorMensal = Math.round(((basePremio * pctMensal) / 100) * 100) / 100

      for (let i = 0; i < horizonte; i++) {
        const { dateStr, comp } = addMonthsToDate(startDateStr, i)
        previsoes.push({
          competencia: comp,
          data_prevista: dateStr,
          valor_previsto: Math.max(0, valorMensal),
          parcela_numero: i + 1,
          origem_modelo: nomeModelo,
          observacao: `Recorrência mês ${i + 1} (${pctMensal}% mensal - horizonte ${horizonte}m)`,
        })
      }
      break
    }

    case 'POR_FASES': {
      // Exemplo: 1º ao 3º mês 100%; a partir do 4º mês 2%.
      const fases = config.fases || []
      const horizonte = Math.max(12, Number(config.recorrencia_meses_horizonte || 12))

      if (fases.length === 0) {
        // Fallback para taxa padrão se nenhuma fase foi cadastrada
        const pct = Number(modelo.percentual_padrao || policy.commission_percent || 0)
        const valor = Math.round(((basePremio * pct) / 100) * 100) / 100
        const { dateStr, comp } = addMonthsToDate(startDateStr, 0)
        previsoes.push({
          competencia: comp,
          data_prevista: dateStr,
          valor_previsto: valor,
          parcela_numero: 1,
          origem_modelo: nomeModelo,
          observacao: 'Fase 1 (padrão)',
        })
        break
      }

      // Ordenar fases pelo mês de início
      const fasesOrdenadas = [...fases].sort((a, b) => a.mes_inicio - b.mes_inicio)

      for (let mes = 1; mes <= horizonte; mes++) {
        // Achar a fase correspondente ao mês
        const faseAtiva =
          fasesOrdenadas.find((f) => {
            const inicio = f.mes_inicio
            const fim = f.mes_fim != null && f.mes_fim > 0 ? f.mes_fim : Infinity
            return mes >= inicio && mes <= fim
          }) || fasesOrdenadas[fasesOrdenadas.length - 1]

        const pct = Number(faseAtiva?.percentual || 0)
        const valorMes = Math.round(((basePremio * pct) / 100) * 100) / 100
        const { dateStr, comp } = addMonthsToDate(startDateStr, mes - 1)

        previsoes.push({
          competencia: comp,
          data_prevista: dateStr,
          valor_previsto: Math.max(0, valorMes),
          parcela_numero: mes,
          origem_modelo: nomeModelo,
          observacao: `Fase ${faseAtiva.mes_inicio}${faseAtiva.mes_fim ? `-${faseAtiva.mes_fim}` : '+'} (${pct}%)`,
        })
      }
      break
    }

    case 'POR_ESGOTAMENTO': {
      // Exemplo: Total de R$ 1.000 a receber e pagamentos continuam até esgotar o saldo
      const totalSaldo = Number(
        config.saldo_total != null && Number(config.saldo_total) > 0
          ? config.saldo_total
          : policy.commission != null && Number(policy.commission) > 0
            ? policy.commission
            : Math.round(
                ((basePremio * Number(modelo.percentual_padrao || policy.commission_percent || 0)) /
                  100) *
                  100,
              ) / 100,
      )

      const valorParcelaEstimada = Number(
        config.valor_estimado_parcela && Number(config.valor_estimado_parcela) > 0
          ? config.valor_estimado_parcela
          : totalSaldo > 0
            ? Math.round((totalSaldo / 4) * 100) / 100 // padrão 4 competências estimadas
            : 0,
      )

      if (totalSaldo <= 0) {
        const { dateStr, comp } = addMonthsToDate(startDateStr, 0)
        previsoes.push({
          competencia: comp,
          data_prevista: dateStr,
          valor_previsto: 0,
          parcela_numero: 1,
          origem_modelo: nomeModelo,
          observacao: 'Por esgotamento — saldo R$ 0',
        })
        break
      }

      let saldoRestante = totalSaldo
      let parcIndex = 1

      while (saldoRestante > 0.009 && parcIndex <= 36) {
        const valParc = Math.min(
          saldoRestante,
          valorParcelaEstimada > 0 ? valorParcelaEstimada : saldoRestante,
        )
        const { dateStr, comp } = addMonthsToDate(startDateStr, parcIndex - 1)

        previsoes.push({
          competencia: comp,
          data_prevista: dateStr,
          valor_previsto: Math.round(valParc * 100) / 100,
          parcela_numero: parcIndex,
          origem_modelo: nomeModelo,
          observacao: `Esgotamento — Parcela ${parcIndex} (Saldo total: R$ ${totalSaldo.toFixed(2)})`,
        })

        saldoRestante = Math.round((saldoRestante - valParc) * 100) / 100
        parcIndex++
      }
      break
    }

    default:
      break
  }

  return previsoes
}
