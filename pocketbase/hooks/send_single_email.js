routerAdd(
  'POST',
  '/backend/v1/send-single-email',
  (e) => {
    const body = e.requestInfo().body || {}
    const to = body.to
    const clientId = body.client_id || ''
    const subject = body.subject || ''
    const emailBody = body.body || ''

    if (!to) {
      return e.badRequestError('Destinatário não informado.')
    }

    var verifiedEmailSecret = $secrets.get('VERIFIED_FROM_EMAIL') || $secrets.get('SENDER_EMAIL')
    var defaultSender = verifiedEmailSecret || 'noreply@cred10mix.com.br'
    const fromEmail = body.from || defaultSender

    var mandatoryFooter =
      '\n\n---\n' +
      'Acesse nosso site: www.cred10mix.com.br\n' +
      'Siga-nos no Instagram: @cred10mix\n' +
      'Qualquer contato deve ser feito via WhatsApp: 81 98865-3534 (Thiago Souza)\n' +
      'Link para WhatsApp: https://wa.me/5581988653534\n' +
      'Este é um e-mail automático, por favor não responda.'

    var finalEmailBody = (emailBody || '') + mandatoryFooter

    var apiKey = $secrets.get('RESEND_API_KEY')
    if (!apiKey) {
      return e.json(503, {
        success: false,
        status: 'Falhou',
        message: 'Serviço de e-mail não configurado. Configure a chave RESEND_API_KEY.',
      })
    }

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
          to: [to],
          subject: subject,
          text: finalEmailBody,
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

    var nowDateStr = new Date().toISOString().split('T')[0]

    try {
      var commsCol = $app.findCollectionByNameOrId('communications')
      var comm = new Record(commsCol)
      comm.set('type', 'Email')
      if (clientId) {
        comm.set('client', clientId)
      }
      comm.set('subject', subject)
      comm.set('body', finalEmailBody)
      comm.set('recipient_email', to)
      comm.set('status', emailOk ? 'Enviado' : 'Falhou')
      if (emailOk) {
        comm.set('sent_date', nowDateStr)
      }
      $app.saveNoValidate(comm)
    } catch (logErr) {
      $app.logger().error('failed to save communication record', 'error', String(logErr))
    }

    if (emailOk) {
      return e.json(200, {
        success: true,
        status: 'Enviado',
        message: 'E-mail enviado com sucesso.',
      })
    } else {
      $app.logger().error('single email send failed', 'to', to, 'error', errMsg)
      return e.json(200, {
        success: false,
        status: 'Falhou',
        message: errMsg || 'Falha ao enviar e-mail.',
      })
    }
  },
  $apis.requireAuth(),
)
