routerAdd(
  'POST',
  '/backend/v1/send-mass-email',
  (e) => {
    const body = e.requestInfo().body || {}
    const recipients = body.recipients || []
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
    const fromEmail = formatSender(body.from || rawDefaultSender)

    var mandatoryFooter =
      '\n\n---\n' +
      'Acesse nosso site: www.cred10mix.com.br\n' +
      'Siga-nos no Instagram: @cred10mix\n' +
      'Qualquer contato deve ser feito via WhatsApp: 81 98865-3534 (Thiago Souza) - https://wa.me/5581988653534\n' +
      'Este é um e-mail automático e não monitorado. Por favor, realize todo contato via WhatsApp.'

    var apiKey = $secrets.get('RESEND_API_KEY') || $os.getenv('RESEND_API_KEY')
    if (!apiKey) {
      return e.json(503, {
        error: 'Servico de e-mail nao configurado. Configure a chave RESEND_API_KEY.',
      })
    }

    if (!recipients || recipients.length === 0) {
      return e.badRequestError('Nenhum destinatario informado.')
    }

    var sent = 0
    var failed = 0
    var commsCol = $app.findCollectionByNameOrId('communications')
    var nowDateStr = new Date().toISOString().split('T')[0]

    for (var i = 0; i < recipients.length; i++) {
      var r = recipients[i]
      if (!r.to) {
        continue
      }

      var emailOk = false
      var errMsg = ''
      var finalRecipientBody = (r.body || '') + mandatoryFooter

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
            to: [r.to],
            subject: r.subject || '',
            text: finalRecipientBody,
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
      } catch (err) {
        errMsg = String(err)
      }

      try {
        var comm = new Record(commsCol)
        comm.set('type', 'Email')
        if (r.client_id) {
          comm.set('client', r.client_id)
        }
        comm.set('subject', r.subject || '')
        comm.set('body', finalRecipientBody)
        comm.set('recipient_email', r.to)
        comm.set('status', emailOk ? 'Enviado' : 'Falhou')
        if (emailOk) {
          comm.set('sent_date', nowDateStr)
        }
        $app.saveNoValidate(comm)
      } catch (logErr) {
        $app.logger().error('failed to save communication record', 'error', String(logErr))
      }

      if (emailOk) {
        sent++
      } else {
        failed++
        $app.logger().error('email send failed', 'to', r.to, 'error', errMsg)
      }
    }

    return e.json(200, { sent: sent, failed: failed, total: recipients.length })
  },
  $apis.requireAuth(),
)
