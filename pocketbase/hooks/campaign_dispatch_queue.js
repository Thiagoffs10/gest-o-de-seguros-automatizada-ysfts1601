// Endpoint de Processamento de Envio da Fila (com Teto Diário de 100 e Mensal de 3.000)
// Fila de Esgotamento: prioriza quem já estava em espera (ESGOTAMENTO_ESPERA) primeiro.
// Quem não couber hoje fica em espera e vai primeiro amanhã.
// Registra cada envio em campaign_send_logs e communications.

routerAdd(
  'POST',
  '/backend/v1/campaigns/dispatch-queue',
  (e) => {
    var auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    var userRole = auth.getString('role')
    if (userRole !== 'Admin' && userRole !== 'Administrador' && userRole !== 'Gerente') {
      return e.forbiddenError(
        'Apenas administradores e gerentes podem autorizar o disparo da fila.',
      )
    }

    var body = e.requestInfo().body || {}
    var maxBatch = parseInt(body.limit || '100', 10) || 100
    if (maxBatch > 100) maxBatch = 100 // Teto rígido por dia: 100 e-mails

    var apiKey = $secrets.get('RESEND_API_KEY') || $os.getenv('RESEND_API_KEY')
    if (!apiKey) {
      return e.json(503, {
        success: false,
        message: 'Chave RESEND_API_KEY não configurada no backend.',
      })
    }

    var verifiedEmailSecret =
      $secrets.get('VERIFIED_FROM_EMAIL') ||
      $os.getenv('VERIFIED_FROM_EMAIL') ||
      $secrets.get('SENDER_EMAIL') ||
      $os.getenv('SENDER_EMAIL')
    var rawDefaultSender = verifiedEmailSecret || 'noreply@cred10mix.com.br'
    var formatSender = function (sender) {
      if (!sender) return 'CRED10MIX <noreply@cred10mix.com.br>'
      var trimmed = sender.trim()
      if (trimmed.indexOf('<') !== -1 && trimmed.indexOf('>') !== -1) {
        return trimmed
      }
      return 'CRED10MIX <' + trimmed + '>'
    }
    var fromEmail = formatSender(rawDefaultSender)

    var mandatoryFooter =
      '\n\n---\n' +
      'Acesse nosso site: www.cred10mix.com.br\n' +
      'Siga-nos no Instagram: @cred10mix\n' +
      'Qualquer contato deve ser feito via WhatsApp: 81 98865-3534 (Thiago Souza) - https://wa.me/5581988653534\n' +
      'Este é um e-mail automático e não monitorado. Por favor, realize todo contato via WhatsApp.'

    var nowDate = new Date()
    var nowDateStr = nowDate.toISOString().split('T')[0]
    var currentYearMonth = nowDateStr.substring(0, 7) // 'YYYY-MM'

    // 1. Checar envio acumulado no mês (Teto de 3.000/mês)
    var monthlyLogs = []
    try {
      monthlyLogs = $app.findRecordsByFilter(
        'campaign_send_logs',
        "data_envio >= '" + currentYearMonth + "-01' && status_envio = 'ENVIADO'",
        'created',
        3500,
        0,
      )
    } catch (_) {}

    var monthlySentCount = monthlyLogs.length
    var monthlyCap = 3000
    var monthlyRemaining = Math.max(0, monthlyCap - monthlySentCount)

    if (monthlyRemaining <= 0) {
      return e.json(200, {
        success: false,
        message:
          'Teto mensal de 3.000 e-mails atingido neste mês. O envio foi bloqueado para segurança.',
        monthly_sent: monthlySentCount,
        monthly_cap: monthlyCap,
        daily_sent: 0,
      })
    }

    // 2. Checar envio acumulado no dia (Teto de 100/dia)
    var dailyLogs = []
    try {
      dailyLogs = $app.findRecordsByFilter(
        'campaign_send_logs',
        "data_envio = '" + nowDateStr + "' && status_envio = 'ENVIADO'",
        'created',
        200,
        0,
      )
    } catch (_) {}

    var dailySentCount = dailyLogs.length
    var dailyCap = 100
    var dailyRemaining = Math.max(0, dailyCap - dailySentCount)

    if (dailyRemaining <= 0) {
      return e.json(200, {
        success: false,
        message:
          'Teto diário de 100 e-mails já foi atingido hoje (' +
          dailySentCount +
          '/100). Fila em espera para amanhã.',
        daily_sent: dailySentCount,
        daily_cap: dailyCap,
        monthly_sent: monthlySentCount,
      })
    }

    var allowedNow = Math.min(maxBatch, dailyRemaining, monthlyRemaining)

    // 3. Buscar itens elegíveis na fila:
    // Ordem de prioridade na Fila de Esgotamento:
    // Primeiro quem estava em espera anterior (ESGOTAMENTO_ESPERA), depois os recém aprovados (APROVADO),
    // ordenados por prioridade e tempo de criação mais antigo (FIFO)
    var queueItems = []
    try {
      // PocketBase filter com parênteses
      queueItems = $app.findRecordsByFilter(
        'campaign_queue',
        "status = 'ESGOTAMENTO_ESPERA' || status = 'APROVADO'",
        'created',
        200,
        0,
      )
    } catch (qErr) {
      $app.logger().error('failed to query queue', 'err', String(qErr))
    }

    if (queueItems.length === 0) {
      return e.json(200, {
        success: true,
        message: 'Nenhum e-mail aprovado aguardando envio na fila.',
        sent: 0,
        daily_sent_total: dailySentCount,
        monthly_sent_total: monthlySentCount,
      })
    }

    // Ordenar: primeiro ESGOTAMENTO_ESPERA, depois APROVADO
    queueItems.sort(function (a, b) {
      var aStatus = a.getString('status')
      var bStatus = b.getString('status')
      if (aStatus === 'ESGOTAMENTO_ESPERA' && bStatus !== 'ESGOTAMENTO_ESPERA') return -1
      if (bStatus === 'ESGOTAMENTO_ESPERA' && aStatus !== 'ESGOTAMENTO_ESPERA') return 1
      return 0
    })

    var toSend = queueItems.slice(0, allowedNow)
    var overflow = queueItems.slice(allowedNow)

    // Marcar overflow como ESGOTAMENTO_ESPERA para que vá primeiro amanhã
    for (var oIdx = 0; oIdx < overflow.length; oIdx++) {
      var overItem = overflow[oIdx]
      if (overItem.getString('status') !== 'ESGOTAMENTO_ESPERA') {
        overItem.set('status', 'ESGOTAMENTO_ESPERA')
        $app.save(overItem)
      }
    }

    var commsCol = $app.findCollectionByNameOrId('communications')
    var logsCol = $app.findCollectionByNameOrId('campaign_send_logs')

    var sentNow = 0
    var failedNow = 0

    for (var sIdx = 0; sIdx < toSend.length; sIdx++) {
      var item = toSend[sIdx]
      var clientId = item.getString('client')
      var campId = item.getString('campanha')
      var subject = item.getString('assunto')
      var bodyText = item.getString('corpo')

      var client = null
      try {
        client = $app.findRecordById('clients', clientId)
      } catch (_) {}

      if (!client) {
        item.set('status', 'FALHOU')
        item.set('erro_log', 'Cliente não encontrado no banco')
        $app.save(item)
        failedNow++
        continue
      }

      var toEmail = client.getString('email')
      if (!toEmail || !toEmail.trim()) {
        item.set('status', 'FALHOU')
        item.set('erro_log', 'Cliente não possui e-mail válido')
        $app.save(item)
        failedNow++
        continue
      }

      var fullEmailBody = bodyText + mandatoryFooter

      var resendPayload = {
        from: fromEmail,
        to: [toEmail],
        subject: subject,
        text: fullEmailBody,
      }

      var emailOk = false
      var resendId = ''
      var errMsg = ''

      try {
        var res = $http.send({
          url: 'https://api.resend.com/emails',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(resendPayload),
          timeout: 30,
        })

        if (res.statusCode >= 200 && res.statusCode < 300) {
          emailOk = true
          if (res.json && res.json.id) {
            resendId = res.json.id
          }
        } else {
          errMsg = 'HTTP ' + res.statusCode
          if (res.json && res.json.message) errMsg = res.json.message
        }
      } catch (sendErr) {
        errMsg = String(sendErr)
      }

      if (emailOk) {
        sentNow++
        item.set('status', 'ENVIADO')
        item.set('data_envio', nowDateStr)
        $app.save(item)

        // Registrar em campaign_send_logs (para controle de ciclo e frequência)
        try {
          var logRec = new Record(logsCol)
          logRec.set('campanha', campId)
          logRec.set('client', clientId)
          logRec.set('passo_ordem', item.getInt('passo_ordem'))
          logRec.set('tipo_mensagem', item.getString('tipo_mensagem'))
          logRec.set('tema', item.getString('tema'))
          logRec.set('assunto', subject)
          logRec.set('recipient_email', toEmail)
          logRec.set('data_envio', nowDateStr)
          logRec.set('status_envio', 'ENVIADO')
          logRec.set('resend_id', resendId)
          $app.save(logRec)
        } catch (lErr) {
          $app.logger().error('failed to save campaign send log', 'err', String(lErr))
        }

        // Registrar em communications (visível no histórico geral e no cliente)
        try {
          var comm = new Record(commsCol)
          comm.set('type', 'Email')
          comm.set('client', clientId)
          comm.set('subject', subject)
          comm.set('body', fullEmailBody)
          comm.set('recipient_email', toEmail)
          comm.set('status', 'Enviado')
          comm.set('sent_date', nowDateStr)
          $app.save(comm)
        } catch (cErr) {
          $app.logger().error('failed to save communication record', 'err', String(cErr))
        }

        // Incrementar total_enviados na campanha
        try {
          var campRecord = $app.findRecordById('campaign_automations', campId)
          campRecord.set('total_enviados', (campRecord.getInt('total_enviados') || 0) + 1)
          $app.save(campRecord)
        } catch (_) {}
      } else {
        failedNow++
        var attempts = (item.getInt('tentativas') || 0) + 1
        item.set('tentativas', attempts)
        item.set('erro_log', errMsg)
        if (attempts >= 3) {
          item.set('status', 'FALHOU')
        } else {
          item.set('status', 'ESGOTAMENTO_ESPERA')
        }
        $app.save(item)
      }
    }

    var newDailyTotal = dailySentCount + sentNow
    var newMonthlyTotal = monthlySentCount + sentNow
    var isNearMonthlyCap = newMonthlyTotal >= 2700

    return e.json(200, {
      success: true,
      sent: sentNow,
      failed: failedNow,
      overflow_in_waiting: overflow.length,
      daily_total: newDailyTotal,
      daily_cap: dailyCap,
      monthly_total: newMonthlyTotal,
      monthly_cap: monthlyCap,
      near_monthly_cap: isNearMonthlyCap,
      message:
        sentNow +
        ' e-mail(s) disparado(s) com sucesso. ' +
        (overflow.length > 0
          ? overflow.length + ' permaneceram na fila de esgotamento para envio prioritário amanhã.'
          : '') +
        (isNearMonthlyCap
          ? ' ALERTA: Próximo ao limite mensal (' + newMonthlyTotal + '/3000).'
          : ''),
    })
  },
  $apis.requireAuth(),
)
