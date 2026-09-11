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

    var body = e.requestInfo().body || {}
    var parceiroId = body.parceiro_id || body.parceiro
    var dataPagamento = body.data_pagamento
    var observacoes = body.observacoes || ''
    var debitoInputs = body.debitos || []
    var taxaPixManual = body.taxa_pix_manual

    if (!parceiroId) {
      return e.badRequestError('Parceiro não informado.')
    }
    if (!dataPagamento) {
      return e.badRequestError('Data de pagamento não informada.')
    }

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
        var policies = txApp.findRecordsByFilter(
          'policies',
          'parceiro = {:parceiroId} && (pago_parceiro = false || pago_parceiro = null)',
          '-start_date',
          1000,
          0,
          { parceiroId: parceiroId },
        )

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
        var debitosProcessadosDetalhes = []

        // 2.1 Criar registro de pagamento primeiro para vincular
        var pagamentosCol = txApp.findCollectionByNameOrId('parceiro_pagamentos')
        var pagRecord = new Record(pagamentosCol)
        pagRecord.set('parceiro', parceiroId)
        pagRecord.set('data_pagamento', dataPagamento)
        pagRecord.set('total_comissoes', totalComissoes)
        pagRecord.set('policies_ids', JSON.stringify(paidPolicyIds))
        pagRecord.set('observacoes', observacoes)
        pagRecord.set('usuario_id', auth.id)
        pagRecord.set('usuario_nome', auth.getString('name') || auth.getString('email') || '')

        // Salvar provisoriamente para obter o ID no SQLite dentro da tx
        txApp.save(pagRecord)

        var debitosCol = txApp.findCollectionByNameOrId('parceiro_debitos')

        for (var dIdx = 0; dIdx < debitoInputs.length; dIdx++) {
          var dInput = debitoInputs[dIdx]
          var originalVal = Number(dInput.valor) || 0
          var desc = dInput.descricao || 'Débito'
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
            // Mantém pendente integralmente
            if (!existingDebito) {
              var newPending = new Record(debitosCol)
              newPending.set('parceiro', parceiroId)
              newPending.set('descricao', desc)
              newPending.set('valor', originalVal)
              newPending.set('data', dInput.data || dataPagamento)
              newPending.set('status', 'Pendente')
              txApp.save(newPending)
            }
            continue
          }

          if (originalVal <= repasseDisponivel) {
            // Abate integral deste débito
            var valorAbatido = originalVal
            repasseDisponivel = Math.round((repasseDisponivel - valorAbatido) * 100) / 100
            totalDebitosAbatidos = Math.round((totalDebitosAbatidos + valorAbatido) * 100) / 100

            if (existingDebito) {
              existingDebito.set('status', 'Pago')
              existingDebito.set('pagamento', pagRecord.id)
              existingDebito.set('descricao', desc)
              existingDebito.set('valor', valorAbatido)
              txApp.save(existingDebito)
            } else {
              var newPago = new Record(debitosCol)
              newPago.set('parceiro', parceiroId)
              newPago.set('descricao', desc)
              newPago.set('valor', valorAbatido)
              newPago.set('data', dInput.data || dataPagamento)
              newPago.set('status', 'Pago')
              newPago.set('pagamento', pagRecord.id)
              txApp.save(newPago)
            }

            debitosProcessadosDetalhes.push({
              descricao: desc,
              valor: valorAbatido,
              data: dInput.data || dataPagamento,
              status: 'Pago',
            })
          } else {
            // Débito é maior que o repasse disponível:
            // Abater SOMENTE o valor disponível e manter o saldo restante da dívida PENDENTE!
            var valorAbatidoParcial = repasseDisponivel
            var saldoRestante = Math.round((originalVal - valorAbatidoParcial) * 100) / 100

            repasseDisponivel = 0
            totalDebitosAbatidos =
              Math.round((totalDebitosAbatidos + valorAbatidoParcial) * 100) / 100

            if (existingDebito) {
              // Ajusta o débito original para o valor abatido e marca como Pago vinculado ao pagamento
              existingDebito.set('status', 'Pago')
              existingDebito.set('pagamento', pagRecord.id)
              existingDebito.set('descricao', desc + ' [Abatimento parcial]')
              existingDebito.set('valor', valorAbatidoParcial)
              txApp.save(existingDebito)
            } else {
              var newPagoParcial = new Record(debitosCol)
              newPagoParcial.set('parceiro', parceiroId)
              newPagoParcial.set('descricao', desc + ' [Abatimento parcial]')
              newPagoParcial.set('valor', valorAbatidoParcial)
              newPagoParcial.set('data', dInput.data || dataPagamento)
              newPagoParcial.set('status', 'Pago')
              newPagoParcial.set('pagamento', pagRecord.id)
              txApp.save(newPagoParcial)
            }

            // Cria o registro do saldo remanescente que continua PENDENTE
            var saldoRemanescenteRecord = new Record(debitosCol)
            saldoRemanescenteRecord.set('parceiro', parceiroId)
            saldoRemanescenteRecord.set('descricao', desc + ' [Saldo remanescente]')
            saldoRemanescenteRecord.set('valor', saldoRestante)
            saldoRemanescenteRecord.set('data', dInput.data || dataPagamento)
            saldoRemanescenteRecord.set('status', 'Pendente')
            txApp.save(saldoRemanescenteRecord)

            debitosProcessadosDetalhes.push({
              descricao: desc + ' [Abatimento parcial]',
              valor: valorAbatidoParcial,
              saldo_restante_pendente: saldoRestante,
              data: dInput.data || dataPagamento,
              status: 'Pago Parcial',
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

        // 4. Atualizar registro do parceiro_pagamento com os números consolidados finais
        pagRecord.set('total_debitos', totalDebitosAbatidos)
        pagRecord.set('taxa_pix', taxaPixFinal)
        pagRecord.set('valor_liquido', valorLiquido)
        pagRecord.set('detalhes_debitos', JSON.stringify(debitosProcessadosDetalhes))
        txApp.save(pagRecord)

        // 5. Atualizar todas as apólices para pago_parceiro = true e gravar a data
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
          pagamento_id: pagRecord.id,
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
      return e.json(400, {
        success: false,
        error: String(err.message || err),
      })
    }

    return e.json(200, result)
  },
  $apis.requireAuth(),
)
