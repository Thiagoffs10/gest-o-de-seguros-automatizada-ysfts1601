migrate(
  function (app) {
    // [MIGRATION 0065] Recuperação idempotente: previsões de comissão de endossos faltantes.
    // A 0053 (1770000022) rodou em 09/11 e não cobriu endossos criados depois
    // (ex. aoomaoeva6cpe6e, policy x75o9ph5uvbi0uq — R$ 113,74, competência 11/2026),
    // porque o caminho de CRIAÇÃO de endosso não gerava previsão (corrigido no serviço).
    // O arquivo 0064 tem o mesmo nome de uma migração já aplicada nesta instância, por
    // isso esta nova versão: idempotente, pula endossos que já possuem previsão por
    // campo endorsement OU por chave_estavel OU por observação de backfill anterior.
    // Não toca em recebimentos existentes — o recebimento de R$ 348,09 permanece
    // alocado somente à previsão base da apólice.
    const prevCol = app.findCollectionByNameOrId('comissoes_previstas')

    let endorsements = []
    try {
      endorsements = app.findRecordsByFilter(
        'endorsements',
        '(valor_liquido > 0 || comissao_valor > 0)',
        '-created',
        0,
        0,
      )
    } catch (err) {
      console.log('[MIGRATION 0065] Erro ao buscar endossos:', err)
      return
    }

    let criadas = 0
    let jaTinham = 0
    let puladas = 0

    for (let i = 0; i < endorsements.length; i++) {
      const end = endorsements[i]
      const policyId = end.getString('policy')
      if (!policyId) {
        puladas++
        continue
      }

      // Apólice pai cancelada não recebe previsão ativa
      let pol = null
      try {
        pol = app.findFirstRecordByData('policies', 'id', policyId)
      } catch (_) {}
      if (pol && pol.getString('status') === 'Cancelada') {
        puladas++
        continue
      }

      // Valor previsto: comissao_valor do endosso; se ausente/zerado, calcula do líquido × %
      let commValor = Math.round(Number(end.get('comissao_valor')) * 100) / 100
      if (!(commValor > 0)) {
        const vLiqFallback = Number(end.get('valor_liquido')) || 0
        const percent =
          Number(end.get('comissao_percent')) ||
          (pol ? Number(pol.get('commission_percent')) || 0 : 0)
        commValor = Math.round(((vLiqFallback * percent) / 100) * 100) / 100
      }
      if (!(commValor > 0)) {
        puladas++
        continue
      }

      // Idempotência principal: já existe previsão vinculada por campo endorsement?
      let existing = []
      try {
        existing = app.findRecordsByFilter(
          'comissoes_previstas',
          `endorsement = '${end.id}'`,
          '',
          1,
          0,
        )
      } catch (_) {}
      if (existing && existing.length > 0) {
        jaTinham++
        continue
      }

      // Competência/data prevista = mês do endosso (mesma regra de createEndorsement)
      const dataEndosso = (end.getString('data_endosso') || end.getString('created') || '')
        .split('T')[0]
        .split(' ')[0]
      let comp = ''
      let dataPrevista = dataEndosso
      const parts = dataEndosso.split('-')
      if (parts.length >= 2) {
        comp = `${parts[1]}/${parts[0]}`
      }
      if (!comp) {
        const now = new Date()
        const m = String(now.getMonth() + 1).padStart(2, '0')
        const y = String(now.getFullYear())
        comp = `${m}/${y}`
        dataPrevista = `${y}-${m}-01`
      }

      const compClean = comp.replace('/', '_')
      const stableKey = `prev_end_${end.id}_1_${compClean}`

      // Idempotência secundária pela chave estável (não repetir a 0053 nem a 0064)
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
        jaTinham++
        continue
      }

      const tipo = end.getString('tipo') || 'Alteração'
      const percentUsado =
        Number(end.get('comissao_percent')) ||
        (pol ? Number(pol.get('commission_percent')) || 0 : 0)
      const vLiq = Number(end.get('valor_liquido')) || 0
      const obs = `Backfill 0065 — Endosso (${tipo}) — ${percentUsado}% sobre líq. R$ ${vLiq.toFixed(2)}`

      const rec = new Record(prevCol)
      rec.set('policy', policyId)
      rec.set('endorsement', end.id)
      rec.set('competencia', comp)
      rec.set('data_prevista', dataPrevista)
      rec.set('valor_previsto', commValor)
      rec.set('parcela_numero', 1)
      rec.set('origem_modelo', `Endosso: ${tipo}`)
      rec.set('status', 'Pendente')
      rec.set('observacao', obs)
      rec.set('chave_estavel', stableKey)

      // organization = mesma da apólice (ou do endosso, se vier preenchido)
      const orgId = end.getString('organization') || (pol ? pol.getString('organization') : '')
      if (orgId) {
        rec.set('organization', orgId)
      }

      try {
        app.save(rec)
        criadas++
        console.log(
          `[MIGRATION 0065] Previsão criada para endosso ${end.id} (policy ${policyId}): ${comp} R$ ${commValor}`,
        )
      } catch (err) {
        console.log(`[MIGRATION 0065] Erro ao salvar previsão do endosso ${end.id}:`, err)
      }
    }

    console.log(
      `[MIGRATION 0065] Concluído: criadas=${criadas}, já existentes=${jaTinham}, puladas=${puladas}`,
    )
  },
  function (app) {
    // Reverte apenas as previsões criadas por este backfill
    try {
      const recs = app.findRecordsByFilter(
        'comissoes_previstas',
        "observacao ~ 'Backfill 0065 — Endosso'",
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
