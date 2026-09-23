routerAdd(
  'POST',
  '/backend/v1/parceiro-fechamento',
  (e) => {
    var auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    var role = auth.getString('role')
    // Apenas Admin, Administrador e Gerente podem registrar fechamentos/pagamentos financeiros
    if (role !== 'Admin' && role !== 'Administrador' && role !== 'Gerente') {
      return e.forbiddenError(
        'Apenas administradores e gerentes podem realizar fechamento financeiro.',
      )
    }

    // Helper inline para normalizar datas para o formato canônico do PocketBase: 'YYYY-MM-DD 00:00:00.000Z'
    var normalizeDate = function (val) {
      if (!val) {
        var now = new Date()
        var yNow = now.getFullYear()
        var mNow = String(now.getMonth() + 1).padStart(2, '0')
        var dNow = String(now.getDate()).padStart(2, '0')
        return yNow + '-' + mNow + '-' + dNow + ' 00:00:00.000Z'
      }
      var str = String(val).trim()
      var matchIso = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (matchIso) {
        return matchIso[1] + '-' + matchIso[2] + '-' + matchIso[3] + ' 00:00:00.000Z'
      }
      var matchBr = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
      if (matchBr) {
        return matchBr[3] + '-' + matchBr[2] + '-' + matchBr[1] + ' 00:00:00.000Z'
      }
      return str
    }

    var body = e.requestInfo().body || {}
    var parceiroId = body.parceiro_id || body.parceiro
    var rawDataPagamento = body.data_pagamento
    var observacoes = body.observacoes || ''
    var debitoInputs = body.debitos || []
    var taxaPixManual = body.taxa_pix_manual

    if (!parceiroId) {
      return e.badRequestError('Parceiro não informado.')
    }
    if (!rawDataPagamento) {
      return e.badRequestError('Data de pagamento não informada.')
    }

    var dataPagamento = normalizeDate(rawDataPagamento)

    var parceiro
    try {
      parceiro = $app.findRecordById('parceiros', parceiroId)
    } catch (_) {
      return e.notFoundError('Parceiro não encontrado.')
    }

    var result = null

    try {
      $app.runInTransaction((txApp) => {
        // 1. Buscar apólices com repasse pendente para este parceiro
        // Regra de segurança: apenas apólices estritamente PENDENTES (pago_parceiro != true)
        // Regra de segurança: se valor_repasse for 0.00 explícito, não recalcular!
        var safeParceiroId = String(parceiroId).replace(/["\\]/g, '')
        var filterStr =
          'parceiro = "' + safeParceiroId + '" && (pago_parceiro = false || pago_parceiro = null)'
        var policies = txApp.findRecordsByFilter('policies', filterStr, '-start_date', 1000, 0)

        // Se houver filtro específico de apólices no payload, respeitar APENAS as que estão efetivamente pendentes
        var policyIdsFilter = body.policy_ids || []
        if (policyIdsFilter.length > 0) {
          policies = policies.filter(function (p) {
            return policyIdsFilter.indexOf(p.id) !== -1 && !p.getBool('pago_parceiro')
          })
        }

        // Validação estrita: impedir criação de pagamento quando não houver NENHUM item realmente pendente
        if (policies.length === 0) {
          throw new Error(
            'Nenhum repasse pendente encontrado para este parceiro. Itens já pagos não podem compor novo pagamento.',
          )
        }

        var totalComissoes = 0
        var paidPolicyIds = []

        for (var i = 0; i < policies.length; i++) {
          var pol = policies[i]
          // Defesa dupla: garantir que não está pago
          if (pol.getBool('pago_parceiro')) {
            continue
          }
          var rep = pol.getNumber('valor_repasse')
          // Se repasse for 0, continua 0 e nunca recalcula (preservar 0 explícito)
          if (rep < 0) rep = 0
          totalComissoes += rep
          paidPolicyIds.push(pol.id)
        }

        if (paidPolicyIds.length === 0) {
          throw new Error('Nenhum item pendente elegível para inclusão neste pagamento.')
        }

        totalComissoes = Math.round(totalComissoes * 100) / 100

        // 2. Processar débitos do parceiro com a regra crítica:
        // "Se o débito do parceiro for maior que o repasse disponível, abata somente o valor disponível e mantenha o saldo restante da dívida pendente."
        var repasseDisponivel = totalComissoes
        var totalDebitosAbatidos = 0
        var debitosPlan = []

        for (var dIdx = 0; dIdx < debitoInputs.length; dIdx++) {
          var dInput = debitoInputs[dIdx]
          var originalVal = Number(dInput.valor) || 0
          var desc = dInput.descricao || 'Débito'
          var debDate = normalizeDate(dInput.data || rawDataPagamento)
          if (originalVal <= 0) continue

          var existingDebito = null
          if (dInput.id) {
            try {
              existingDebito = txApp.findRecordById('parceiro_debitos', dInput.id)
              // Se o débito já estiver 'Pago', ele NÃO pode compor o novo pagamento!
              if (existingDebito.getString('status') === 'Pago') {
                continue
              }
            } catch (_) {}
          }

          if (repasseDisponivel <= 0) {
            // Nenhum repasse sobrou para abater este débito
            // Se já existe no banco, continua pendente como está. Se não existe, planejar inserção pendente.
            if (!existingDebito) {
              debitosPlan.push({
                type: 'new_pending',
                descricao: desc,
                valor: originalVal,
                data: debDate,
              })
            }
            continue
          }

          if (originalVal <= repasseDisponivel) {
            // Abate integral deste débito
            var valorAbatido = originalVal
            repasseDisponivel = Math.round((repasseDisponivel - valorAbatido) * 100) / 100
            totalDebitosAbatidos = Math.round((totalDebitosAbatidos + valorAbatido) * 100) / 100

            debitosPlan.push({
              type: 'paid_full',
              existing: existingDebito,
              descricao: desc,
              valor: valorAbatido,
              data: debDate,
            })
          } else {
            // Débito é maior que o repasse disponível:
            // Abater SOMENTE o valor disponível e manter o saldo restante da dívida PENDENTE!
            var valorAbatidoParcial = repasseDisponivel
            var saldoRestante = Math.round((originalVal - valorAbatidoParcial) * 100) / 100

            repasseDisponivel = 0
            totalDebitosAbatidos =
              Math.round((totalDebitosAbatidos + valorAbatidoParcial) * 100) / 100

            debitosPlan.push({
              type: 'paid_partial',
              existing: existingDebito,
              descricao: desc,
              valorAbatido: valorAbatidoParcial,
              saldoRestante: saldoRestante,
              data: debDate,
            })
          }
        }

        // 3. Taxa PIX: 1% do valor a transferir (base pendente menos débitos abatidos), max R$ 10,00
        var baseTransferencia = Math.max(0, totalComissoes - totalDebitosAbatidos)
        var taxaPixCalculada = Math.round(Math.min(10, (baseTransferencia * 1) / 100) * 100) / 100
        var taxaPixFinal = taxaPixCalculada
        if (
          taxaPixManual !== undefined &&
          taxaPixManual !== null &&
          !isNaN(Number(taxaPixManual)) &&
          Number(taxaPixManual) >= 0
        ) {
          taxaPixFinal = Number(taxaPixManual)
        }

        var valorLiquido = Math.max(0, Math.round((baseTransferencia - taxaPixFinal) * 100) / 100)

        // Detalhes dos débitos para salvar no registro de pagamento
        var debitosProcessadosDetalhes = []
        for (var pIdx = 0; pIdx < debitosPlan.length; pIdx++) {
          var item = debitosPlan[pIdx]
          if (item.type === 'paid_full') {
            debitosProcessadosDetalhes.push({
              descricao: item.descricao,
              valor: item.valor,
              data: item.data,
              status: 'Pago',
            })
          } else if (item.type === 'paid_partial') {
            debitosProcessadosDetalhes.push({
              descricao: item.descricao + ' [Abatimento parcial]',
              valor: item.valorAbatido,
              saldo_restante_pendente: item.saldoRestante,
              data: item.data,
              status: 'Pago Parcial',
            })
          }
        }

        // 4. Salvar o registro de parceiro_pagamentos UMA ÚNICA VEZ com todos os totais consolidados
        // Geramos um ID explicitamente (ou setamos os campos e salvamos uma única vez)
        var pagamentosCol = txApp.findCollectionByNameOrId('parceiro_pagamentos')
        var pagRecord = new Record(pagamentosCol)
        var generatedPagamentoId = $security.randomString(15)
        pagRecord.set('id', generatedPagamentoId)
        pagRecord.set('parceiro', parceiroId)
        pagRecord.set('data_pagamento', dataPagamento)
        pagRecord.set('total_comissoes', totalComissoes)
        pagRecord.set('total_debitos', totalDebitosAbatidos)
        pagRecord.set('taxa_pix', taxaPixFinal)
        pagRecord.set('valor_liquido', valorLiquido)
        pagRecord.set('policies_ids', JSON.stringify(paidPolicyIds))
        pagRecord.set('detalhes_debitos', JSON.stringify(debitosProcessadosDetalhes))
        pagRecord.set('observacoes', observacoes)
        pagRecord.set('usuario_id', auth.id)
        pagRecord.set('usuario_nome', auth.getString('name') || auth.getString('email') || '')

        txApp.save(pagRecord)

        // Confirmar o ID salvo
        var savedPagamentoId = pagRecord.id || generatedPagamentoId

        // 5. Agora executar as mutações dos débitos vinculando savedPagamentoId de forma confiável
        var debitosCol = txApp.findCollectionByNameOrId('parceiro_debitos')
        for (var execIdx = 0; execIdx < debitosPlan.length; execIdx++) {
          var planItem = debitosPlan[execIdx]
          if (planItem.type === 'paid_full') {
            if (planItem.existing) {
              planItem.existing.set('status', 'Pago')
              planItem.existing.set('pagamento', savedPagamentoId)
              planItem.existing.set('descricao', planItem.descricao)
              planItem.existing.set('valor', planItem.valor)
              planItem.existing.set('data', planItem.data)
              txApp.save(planItem.existing)
            } else {
              var newPago = new Record(debitosCol)
              newPago.set('parceiro', parceiroId)
              newPago.set('descricao', planItem.descricao)
              newPago.set('valor', planItem.valor)
              newPago.set('data', planItem.data)
              newPago.set('status', 'Pago')
              newPago.set('pagamento', savedPagamentoId)
              txApp.save(newPago)
            }
          } else if (planItem.type === 'paid_partial') {
            if (planItem.existing) {
              // Ajusta o débito original para o valor abatido e marca como Pago vinculado ao pagamento
              planItem.existing.set('status', 'Pago')
              planItem.existing.set('pagamento', savedPagamentoId)
              planItem.existing.set('descricao', planItem.descricao + ' [Abatimento parcial]')
              planItem.existing.set('valor', planItem.valorAbatido)
              planItem.existing.set('data', planItem.data)
              txApp.save(planItem.existing)
            } else {
              var newPagoParcial = new Record(debitosCol)
              newPagoParcial.set('parceiro', parceiroId)
              newPagoParcial.set('descricao', planItem.descricao + ' [Abatimento parcial]')
              newPagoParcial.set('valor', planItem.valorAbatido)
              newPagoParcial.set('data', planItem.data)
              newPagoParcial.set('status', 'Pago')
              newPagoParcial.set('pagamento', savedPagamentoId)
              txApp.save(newPagoParcial)
            }

            // Cria o registro do saldo remanescente que continua PENDENTE (sem vínculo a pagamento)
            var saldoRemanescenteRecord = new Record(debitosCol)
            saldoRemanescenteRecord.set('parceiro', parceiroId)
            saldoRemanescenteRecord.set('descricao', planItem.descricao + ' [Saldo remanescente]')
            saldoRemanescenteRecord.set('valor', planItem.saldoRestante)
            saldoRemanescenteRecord.set('data', planItem.data)
            saldoRemanescenteRecord.set('status', 'Pendente')
            txApp.save(saldoRemanescenteRecord)
          } else if (planItem.type === 'new_pending') {
            var newPending = new Record(debitosCol)
            newPending.set('parceiro', parceiroId)
            newPending.set('descricao', planItem.descricao)
            newPending.set('valor', planItem.valor)
            newPending.set('data', planItem.data)
            newPending.set('status', 'Pendente')
            txApp.save(newPending)
          }
        }

        // 6. Atualizar todas as apólices para pago_parceiro = true e gravar a data canônica
        // NUNCA alterar valor_repasse = 0.00
        for (var pI = 0; pI < policies.length; pI++) {
          var polToUpdate = policies[pI]
          polToUpdate.set('pago_parceiro', true)
          polToUpdate.set('data_pagamento_parceiro', dataPagamento)
          polToUpdate.set('forma_pagamento_repasse', 'PIX')
          txApp.save(polToUpdate)
        }

        result = {
          success: true,
          pagamento_id: savedPagamentoId,
          parceiro_id: parceiroId,
          data_pagamento: dataPagamento,
          total_comissoes: totalComissoes,
          total_debitos_abatidos: totalDebitosAbatidos,
          taxa_pix: taxaPixFinal,
          valor_liquido: valorLiquido,
          policies_count: paidPolicyIds.length,
          policies_ids: paidPolicyIds,
          debitos_detalhes: debitosProcessadosDetalhes,
        }
      })
    } catch (err) {
      $app.logger().error('Erro na transação de fechamento de parceiro', 'error', String(err))
      var errMsg = String(err.message || err)
      return e.json(400, {
        success: false,
        message: errMsg,
        error: errMsg,
      })
    }

    return e.json(200, result)
  },
  $apis.requireAuth(),
)
