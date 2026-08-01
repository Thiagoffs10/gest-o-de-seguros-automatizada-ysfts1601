routerAdd(
  'POST',
  '/backend/v1/send-mass-email',
  (e) => {
    const body = e.requestInfo().body || {}
    const recipients = body.recipients || []
    const fromEmail = body.from || 'onboarding@resend.dev'

    var apiKey = $secrets.get('RESEND_API_KEY')
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
            text: r.body || '',
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
        comm.set('body', r.body || '')
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
