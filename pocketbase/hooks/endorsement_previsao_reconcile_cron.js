// Cron diário: reconcilia previsões de comissão de endossos faltantes (idempotente).
// Cobertura de segurança para endossos criados por QUALQUER caminho (incl. importações
// ou falhas silenciosas) — pula endossos que já têm previsão por campo endorsement ou
// por chave_estavel. Não toca em comissões, baixas, estornos nem no alerta de 60 dias.
cronAdd('reconcilia_previsoes_endossos', '17 5 * * *', () => {
  try {
    let endorsements = []
    try {
      endorsements = $app.findRecordsByFilter(
        'endorsements',
        'valor_liquido > 0 || comissao_valor > 0',
        '-created',
        0,
        0,
      )
    } catch (err) {
      $app
        .logger()
        .error('reconcilia_previsoes_endossos: erro ao buscar endossos', 'error', String(err))
      return
    }

    let criadas = 0
    let puladas = 0
    let erros = 0

    for (let i = 0; i < endorsements.length; i++) {
      const end = endorsements[i]
      const policyId = end.getString('policy')
      if (!policyId) continue

      let pol = null
      try {
        pol = $app.findFirstRecordByData('policies', 'id', policyId)
      } catch (_) {}
      if (!pol || pol.getString('status') === 'Cancelada') {
        puladas++
        continue
      }

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
        existing = $app.findRecordsByFilter(
          'comissoes_previstas',
          `endorsement = '${end.id}'`,
          '',
          1,
          0,
        )
      } catch (_) {}
      if (existing && existing.length > 0) {
        puladas++
        continue
      }

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

      let existePorChave = []
      try {
        existePorChave = $app.findRecordsByFilter(
          'comissoes_previstas',
          `chave_estavel = '${stableKey}'`,
          '',
          1,
          0,
        )
      } catch (_) {}
      if (existePorChave && existePorChave.length > 0) {
        puladas++
        continue
      }

      const prevCol = $app.findCollectionByNameOrId('comissoes_previstas')
      const tipo = end.getString('tipo') || 'Alteração'
      const percentUsado =
        Number(end.get('comissao_percent')) ||
        (pol ? Number(pol.get('commission_percent')) || 0 : 0)
      const vLiq = Number(end.get('valor_liquido')) || 0

      const rec = new Record(prevCol)
      rec.set('policy', policyId)
      rec.set('endorsement', end.id)
      rec.set('competencia', comp)
      rec.set('data_prevista', dataPrevista)
      rec.set('valor_previsto', commValor)
      rec.set('parcela_numero', 1)
      rec.set('origem_modelo', `Endosso: ${tipo}`)
      rec.set('status', 'Pendente')
      rec.set(
        'observacao',
        `Reconciliação automática — Endosso (${tipo}) — ${percentUsado}% sobre líq. R$ ${vLiq.toFixed(2)}`,
      )
      rec.set('chave_estavel', stableKey)
      const orgId = end.getString('organization') || pol.getString('organization') || ''
      if (orgId) rec.set('organization', orgId)

      try {
        $app.save(rec)
        criadas++
        $app
          .logger()
          .info(
            `reconcilia_previsoes_endossos: previsão criada endosso=${end.id} policy=${policyId} comp=${comp} valor=${commValor}`,
          )
      } catch (err) {
        erros++
        $app
          .logger()
          .warn(
            `reconcilia_previsoes_endossos: falha ao salvar previsão endosso=${end.id}`,
            'error',
            String(err),
          )
      }
    }

    $app
      .logger()
      .info(
        `reconcilia_previsoes_endossos concluído: criadas=${criadas}, puladas=${puladas}, erros=${erros}`,
      )
  } catch (err) {
    $app.logger().error('reconcilia_previsoes_endossos: erro geral', 'error', String(err))
  }
})
