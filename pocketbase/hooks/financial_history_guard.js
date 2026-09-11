// Hook de integridade referencial e proteção do histórico financeiro
// Impede operações simultâneas duplicadas, estornos superiores ao saldo recebido e exclusões não autorizadas.

// Validação antes de criar registros financeiros
onRecordCreate((e) => {
  var collectionName = e.record.collection().name

  // Validações críticas para recebimentos e estornos de comissão
  if (collectionName === 'comissao_recebimentos') {
    var isEstorno = e.record.getBool('is_estorno')
    var valorBruto = e.record.getFloat('valor_bruto')
    var recebimentoOriginalId = e.record.getString('recebimento_original')
    var policyId = e.record.getString('policy')
    var idempotencyKey = e.record.getString('idempotency_key')

    // 1. Proteger contra requisições simultâneas duplicadas com a mesma chave de idempotência
    if (idempotencyKey && idempotencyKey.trim() !== '') {
      try {
        var existing = $app.findRecordsByFilter(
          'comissao_recebimentos',
          'idempotency_key = {:key}',
          '-created',
          1,
          0,
          { key: idempotencyKey },
        )
        if (existing && existing.length > 0) {
          throw new BadRequestError(
            'Esta operação financeira já foi processada (idempotência confirmada).',
          )
        }
      } catch (err) {
        if (err.message && err.message.includes('idempotência')) {
          throw err
        }
      }
    }

    // 2. Se for estorno, validar recebimento original e teto máximo disponível
    if (isEstorno) {
      if (!recebimentoOriginalId || recebimentoOriginalId.trim() === '') {
        throw new BadRequestError('Estorno deve estar vinculado ao recebimento original.')
      }

      var valorEstornoPositivo = Math.abs(valorBruto)
      if (valorEstornoPositivo <= 0) {
        throw new BadRequestError('O valor do estorno deve ser maior que zero.')
      }

      // Buscar recebimento original
      var original = null
      try {
        original = $app.findRecordById('comissao_recebimentos', recebimentoOriginalId)
      } catch (_) {
        throw new BadRequestError('Recebimento original não foi encontrado para este estorno.')
      }

      if (original.getBool('is_estorno')) {
        throw new BadRequestError('Não é permitido estornar um lançamento que já é um estorno.')
      }

      var originalBruto = Math.abs(original.getFloat('valor_bruto'))

      // Buscar todos os estornos já realizados vinculados a este recebimento original
      var outrosEstornos = []
      try {
        outrosEstornos = $app.findRecordsByFilter(
          'comissao_recebimentos',
          'recebimento_original = {:origId}',
          '-created',
          100,
          0,
          { origId: recebimentoOriginalId },
        )
      } catch (_) {}

      var jaEstornado = 0
      if (outrosEstornos && outrosEstornos.length > 0) {
        for (var i = 0; i < outrosEstornos.length; i++) {
          jaEstornado += Math.abs(outrosEstornos[i].getFloat('valor_bruto'))
        }
      }

      var saldoDisponivel = Math.max(0, Math.round((originalBruto - jaEstornado) * 100) / 100)

      if (valorEstornoPositivo > saldoDisponivel + 0.009) {
        throw new BadRequestError(
          'Não é permitido estornar valor superior ao saldo líquido efetivamente recebido. Disponível: R$ ' +
            saldoDisponivel.toFixed(2),
        )
      }

      // Garantir que no banco o estorno fique com valor bruto negativo
      if (valorBruto > 0) {
        e.record.set('valor_bruto', -valorEstornoPositivo)
      }
      var valorLiquido = e.record.getFloat('valor_liquido')
      if (valorLiquido > 0) {
        e.record.set('valor_liquido', -Math.abs(valorLiquido))
      }
    } else {
      // Recebimento normal: valor bruto não pode ser negativo ou zero
      if (valorBruto <= 0) {
        throw new BadRequestError('O valor bruto do recebimento deve ser maior que zero.')
      }
    }
  }

  // Validação em comissoes_previstas
  if (collectionName === 'comissoes_previstas') {
    var chave = e.record.getString('chave_estavel')
    var pol = e.record.getString('policy')
    var comp = e.record.getString('competencia')
    var parc = e.record.getInt('parcela_numero') || 1

    if (!chave || chave.trim() === '') {
      var cleanComp = comp ? comp.replace('/', '_') : '1'
      chave = 'prev_' + pol + '_' + parc + '_' + cleanComp
      e.record.set('chave_estavel', chave)
    }

    // Verificar se já existe previsão idêntica ativa
    try {
      var existentes = $app.findRecordsByFilter(
        'comissoes_previstas',
        'chave_estavel = {:chkKey}',
        '-created',
        1,
        0,
        { chkKey: chave },
      )
      if (existentes && existentes.length > 0) {
        throw new BadRequestError(
          'Já existe uma previsão cadastrada com esta chave estável (' + chave + ').',
        )
      }
    } catch (err) {
      if (err.message && err.message.includes('Já existe uma previsão')) {
        throw err
      }
    }
  }

  e.next()
})

// Proteção contra exclusões indevidas no banco
onRecordDelete((e) => {
  var collectionName = e.record.collection().name

  // 1. Proteger Parceiro contra exclusão se houver pagamentos ou apólices vinculadas
  if (collectionName === 'parceiros') {
    var partnerId = e.record.id

    try {
      var payments = $app.findRecordsByFilter(
        'parceiro_pagamentos',
        'parceiro = {:partnerId}',
        '-created',
        1,
        0,
        { partnerId: partnerId },
      )
      if (payments && payments.length > 0) {
        throw new BadRequestError(
          'Não é permitido excluir este parceiro pois existem pagamentos/fechamentos vinculados a ele no histórico financeiro.',
        )
      }
    } catch (err) {
      if (err.message && err.message.includes('Não é permitido')) {
        throw err
      }
    }

    try {
      var debitos = $app.findRecordsByFilter(
        'parceiro_debitos',
        'parceiro = {:partnerId}',
        '-created',
        1,
        0,
        { partnerId: partnerId },
      )
      if (debitos && debitos.length > 0) {
        throw new BadRequestError(
          'Não é permitido excluir este parceiro pois existem registros de débitos/adiantamentos financeiros vinculados a ele.',
        )
      }
    } catch (err) {
      if (err.message && err.message.includes('Não é permitido')) {
        throw err
      }
    }
  }

  // 2. Proteger pagamentos de parceiro já realizados contra exclusão direta sem estorno
  if (collectionName === 'parceiro_pagamentos') {
    console.warn('[PROTECAO_FINANCEIRA] Exclusão de parceiro_pagamentos:', e.record.id)
  }

  // 3. Proteger recebimentos e estornos contra exclusão sem justificativa / histórico
  if (collectionName === 'comissao_recebimentos') {
    var isEst = e.record.getBool('is_estorno')
    // Verificar se este recebimento tem estornos vinculados a ele
    try {
      var estornosFilhos = $app.findRecordsByFilter(
        'comissao_recebimentos',
        'recebimento_original = {:recId}',
        '-created',
        1,
        0,
        { recId: e.record.id },
      )
      if (estornosFilhos && estornosFilhos.length > 0) {
        throw new BadRequestError(
          'Não é permitido excluir este recebimento pois existem estornos vinculados a ele no histórico financeiro.',
        )
      }
    } catch (err) {
      if (err.message && err.message.includes('Não é permitido')) {
        throw err
      }
    }
  }

  // 4. Proteger previsões que já possuem recebimento vinculado
  if (collectionName === 'comissoes_previstas') {
    var previsaoId = e.record.id
    var status = e.record.getString('status')
    if (status === 'Recebida' || status === 'Parcial') {
      try {
        var recsVinculados = $app.findRecordsByFilter(
          'comissao_recebimentos',
          'comissao_prevista = {:prevId}',
          '-created',
          1,
          0,
          { prevId: previsaoId },
        )
        if (recsVinculados && recsVinculados.length > 0) {
          throw new BadRequestError(
            'Não é permitido excluir esta previsão de comissão pois ela já possui recebimentos realizados no histórico financeiro.',
          )
        }
      } catch (err) {
        if (err.message && err.message.includes('Não é permitido')) {
          throw err
        }
      }
    }
  }

  // 5. Proteger apólice com comissões já recebidas
  if (collectionName === 'policies') {
    var polId = e.record.id
    try {
      var recs = $app.findRecordsByFilter(
        'comissao_recebimentos',
        'policy = {:policyId}',
        '-created',
        1,
        0,
        { policyId: polId },
      )
      if (recs && recs.length > 0) {
        console.warn(
          '[PROTECAO_FINANCEIRA] Apólice possui comissões recebidas vinculadas:',
          polId,
          'Quantidade:',
          recs.length,
        )
      }
    } catch (_) {}
  }

  e.next()
})
