import { TipoModeloComissao, ModeloComissaoConfig } from '@/types'
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
 * Adiciona meses a uma data YYYY-MM-DD mantendo o clamp para o último dia do mês.
 * ITEM 7:
 * 31/01 + 1 mês -> 28/02 (ou 29/02 em anos bissextos)
 * 31/12 -> 31/01 com virada correta de ano.
 * Respeita 28/01, 29/01, 30/01, 31/01, 29/02 e viradas anuais.
 */
export function addMonthsToDateWithClamp(
  baseDateStr: string,
  monthsToAdd: number,
): { dateStr: string; comp: string } {
  const parts = baseDateStr.split('-')
  const originalYear = parseInt(parts[0], 10)
  const originalMonth = parseInt(parts[1], 10) // 1-12
  const originalDay = parseInt(parts[2], 10)

  // Calcular ano e mês de destino (0-indexed para manipulação)
  const totalMonths = originalYear * 12 + (originalMonth - 1) + monthsToAdd
  const targetYear = Math.floor(totalMonths / 12)
  const targetMonthIndex = ((totalMonths % 12) + 12) % 12 // 0-11
  const targetMonthNumber = targetMonthIndex + 1

  // Determinar o último dia do mês de destino:
  // new Date(ano, mesSeguinte, 0).getDate()
  const daysInTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate()

  // Clamp do dia para não transbordar para o mês seguinte
  const clampedDay = Math.min(originalDay, daysInTargetMonth)

  const mStr = String(targetMonthNumber).padStart(2, '0')
  const dStr = String(clampedDay).padStart(2, '0')

  const comp = `${mStr}/${targetYear}`
  const dateStr = `${targetYear}-${mStr}-${dStr}`
  return { dateStr, comp }
}

/**
 * Motor central de cálculo de previsão de comissões para os 5 modelos:
 * 1. A_VISTA: Seguradora paga 1 única vez.
 * 2. PARCELADA: Recebida em N competências com clamp correto de datas.
 * 3. RECORRENTE: Periódico (mensal) durante horizonte razoável, com expansão sob demanda se próximo do fim.
 * 4. POR_FASES: Fases discretas/descontínuas (SOMENTE nas competências definidas pelas fases).
 * 5. POR_ESGOTAMENTO: Saldo total com horizonte móvel contínuo até zerar o saldo (sem teto arbitrário de 36).
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
  options?: {
    maxHorizonteRecorrente?: number
    horizonteEsgotamentoMax?: number
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

      const { dateStr, comp } = addMonthsToDateWithClamp(startDateStr, 0)
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
      const nComp = Math.max(1, Number(config.quantidade_competencias || 1))
      const customParcelas = config.parcelas || []

      if (customParcelas.length > 0) {
        for (let i = 0; i < customParcelas.length; i++) {
          const p = customParcelas[i]
          const { dateStr, comp } = addMonthsToDateWithClamp(startDateStr, i)
          let val = 0
          if (p.valor_fixo != null && p.valor_fixo > 0) {
            val = Number(p.valor_fixo)
          } else if (p.percentual != null && p.percentual > 0) {
            val = Math.round(((basePremio * Number(p.percentual)) / 100) * 100) / 100
          } else {
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
        const pctTotal = Number(modelo.percentual_padrao || policy.commission_percent || 0)
        const valorTotal =
          policy.commission != null && Number(policy.commission) > 0
            ? Number(policy.commission)
            : Math.round(((basePremio * pctTotal) / 100) * 100) / 100

        const valorBaseParcela = Math.floor((valorTotal / nComp) * 100) / 100
        const resto = Math.round((valorTotal - valorBaseParcela * nComp) * 100) / 100

        for (let i = 0; i < nComp; i++) {
          const { dateStr, comp } = addMonthsToDateWithClamp(startDateStr, i)
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
      // ITEM 9: Horizonte controlado e configurável
      const configuredHorizonte = Math.max(1, Number(config.recorrencia_meses_horizonte || 12))
      const horizonte = options?.maxHorizonteRecorrente
        ? Math.max(configuredHorizonte, options.maxHorizonteRecorrente)
        : configuredHorizonte

      const pctMensal = Number(
        config.percentual_recorrente != null
          ? config.percentual_recorrente
          : modelo.percentual_padrao != null
            ? modelo.percentual_padrao
            : policy.commission_percent || 0,
      )

      const valorMensal = Math.round(((basePremio * pctMensal) / 100) * 100) / 100

      for (let i = 0; i < horizonte; i++) {
        const { dateStr, comp } = addMonthsToDateWithClamp(startDateStr, i)
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
      // ITEM 8: Fases descontínuas.
      // Gerar previsão SOMENTE nas competências definidas pelas fases (ex: mês 1 e mês 3 -> nada no mês 2).
      // Se a última fase não for aberta/recorrente (mes_fim != null), não continuar depois dela.
      const fases = config.fases || []
      const defaultHorizonte = Math.max(12, Number(config.recorrencia_meses_horizonte || 12))

      if (fases.length === 0) {
        const pct = Number(modelo.percentual_padrao || policy.commission_percent || 0)
        const valor = Math.round(((basePremio * pct) / 100) * 100) / 100
        const { dateStr, comp } = addMonthsToDateWithClamp(startDateStr, 0)
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

      const fasesOrdenadas = [...fases].sort((a, b) => a.mes_inicio - b.mes_inicio)

      // Identificar se a última fase é aberta (mes_fim == null ou <= 0)
      const ultimaFase = fasesOrdenadas[fasesOrdenadas.length - 1]
      const ultimaFaseAberta = ultimaFase && (ultimaFase.mes_fim == null || ultimaFase.mes_fim <= 0)

      // Calcular mês máximo absoluto
      let maxMes = 1
      for (const f of fasesOrdenadas) {
        if (f.mes_fim && f.mes_fim > maxMes) {
          maxMes = f.mes_fim
        } else if (f.mes_inicio > maxMes) {
          maxMes = f.mes_inicio
        }
      }
      if (ultimaFaseAberta) {
        maxMes = Math.max(maxMes, defaultHorizonte)
      }

      let parcelaContador = 1
      for (let mes = 1; mes <= maxMes; mes++) {
        // Encontrar se existe fase correspondente para este mês
        const faseAtiva = fasesOrdenadas.find((f) => {
          const inicio = f.mes_inicio
          const fim =
            f.mes_fim != null && f.mes_fim > 0 ? f.mes_fim : ultimaFaseAberta ? Infinity : inicio
          return mes >= inicio && mes <= fim
        })

        // Se NÃO há fase cobrindo este mês (intervalo descontínuo), NÃO gera previsão!
        if (!faseAtiva) {
          continue
        }

        const pct = Number(faseAtiva.percentual || 0)
        const valorMes = Math.round(((basePremio * pct) / 100) * 100) / 100
        const { dateStr, comp } = addMonthsToDateWithClamp(startDateStr, mes - 1)

        previsoes.push({
          competencia: comp,
          data_prevista: dateStr,
          valor_previsto: Math.max(0, valorMes),
          parcela_numero: parcelaContador++,
          origem_modelo: nomeModelo,
          observacao: `Fase mês ${mes} (${faseAtiva.mes_inicio}${faseAtiva.mes_fim ? `-${faseAtiva.mes_fim}` : '+'} — ${pct}%)`,
        })
      }
      break
    }

    case 'POR_ESGOTAMENTO': {
      // ITEM 10: Continuar gerando até esgotar o saldo, sem parar arbitrariamente em 36 competências se ainda houver saldo.
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
            ? Math.round((totalSaldo / 4) * 100) / 100
            : 0,
      )

      if (totalSaldo <= 0) {
        const { dateStr, comp } = addMonthsToDateWithClamp(startDateStr, 0)
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
      // Limite seguro superior para evitar loop infinito em erros de digitação (ex: 360 meses = 30 anos)
      const maxIter = options?.horizonteEsgotamentoMax || 240

      while (saldoRestante > 0.009 && parcIndex <= maxIter) {
        const valParc = Math.min(
          saldoRestante,
          valorParcelaEstimada > 0 ? valorParcelaEstimada : saldoRestante,
        )
        const { dateStr, comp } = addMonthsToDateWithClamp(startDateStr, parcIndex - 1)

        previsoes.push({
          competencia: comp,
          data_prevista: dateStr,
          valor_previsto: Math.round(valParc * 100) / 100,
          parcela_numero: parcIndex,
          origem_modelo: nomeModelo,
          observacao: `Esgotamento — Parcela ${parcIndex} (Saldo inicial: R$ ${totalSaldo.toFixed(2)})`,
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
