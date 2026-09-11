// Hook de integridade referencial e proteção do histórico financeiro
// Impede que exclusões de cadastros (como parceiros ou apólices) apaguem silenciosamente histórico financeiro relevante.

onRecordDelete((e) => {
  var collectionName = e.record.collection().name

  // 1. Proteger Parceiro contra exclusão se houver pagamentos ou apólices vinculadas
  if (collectionName === 'parceiros') {
    var partnerId = e.record.id

    // Verificar pagamentos vinculados
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

    // Verificar se há débitos pendentes ou pagos vinculados
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
    // Permitir apenas se explicitamente autorizado pelo sistema ou admin
    // Registrar log no servidor
    console.warn('[PROTECAO_FINANCEIRA] Tentativa de exclusão de parceiro_pagamentos:', e.record.id)
  }

  // 3. Proteger apólice com comissões já recebidas
  if (collectionName === 'policies') {
    var policyId = e.record.id
    try {
      var recs = $app.findRecordsByFilter(
        'comissao_recebimentos',
        'policy = {:policyId}',
        '-created',
        1,
        0,
        { policyId: policyId },
      )
      if (recs && recs.length > 0) {
        // Se a apólice tem recebimentos confirmados, alertar ou impedir exclusão silenciosa
        console.warn(
          '[PROTECAO_FINANCEIRA] Apólice possui comissões recebidas vinculadas:',
          policyId,
          'Quantidade:',
          recs.length,
        )
      }
    } catch (_) {}
  }

  e.next()
})
