routerAdd(
  'POST',
  '/backend/v1/send-monthly-birthdays',
  (e) => {
    var body = e.requestInfo().body || {}
    var targetMonth = body.month ? parseInt(body.month, 10) : new Date().getMonth() + 1 // 1-12
    var reminderId = body.reminder_id || ''
    var customSubject = body.subject || ''
    var customBody = body.body || ''

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
    var fromEmail = formatSender(body.from || rawDefaultSender)

    var mandatoryFooter =
      '\n\n---\n' +
      'Acesse nosso site: www.cred10mix.com.br\n' +
      'Siga-nos no Instagram: @cred10mix\n' +
      'Qualquer contato deve ser feito via WhatsApp: 81 98865-3534 (Thiago Souza) - https://wa.me/5581988653534\n' +
      'Este é um e-mail automático e não monitorado. Por favor, realize todo contato via WhatsApp.'

    var apiKey = $secrets.get('RESEND_API_KEY') || $os.getenv('RESEND_API_KEY')
    if (!apiKey) {
      return e.json(503, {
        success: false,
        message: 'Serviço de e-mail não configurado. Configure a chave RESEND_API_KEY.',
      })
    }

    var clients = []
    try {
      clients = $app.findRecordsByFilter('clients', "birth_date != ''", 'name', 0, 0)
    } catch (dbErr) {
      return e.json(500, {
        success: false,
        message: 'Erro ao buscar clientes: ' + String(dbErr),
      })
    }

    var birthdayClients = []
    for (var i = 0; i < clients.length; i++) {
      var client = clients[i]
      var bDateStr = client.getString('birth_date')
      if (!bDateStr) continue

      var bMonth = -1
      var rawDateOnly = bDateStr.split('T')[0].split(' ')[0]
      var parts = rawDateOnly.split('-')
      if (parts.length >= 2) {
        bMonth = parseInt(parts[1], 10)
      }
      if (bMonth === -1) {
        var bd = new Date(bDateStr)
        bMonth = bd.getUTCMonth() + 1
      }

      if (bMonth === targetMonth) {
        birthdayClients.push(client)
      }
    }

    if (birthdayClients.length === 0) {
      return e.json(200, {
        success: true,
        sent: 0,
        failed: 0,
        total: 0,
        message: 'Nenhum aniversariante encontrado para o mês selecionado.',
      })
    }

    var sent = 0
    var failed = 0
    var skippedNoEmail = 0
    var commsCol = $app.findCollectionByNameOrId('communications')
    var nowDateStr = new Date().toISOString().split('T')[0]

    for (var j = 0; j < birthdayClients.length; j++) {
      var c = birthdayClients[j]
      var clientEmail = (c.getString('email') || '').trim()
      var clientName = (c.getString('name') || '').trim()
      var clientFirstName = clientName.split(' ')[0] || 'Cliente'

      if (!clientEmail) {
        skippedNoEmail++
        continue
      }

      var subject = customSubject || 'Feliz aniversário, ' + clientFirstName + '! 🎉'
      subject = subject
        .replace(/\$\{nome_cliente\}/g, clientName)
        .replace(/\{nome_cliente\}/g, clientName)

      var baseBody =
        customBody ||
        'Olá, ' +
          clientFirstName +
          '!\n\nDesejamos a você um feliz aniversário com muita saúde, paz e conquistas!\n\nAgradecemos pela parceria e por confiar na CRED10MIX para cuidar da sua proteção.\n\nAtenciosamente,\nEquipe CRED10MIX'
      baseBody = baseBody
        .replace(/\$\{nome_cliente\}/g, clientName)
        .replace(/\{nome_cliente\}/g, clientName)

      var fullEmailText = baseBody + mandatoryFooter
      var emailOk = false
      var errMsg = ''

      try {
        var res = $http.send({
          url: 'https://api.resend.com/emails',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [clientEmail],
            subject: subject,
            text: fullEmailText,
          }),
          timeout: 30,
        })

        if (res.statusCode >= 200 && res.statusCode < 300) {
          emailOk = true
        } else {
          errMsg = 'HTTP ' + res.statusCode
          if (res.json && res.json.message) {
            errMsg = res.json.message
          }
        }
      } catch (sendErr) {
        errMsg = String(sendErr)
      }

      try {
        var comm = new Record(commsCol)
        comm.set('type', 'Email')
        comm.set('client', c.id)
        comm.set('subject', subject)
        comm.set('body', fullEmailText)
        comm.set('recipient_email', clientEmail)
        comm.set('status', emailOk ? 'Enviado' : 'Falhou')
        if (emailOk) {
          comm.set('sent_date', nowDateStr)
        }
        $app.saveNoValidate(comm)
      } catch (logErr) {
        $app.logger().error('failed to save monthly birthday comm record', 'error', String(logErr))
      }

      if (emailOk) {
        sent++
      } else {
        failed++
        $app
          .logger()
          .error('monthly birthday email send failed', 'to', clientEmail, 'error', errMsg)
      }
    }

    // Se houver um lembrete vinculado, marcar como concluído após o disparo
    if (reminderId) {
      try {
        var remRecord = $app.findRecordById('reminders', reminderId)
        remRecord.set('sent', true)
        $app.save(remRecord)
      } catch (remErr) {
        $app
          .logger()
          .error(
            'failed to update reminder status after monthly send',
            'id',
            reminderId,
            'error',
            String(remErr),
          )
      }
    }

    return e.json(200, {
      success: true,
      sent: sent,
      failed: failed,
      skipped_no_email: skippedNoEmail,
      total: birthdayClients.length,
      message:
        sent +
        ' e-mail(s) de aniversário enviado(s) com sucesso.' +
        (failed > 0 ? ' (' + failed + ' falharam)' : '') +
        (skippedNoEmail > 0 ? ' (' + skippedNoEmail + ' sem e-mail)' : ''),
    })
  },
  $apis.requireAuth(),
)
