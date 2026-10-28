migrate(
  (app) => {
    // Estorno do pagamento ac0280c8r0o1s02 registrado por engano
    var pagamentoId = 'ac0280c8r0o1s02'
    var policyIds = ['3yw6a7n6sqq03rh', 'dse5ugcvc8xg3sd', 'ej2zmdejgsl8ovw', '7zi9pqu8o9748sj']

    // 1. Reverter apólices
    for (var i = 0; i < policyIds.length; i++) {
      try {
        var pol = app.findRecordById('policies', policyIds[i])
        pol.set('pago_parceiro', false)
        pol.set('data_pagamento_parceiro', '')
        app.save(pol)
      } catch (e) {
        // Se apólice não existir, ignora
      }
    }

    // 2. Reverter débitos vinculados se houver
    try {
      var debitos = app.findRecordsByFilter(
        'parceiro_debitos',
        'pagamento = "' + pagamentoId + '"',
        '-created',
        500,
        0,
      )
      for (var dI = 0; dI < debitos.length; dI++) {
        var deb = debitos[dI]
        deb.set('status', 'Pendente')
        deb.set('pagamento', '')
        app.save(deb)
      }
    } catch (_) {}

    // 3. Remover o registro de parceiro_pagamentos
    try {
      var pagRecord = app.findRecordById('parceiro_pagamentos', pagamentoId)
      app.delete(pagRecord)
    } catch (_) {
      // Já deletado ou não encontrado
    }
  },
  (app) => {
    // Reversão não necessária / no-op
  },
)
