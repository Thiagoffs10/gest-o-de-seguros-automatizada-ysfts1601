migrate(
  (app) => {
    console.log(
      '[MIGRATION 0055] Iniciando verificação e sincronização idempotente de legado e competências...',
    )

    // =========================================================================
    // PARTE 1: Preenchimento de competência vazia em comissao_recebimentos
    // Idempotente: atualiza apenas onde competencia = '' ou null
    // =========================================================================
    let emptyCompRecs = []
    try {
      emptyCompRecs = app.findRecordsByFilter(
        'comissao_recebimentos',
        "competencia = '' || competencia = null",
        'created',
        0,
        0,
      )
    } catch (err) {
      console.log('[MIGRATION 0055] Erro ao buscar comissao_recebimentos sem competência:', err)
      emptyCompRecs = []
    }

    console.log(
      `[MIGRATION 0055] Total de recebimentos com competência vazia encontrados: ${emptyCompRecs.length}`,
    )

    let recsAtualizadosCount = 0

    for (let i = 0; i < emptyCompRecs.length; i++) {
      const rec = emptyCompRecs[i]
      const recId = rec.id
      const dataRec = rec.getString('data_recebimento') || ''
      const compAntiga = rec.getString('competencia') || ''

      if (!dataRec) {
        console.log(`[MIGRATION 0055] Recebimento ${recId} sem data_recebimento, pulando.`)
        continue
      }

      // Regra idêntica a inferirCompetenciaRecebimento: 'YYYY-MM-DD...' -> 'MM/YYYY'
      const datePart = dataRec.split('T')[0].split(' ')[0]
      const parts = datePart.split('-')
      if (parts.length >= 2) {
        const y = parts[0]
        const m = parts[1].length === 1 ? '0' + parts[1] : parts[1]
        const compInferida = m + '/' + y

        console.log(
          `[MIGRATION 0055] Recebimento ${recId} (apólice ${rec.getString('policy')}): competência ANTES='${compAntiga}', DEPOIS='${compInferida}' (data_recebimento: ${dataRec})`,
        )

        rec.set('competencia', compInferida)
        try {
          app.save(rec)
          recsAtualizadosCount++
        } catch (err) {
          console.log(`[MIGRATION 0055] Erro ao salvar recebimento ${recId}:`, err)
        }
      }
    }

    console.log(
      `[MIGRATION 0055] Parte 1 concluída: ${recsAtualizadosCount} recebimentos tiveram competência preenchida.`,
    )

    // =========================================================================
    // PARTE 2: Atualização de comissoes_previstas 'Pendente' para 'Recebida'
    // onde o valor previsto está provadamente quitado por recebimentos da apólice
    // Idempotente: atualiza apenas previsões com status 'Pendente' cujo saldo recebido >= previsto
    // =========================================================================
    let prevsPendentes = []
    try {
      prevsPendentes = app.findRecordsByFilter(
        'comissoes_previstas',
        "status = 'Pendente'",
        'created',
        0,
        0,
      )
    } catch (err) {
      console.log('[MIGRATION 0055] Erro ao buscar comissoes_previstas pendentes:', err)
      prevsPendentes = []
    }

    console.log(
      `[MIGRATION 0055] Total de previsões com status 'Pendente' encontradas: ${prevsPendentes.length}`,
    )

    let prevsAtualizadasCount = 0

    // Agrupar previsões pendentes por apólice
    const prevsByPolicy = {}
    for (let i = 0; i < prevsPendentes.length; i++) {
      const p = prevsPendentes[i]
      const polId = p.getString('policy')
      if (!prevsByPolicy[polId]) {
        prevsByPolicy[polId] = []
      }
      prevsByPolicy[polId].push(p)
    }

    const policyIds = Object.keys(prevsByPolicy)
    for (let k = 0; k < policyIds.length; k++) {
      const polId = policyIds[k]
      const polPrevs = prevsByPolicy[polId]

      // Buscar todos os recebimentos vinculados à apólice
      let polRecs = []
      try {
        polRecs = app.findRecordsByFilter(
          'comissao_recebimentos',
          `policy = '${polId}'`,
          'data_recebimento',
          0,
          0,
        )
      } catch (err) {
        console.log(`[MIGRATION 0055] Erro ao buscar recebimentos da apólice ${polId}:`, err)
        continue
      }

      if (polRecs.length === 0) continue

      // Buscar todas as previsões da apólice (inclusive não pendentes) para checar cobertura
      let allPrevsForPolicy = []
      try {
        allPrevsForPolicy = app.findRecordsByFilter(
          'comissoes_previstas',
          `policy = '${polId}'`,
          'created',
          0,
          0,
        )
      } catch (_) {
        allPrevsForPolicy = polPrevs
      }

      // Total de valores recebidos brutos da apólice
      let totalBrutoRecebido = 0
      for (let r = 0; r < polRecs.length; r++) {
        totalBrutoRecebido += Number(polRecs[r].get('valor_bruto')) || 0
      }
      totalBrutoRecebido = Math.round(totalBrutoRecebido * 100) / 100

      if (allPrevsForPolicy.length === 1) {
        const singlePrev = allPrevsForPolicy[0]
        if (singlePrev.getString('status') === 'Pendente') {
          const vPrev = Number(singlePrev.get('valor_previsto')) || 0
          if (vPrev > 0 && totalBrutoRecebido >= vPrev - 0.01) {
            console.log(
              `[MIGRATION 0055] Previsão única ${singlePrev.id} (apólice ${polId}): status ANTES='Pendente', DEPOIS='Recebida' (previsto=${vPrev}, recebido=${totalBrutoRecebido})`,
            )
            singlePrev.set('status', 'Recebida')
            try {
              app.save(singlePrev)
              prevsAtualizadasCount++
            } catch (err) {
              console.log(
                `[MIGRATION 0055] Erro ao salvar status da previsão ${singlePrev.id}:`,
                err,
              )
            }
          }
        }
      } else {
        // Múltiplas previsões: vínculo direto ou competência unívoca
        for (let pIdx = 0; pIdx < polPrevs.length; pIdx++) {
          const prev = polPrevs[pIdx]
          const prevId = prev.id
          const vPrev = Number(prev.get('valor_previsto')) || 0
          const compPrev = prev.getString('competencia') || ''

          if (vPrev <= 0) continue

          // 1. Recebimentos vinculados diretamente a esta previsão por id
          let recsDiretos = []
          let brutoDireto = 0
          for (let r = 0; r < polRecs.length; r++) {
            if (polRecs[r].getString('comissao_prevista') === prevId) {
              recsDiretos.push(polRecs[r])
              brutoDireto += Number(polRecs[r].get('valor_bruto')) || 0
            }
          }
          brutoDireto = Math.round(brutoDireto * 100) / 100

          if (brutoDireto >= vPrev - 0.01) {
            console.log(
              `[MIGRATION 0055] Previsão ${prevId} (vínculo direto, apólice ${polId}): status ANTES='Pendente', DEPOIS='Recebida' (previsto=${vPrev}, recebido_direto=${brutoDireto})`,
            )
            prev.set('status', 'Recebida')
            try {
              app.save(prev)
              prevsAtualizadasCount++
            } catch (err) {
              console.log(`[MIGRATION 0055] Erro ao salvar status da previsão ${prevId}:`, err)
            }
            continue
          }

          // 2. Se não tem vínculo direto por ID, checar por competência única exata
          if (compPrev) {
            let recsMesmaComp = []
            let brutoComp = 0
            for (let r = 0; r < polRecs.length; r++) {
              let rComp = polRecs[r].getString('competencia') || ''
              if (!rComp) {
                const d = polRecs[r].getString('data_recebimento') || ''
                if (d) {
                  const dp = d.split('T')[0].split(' ')[0].split('-')
                  if (dp.length >= 2)
                    rComp = (dp[1].length === 1 ? '0' + dp[1] : dp[1]) + '/' + dp[0]
                }
              }
              if (rComp === compPrev) {
                recsMesmaComp.push(polRecs[r])
                brutoComp += Number(polRecs[r].get('valor_bruto')) || 0
              }
            }
            brutoComp = Math.round(brutoComp * 100) / 100

            let prevsMesmaComp = 0
            for (let a = 0; a < allPrevsForPolicy.length; a++) {
              if (allPrevsForPolicy[a].getString('competencia') === compPrev) {
                prevsMesmaComp++
              }
            }

            if (prevsMesmaComp === 1 && brutoComp >= vPrev - 0.01) {
              console.log(
                `[MIGRATION 0055] Previsão ${prevId} (competência unívoca ${compPrev}, apólice ${polId}): status ANTES='Pendente', DEPOIS='Recebida' (previsto=${vPrev}, recebido_comp=${brutoComp})`,
              )
              prev.set('status', 'Recebida')
              try {
                app.save(prev)
                prevsAtualizadasCount++
              } catch (err) {
                console.log(`[MIGRATION 0055] Erro ao salvar status da previsão ${prevId}:`, err)
              }
            }
          }
        }
      }
    }

    console.log(
      `[MIGRATION 0055] Parte 2 concluída: ${prevsAtualizadasCount} previsões tiveram status atualizado para 'Recebida'.`,
    )
    console.log('[MIGRATION 0055] Migração 0055 finalizada com sucesso.')
  },
  (app) => {
    console.log('[MIGRATION 0055] Downnoop')
  },
)
