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

    var userText = emailBody || ''
    var finalEmailBody = userText + mandatoryFooter

    var apiKey = $secrets.get('RESEND_API_KEY') || $os.getenv('RESEND_API_KEY')
    if (!apiKey) {
      return e.json(503, {
        success: false,
        status: 'Falhou',
        message: 'Serviço de e-mail não configurado. Configure a chave RESEND_API_KEY.',
      })
    }

    var rawAttachment = body.attachment || null
    var resendPayload = {
      from: fromEmail,
      to: [to],
      subject: subject,
      text: finalEmailBody,
    }

    if (rawAttachment && rawAttachment.content) {
      var attFilename = rawAttachment.filename || 'imagem-marketing.png'
      var attContentType = rawAttachment.content_type || 'image/png'
      var cid = 'marketing-image'

      resendPayload.attachments = [
        {
          content: rawAttachment.content,
          filename: attFilename,
          content_id: cid,
          content_type: attContentType,
        },
      ]

      var escapedText = userText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>')

      var htmlBody =
        '<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">' +
        '<div style="margin-bottom: 20px;">' +
        escapedText +
        '</div>' +
        '<div style="text-align: center; margin: 25px 0;">' +
        '<img src="cid:' +
        cid +
        '" alt="' +
        attFilename +
        '" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: inline-block;" />' +
        '</div>' +
        '<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5;">' +
        '<p style="margin: 4px 0;"><strong>CRED10MIX Seguros</strong></p>' +
        '<p style="margin: 4px 0;">Acesse nosso site: <a href="https://www.cred10mix.com.br" target="_blank" style="color: #2563eb; text-decoration: none;">www.cred10mix.com.br</a></p>' +
        '<p style="margin: 4px 0;">Siga-nos no Instagram: <a href="https://instagram.com/cred10mix" target="_blank" style="color: #2563eb; text-decoration: none;">@cred10mix</a></p>' +
        '<p style="margin: 4px 0;">Qualquer contato deve ser feito via WhatsApp: <a href="https://wa.me/5581988653534" target="_blank" style="color: #2563eb; text-decoration: none;">81 98865-3534 (Thiago Souza)</a></p>' +
        '<p style="margin: 10px 0 0 0; font-size: 11px; color: #94a3b8; font-style: italic;">Este é um e-mail automático e não monitorado. Por favor, realize todo contato via WhatsApp.</p>' +
        '</div>' +
        '</div>'

      resendPayload.html = htmlBody
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
        body: JSON.stringify(resendPayload),
        timeout: 30,
      })

      $app
        .logger()
        .info(
          'Resend API response',
          'status',
          res.statusCode,
          'body',
          JSON.stringify(res.json || res.raw),
        )

      if (res.statusCode >= 200 && res.statusCode < 300) {
        emailOk = true
      } else {
        errMsg = 'HTTP ' + res.statusCode
        if (res.json && res.json.message) {
          errMsg = res.json.message
        } else if (res.raw) {
          errMsg = String(res.raw)
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
        resend_id: res && res.json && res.json.id ? res.json.id : '',
        resend_response: res ? res.json : null,
      })
    } else {
      $app.logger().error('single email send failed', 'to', to, 'error', errMsg)
      return e.json(200, {
        success: false,
        status: 'Falhou',
        message: errMsg || 'Falha ao enviar e-mail.',
        resend_response: res ? res.json : null,
      })
    }
  },
  $apis.requireAuth(),
)
