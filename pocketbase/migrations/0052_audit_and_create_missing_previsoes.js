migrate(
  (app) => {
    // 1. Auditoria e criação de previsões faltantes para apólices ativas com comissão
    const prevCol = app.findCollectionByNameOrId('comissoes_previstas')

    // Buscar apólices com status "Ativa" e commission > 0
    let policies = []
    try {
      policies = app.findRecordsByFilter(
        'policies',
        "status = 'Ativa' && commission > 0",
        'created',
        0,
        0,
      )
    } catch (err) {
      console.log('Erro ao buscar apólices ativas:', err)
      return
    }

    console.log(
      '[MIGRATION 0052] Total de apólices ativas com commission > 0 encontradas:',
      policies.length,
    )

    let criadasCount = 0
    let jaTinhamCount = 0
    let puladasCount = 0

    for (let i = 0; i < policies.length; i++) {
      const pol = policies[i]
      const policyId = pol.id

      // Verificar se já existe qualquer previsão para esta apólice
      let prevExistentes = []
      try {
        prevExistentes = app.findRecordsByFilter(
          'comissoes_previstas',
          `policy = '${policyId}'`,
          '',
          1,
          0,
        )
      } catch (_) {}

      if (prevExistentes && prevExistentes.length > 0) {
        jaTinhamCount++
        continue
      }

      // Regra de comissão e ISS
      const commBruta = Number(pol.get('commission')) || 0
      const iss = Number(pol.get('iss')) || 0
      const valorLiquidoPrevisto = Math.round(Math.max(0, commBruta - iss) * 100) / 100

      if (valorLiquidoPrevisto <= 0) {
        puladasCount++
        continue
      }

      // Competência e data prevista baseadas em start_date (ou created como fallback)
      let startDateStr = pol.getString('start_date') || pol.getString('created') || ''
      // Formato esperado de start_date: 'YYYY-MM-DD...'
      let comp = ''
      let dataPrevista = ''
      if (startDateStr) {
        const d = startDateStr.split('T')[0].split(' ')[0]
        dataPrevista = d
        const parts = d.split('-')
        if (parts.length >= 2) {
          const y = parts[0]
          const m = parts[1]
          comp = `${m}/${y}`
        }
      }

      if (!comp) {
        const now = new Date()
        const m = String(now.getMonth() + 1).padStart(2, '0')
        const y = String(now.getFullYear())
        comp = `${m}/${y}`
        dataPrevista = `${y}-${m}-01`
      }

      const compClean = comp.replace('/', '_')
      const stableKey = `prev_${policyId}_1_${compClean}`

      // Verificar se por acaso já existe pela chave_estavel
      let existePorChave = []
      try {
        existePorChave = app.findRecordsByFilter(
          'comissoes_previstas',
          `chave_estavel = '${stableKey}'`,
          '',
          1,
          0,
        )
      } catch (_) {}

      if (existePorChave && existePorChave.length > 0) {
        jaTinhamCount++
        continue
      }

      // Determinar origem_modelo
      let origemModelo = 'Por saldo/esgotamento'
      const modeloId = pol.getString('modelo_comissao')
      if (modeloId) {
        try {
          const modRec = app.findCollectionByNameOrId('modelos_comissao')
          const m = app.findFirstRecordByData('modelos_comissao', 'id', modeloId)
          if (m) {
            origemModelo = m.getString('nome') || 'Por saldo/esgotamento'
          }
        } catch (_) {}
      }

      const obs = `Previsão retroativa — produção ${comp} — Comissão Líquida Prevista: R$ ${valorLiquidoPrevisto.toFixed(2)}`

      const rec = new Record(prevCol)
      rec.set('policy', policyId)
      rec.set('competencia', comp)
      rec.set('data_prevista', dataPrevista)
      rec.set('valor_previsto', valorLiquidoPrevisto)
      rec.set('parcela_numero', 1)
      rec.set('origem_modelo', origemModelo)
      rec.set('status', 'Pendente')
      rec.set('observacao', obs)
      rec.set('chave_estavel', stableKey)

      try {
        app.save(rec)
        criadasCount++
        console.log(
          `[MIGRATION 0052] Previsão criada para policy ${policyId} (proposta ${pol.getString('numero_proposta')}): ${comp} R$ ${valorLiquidoPrevisto}`,
        )
      } catch (err) {
        console.log(`[MIGRATION 0052] Erro ao salvar previsão para policy ${policyId}:`, err)
      }
    }

    console.log(
      `[MIGRATION 0052] Concluído: criadas=${criadasCount}, já existentes=${jaTinhamCount}, puladas=${puladasCount}`,
    )
  },
  (app) => {
    // Reverter apenas as criadas com a observação retroativa
    try {
      const recs = app.findRecordsByFilter(
        'comissoes_previstas',
        "observacao ~ 'Previsão retroativa — produção'",
        '',
        0,
        0,
      )
      for (let i = 0; i < recs.length; i++) {
        app.delete(recs[i])
      }
    } catch (_) {}
  },
)
