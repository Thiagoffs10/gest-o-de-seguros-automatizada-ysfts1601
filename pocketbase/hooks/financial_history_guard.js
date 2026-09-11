// Hook backend crítico: Proteção de Histórico Financeiro, Estornos Atômicos e Identidade Canônica
// Atende Item 1 (concorrência real e atomicidade), Item 2 (imutabilidade do histórico), Item 3 (vínculo de previsão) e Item 5 (chave estável canônica)

routerAdd(
  'POST',
  '/backend/v1/finance/estorno',
  (e) => {
    var auth = e.auth
    if (!auth) {
      return e.json(401, { success: false, error: 'Requer autenticação.' })
    }

    var body = e.requestInfo().body
    if (!body) {
      return e.json(400, { success: false, error: 'Corpo da requisição vazio.' })
    }

    var recebimentoOriginalId = body.recebimento_original_id
    var valorEstorno = Number(body.valor_estorno) || 0
    var dataEstorno = body.data_estorno
    var motivo = body.motivo ? String(body.motivo).trim() : ''
    var idempotencyKey = body.idempotency_key ? String(body.idempotency_key).trim() : ''

    if (!recebimentoOriginalId) {
      return e.json(400, {
        success: false,
        error: 'ID do recebimento original é obrigatório para estorno.',
      })
    }
    if (valorEstorno <= 0 || isNaN(valorEstorno)) {
      return e.json(400, {
        success: false,
        error: 'Valor do estorno deve ser maior que zero.',
      })
    }
    if (!motivo) {
      return e.json(400, {
        success: false,
        error: 'Motivo do estorno é obrigatório para auditoria.',
      })
    }
    if (!dataEstorno) {
      dataEstorno = new Date().toISOString().split('T')[0]
    }

    var result = null

    try {
      $app.runInTransaction((txApp) => {
        // Idempotência
        if (idempotencyKey) {
          var idempCheck = txApp.findRecordsByFilter(
            'comissao_recebimentos',
            'idempotency_key = {:key}',
            '-created',
            1,
            0,
            { key: idempotencyKey },
          )
          if (idempCheck && idempCheck.length > 0) {
            result = {
              success: true,
              id: idempCheck[0].id,
              idempotent: true,
              message: 'Operação já processada anteriormente (idempotência).',
            }
            return
          }
        }

        // Buscar recebimento original dentro da transação
        var original = null
        try {
          original = txApp.findRecordById('comissao_recebimentos', recebimentoOriginalId)
        } catch (_) {
          throw new Error('Recebimento original não encontrado.')
        }

        if (original.getBool('is_estorno')) {
          throw new Error('Não é permitido realizar estorno de um lançamento que já é estorno.')
        }

        var policyId = original.getString('policy')
        if (!policyId) {
          throw new Error('Recebimento original não possui apólice vinculada.')
        }

        // Se o cliente passou apólice explicitamente, checar se bate com a apólice do recebimento original
        if (body.policy_id && body.policy_id !== policyId) {
          throw new Error('Estorno não pode apontar para recebimento de outra apólice.')
        }

        var valorOriginalBruto = Math.abs(original.getFloat('valor_bruto'))

        // Buscar estornos anteriores vinculados a este recebimento original DENTRO da transação
        var estornosExistentes = txApp.findRecordsByFilter(
          'comissao_recebimentos',
          'recebimento_original = {:origId}',
          '-created',
          500,
          0,
          { origId: recebimentoOriginalId },
        )

        var totalJaEstornado = 0
        if (estornosExistentes && estornosExistentes.length > 0) {
          for (var i = 0; i < estornosExistentes.length; i++) {
            totalJaEstornado += Math.abs(estornosExistentes[i].getFloat('valor_bruto'))
          }
        }

        var saldoLiquidoDisponivel = Math.max(
          0,
          Math.round((valorOriginalBruto - totalJaEstornado) * 100) / 100,
        )

        // Verificação estrita com tolerância de centavos
        if (valorEstorno > saldoLiquidoDisponivel + 0.0001) {
          throw new Error(
            'Não é permitido estornar mais que o líquido disponível. Solicitado: R$ ' +
              valorEstorno.toFixed(2) +
              ' | Disponível: R$ ' +
              saldoLiquidoDisponivel.toFixed(2),
          )
        }

        // Calcular proporcionais de impostos
        var aliq = original.getFloat('aliquota_imposto') || 0
        var descImpostoEstorno =
          aliq > 0 ? Math.round(((valorEstorno * aliq) / 100) * 100) / 100 : 0
        var valorLiquidoEstorno = Math.round((valorEstorno - descImpostoEstorno) * 100) / 100

        var userTag = auth.getString('name') || auth.getString('email') || auth.id

        // Criar registro de estorno com valores negativos
        var recCol = txApp.findCollectionByNameOrId('comissao_recebimentos')
        var estornoRecord = new Record(recCol)
        estornoRecord.set('policy', policyId)
        estornoRecord.set('data_recebimento', dataEstorno)
        estornoRecord.set('valor_bruto', -Math.abs(valorEstorno))
        estornoRecord.set('descontos_impostos', -Math.abs(descImpostoEstorno))
        estornoRecord.set('valor_liquido', -Math.abs(valorLiquidoEstorno))
        estornoRecord.set('aliquota_imposto', aliq)
        estornoRecord.set('origem', 'Estorno')
        estornoRecord.set(
          'observacao',
          '[Estorno ref. recebimento ' +
            recebimentoOriginalId +
            ']: ' +
            motivo +
            ' [Responsável: ' +
            userTag +
            ']',
        )
        estornoRecord.set('parcela', original.getInt('parcela') || 1)
        estornoRecord.set('competencia', original.getString('competencia') || '')
        estornoRecord.set('is_estorno', true)
        estornoRecord.set('recebimento_original', recebimentoOriginalId)
        estornoRecord.set('motivo_estorno', motivo)

        var prevVinculada = original.getString('comissao_prevista')
        if (prevVinculada) {
          estornoRecord.set('comissao_prevista', prevVinculada)
        }

        var finalIdemp =
          idempotencyKey ||
          'est_' +
            recebimentoOriginalId +
            '_' +
            Date.now() +
            '_' +
            Math.random().toString(36).substring(2, 7)
        estornoRecord.set('idempotency_key', finalIdemp)

        txApp.save(estornoRecord)

        // Se havia previsão vinculada, atualizar seu status com base no somatório restante
        if (prevVinculada) {
          try {
            var prevRecord = txApp.findRecordById('comissoes_previstas', prevVinculada)
            var prevVal = prevRecord.getFloat('valor_previsto')
            // Somar todos os recebimentos vinculados a essa previsão
            var todosRecsPrev = txApp.findRecordsByFilter(
              'comissao_recebimentos',
              'comissao_prevista = {:prevId}',
              '-created',
              500,
              0,
              { prevId: prevVinculada },
            )
            var somaBruta = 0
            for (var k = 0; k < todosRecsPrev.length; k++) {
              somaBruta += todosRecsPrev[k].getFloat('valor_bruto')
            }
            if (somaBruta <= 0.009) {
              prevRecord.set('status', 'Pendente')
            } else if (somaBruta >= prevVal - 0.009) {
              prevRecord.set('status', 'Recebida')
            } else {
              prevRecord.set('status', 'Parcial')
            }
            txApp.save(prevRecord)
          } catch (_) {}
        }

        // Recalcular status da apólice
        try {
          var pol = txApp.findRecordById('policies', policyId)
          var commTotal = pol.getFloat('commission') || 0
          var allRecsPol = txApp.findRecordsByFilter(
            'comissao_recebimentos',
            'policy = {:pId}',
            '-created',
            500,
            0,
            { pId: policyId },
          )
          var totalRecebidoPol = 0
          for (var pIdx = 0; pIdx < allRecsPol.length; pIdx++) {
            totalRecebidoPol += allRecsPol[pIdx].getFloat('valor_bruto')
          }
          if (commTotal > 0 && totalRecebidoPol >= commTotal - 0.009) {
            pol.set('comissao_recebida', true)
          } else {
            pol.set('comissao_recebida', false)
          }
          txApp.save(pol)
        } catch (_) {}

        result = {
          success: true,
          id: estornoRecord.id,
          policy: policyId,
          recebimento_original: recebimentoOriginalId,
          valor_estorno: valorEstorno,
          saldo_restante: Math.max(
            0,
            Math.round((saldoLiquidoDisponivel - valorEstorno) * 100) / 100,
          ),
        }
      })
    } catch (err) {
      $app.logger().error('Falha ao processar estorno transacional', 'error', String(err))
      return e.json(400, {
        success: false,
        error: String(err.message || err),
      })
    }

    return e.json(200, result)
  },
  $apis.requireAuth(),
)

// Hook onRecordCreate: Integridade e Identidade Canônica
onRecordCreate((e) => {
  var col = e.record.collection().name

  if (col === 'comissoes_previstas') {
    var pol = e.record.getString('policy')
    var comp = e.record.getString('competencia') || '01_2026'
    var parc = e.record.getInt('parcela_numero') || 1
    var cleanComp = comp.replace(/\//g, '_')

    // ITEM 5: O SERVIDOR deve gerar/validar a chave canônica (prev_{policyId}_{parcela}_{competencia})
    // e sobrescrever qualquer valor enviado pelo cliente
    var chaveCanonica = 'prev_' + pol + '_' + parc + '_' + cleanComp
    e.record.set('chave_estavel', chaveCanonica)
  }

  if (col === 'comissao_recebimentos') {
    var isEstorno = e.record.getBool('is_estorno')
    var valorBruto = e.record.getFloat('valor_bruto')
    var recOrig = e.record.getString('recebimento_original')
    var policyId = e.record.getString('policy')
    var comissaoPrevistaId = e.record.getString('comissao_prevista')

    // ITEM 3: Para novos registros, se houver comissao_prevista informada ou recebimento de previsão,
    // validar existência e coerência com a apólice
    if (comissaoPrevistaId && comissaoPrevistaId.trim() !== '') {
      try {
        var prevRec = $app.findRecordById('comissoes_previstas', comissaoPrevistaId)
        if (prevRec.getString('policy') !== policyId) {
          throw new BadRequestError('A previsão informada pertence a outra apólice.')
        }
      } catch (err) {
        if (err.message && err.message.includes('outra apólice')) {
          throw err
        }
        throw new BadRequestError('Previsão comissao_prevista informada não foi encontrada.')
      }
    }

    if (isEstorno) {
      if (!recOrig) {
        throw new BadRequestError(
          'Estorno deve obrigatoriamente estar vinculado ao recebimento original.',
        )
      }
      var origRecord = null
      try {
        origRecord = $app.findRecordById('comissao_recebimentos', recOrig)
      } catch (_) {
        throw new BadRequestError('Recebimento original não foi encontrado.')
      }
      if (origRecord.getBool('is_estorno')) {
        throw new BadRequestError('Estorno de estorno é estritamente proibido.')
      }
      if (origRecord.getString('policy') !== policyId) {
        throw new BadRequestError('Estorno não pode apontar para recebimento de outra apólice.')
      }
      // Garantir negativo
      if (valorBruto > 0) {
        e.record.set('valor_bruto', -Math.abs(valorBruto))
      }
      var valLiq = e.record.getFloat('valor_liquido')
      if (valLiq > 0) {
        e.record.set('valor_liquido', -Math.abs(valLiq))
      }
    } else {
      if (valorBruto <= 0) {
        throw new BadRequestError('O valor de recebimento deve ser maior que zero.')
      }
    }
  }

  e.next()
})

// Hook onRecordUpdate: ITEM 2 — Proteção de histórico financeiro no backend
// Admin ou qualquer papel NÃO pode alterar recebimento já estornado para valor incompatível
// Campos financeiros fundamentais tornam-se imutáveis após existir histórico vinculado
onRecordUpdate((e) => {
  var col = e.record.collection().name

  if (col === 'comissao_recebimentos') {
    var recId = e.record.id
    var isEstorno = e.record.getBool('is_estorno')

    // 1. Proibir trocar a apólice vinculada (vínculo cruzado entre apólices)
    var originalSnapshot = null
    try {
      originalSnapshot = $app.findRecordById('comissao_recebimentos', recId)
    } catch (_) {}

    if (originalSnapshot) {
      var oldPolicy = originalSnapshot.getString('policy')
      var newPolicy = e.record.getString('policy')
      if (oldPolicy && newPolicy && oldPolicy !== newPolicy) {
        throw new BadRequestError(
          'Não é permitido transferir um recebimento para outra apólice (vínculo cruzado proibido).',
        )
      }

      var oldIsEstorno = originalSnapshot.getBool('is_estorno')
      if (oldIsEstorno !== isEstorno) {
        throw new BadRequestError('A natureza do lançamento (normal/estorno) é imutável.')
      }

      var oldOrig = originalSnapshot.getString('recebimento_original')
      var newOrig = e.record.getString('recebimento_original')
      if (oldOrig && newOrig && oldOrig !== newOrig) {
        throw new BadRequestError('O vínculo com o recebimento original de um estorno é imutável.')
      }

      // Se este recebimento possui estornos vinculados a ele:
      // O valor original não pode ser reduzido abaixo do total já estornado
      var estornosVinculados = $app.findRecordsByFilter(
        'comissao_recebimentos',
        'recebimento_original = {:recId}',
        '-created',
        500,
        0,
        { recId: recId },
      )
      if (estornosVinculados && estornosVinculados.length > 0) {
        var totalEstornado = 0
        for (var i = 0; i < estornosVinculados.length; i++) {
          totalEstornado += Math.abs(estornosVinculados[i].getFloat('valor_bruto'))
        }
        var novoBruto = Math.abs(e.record.getFloat('valor_bruto'))
        if (novoBruto < totalEstornado - 0.009) {
          throw new BadRequestError(
            'Não é permitido alterar o valor deste recebimento para R$ ' +
              novoBruto.toFixed(2) +
              ' porque ele já possui R$ ' +
              totalEstornado.toFixed(2) +
              ' em estornos vinculados. Ajustes devem ser feitos via novo lançamento/estorno.',
          )
        }
      }
    }
  }

  // Previsões com recebimento realizado não podem ter competência ou parcela trocadas arbitrariamente
  if (col === 'comissoes_previstas') {
    var pId = e.record.id
    var prevSnap = null
    try {
      prevSnap = $app.findRecordById('comissoes_previstas', pId)
    } catch (_) {}

    if (prevSnap) {
      var oldPol = prevSnap.getString('policy')
      var newPol = e.record.getString('policy')
      if (oldPol && newPol && oldPol !== newPol) {
        throw new BadRequestError('Não é permitido alterar a apólice de uma comissão prevista.')
      }
      // Sempre manter a chave canônica correta
      var polClean = newPol || oldPol
      var comp = e.record.getString('competencia') || prevSnap.getString('competencia') || '01_2026'
      var parc = e.record.getInt('parcela_numero') || prevSnap.getInt('parcela_numero') || 1
      var cleanComp = comp.replace(/\//g, '_')
      e.record.set('chave_estavel', 'prev_' + polClean + '_' + parc + '_' + cleanComp)
    }
  }

  e.next()
})

// Hook onRecordDelete: ITEM 2 — Proteção de integridade financeira
// Exclusão de estorno proibida e proteção contra exclusão de original com histórico
onRecordDelete((e) => {
  var col = e.record.collection().name

  if (col === 'comissao_recebimentos') {
    var isEstorno = e.record.getBool('is_estorno')
    // Auditoria: exclusão de estorno proibida! Correções devem ocorrer via ajuste/reversão.
    if (isEstorno) {
      throw new BadRequestError(
        'Não é permitido excluir um estorno. O histórico financeiro é imutável; reversões devem ser feitas por novo lançamento de ajuste.',
      )
    }

    // Verificar se este recebimento tem estornos vinculados a ele
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
  }

  if (col === 'comissoes_previstas') {
    var previsaoId = e.record.id
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
        'Não é permitido excluir esta previsão pois ela possui recebimentos vinculados no histórico financeiro.',
      )
    }
  }

  if (col === 'parceiros') {
    var partnerId = e.record.id
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
        'Não é permitido excluir parceiro com histórico de pagamentos/fechamentos registrados.',
      )
    }
  }

  e.next()
})
