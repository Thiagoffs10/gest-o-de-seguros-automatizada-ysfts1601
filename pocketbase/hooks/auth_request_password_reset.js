routerAdd('POST', '/backend/v1/auth/request-password-reset', (e) => {
  var body = e.requestInfo().body || {}
  var email = (body.email || '').trim().toLowerCase()

  var genericSuccessResponse = {
    success: true,
    message:
      'Se o e-mail estiver cadastrado, as instruções para redefinição de senha foram enviadas.',
  }

  if (!email) {
    return e.json(200, genericSuccessResponse)
  }

  var userRecord = null
  try {
    userRecord = $app.findAuthRecordByEmail('_pb_users_auth_', email)
  } catch (_) {
    userRecord = null
  }

  if (!userRecord) {
    return e.json(200, genericSuccessResponse)
  }

  var token = $security.randomString(48)
  var expiresDate = new Date(Date.now() + 3600 * 1000) // 1 hora de validade
  var expiresAtStr = expiresDate.toISOString().replace('T', ' ').substring(0, 19)

  try {
    var resetsCol = $app.findCollectionByNameOrId('password_resets')
    var resetRec = new Record(resetsCol)
    resetRec.set('user', userRecord.id)
    resetRec.set('email', email)
    resetRec.set('token', token)
    resetRec.set('expires_at', expiresAtStr)
    resetRec.set('used', false)
    $app.saveNoValidate(resetRec)
  } catch (dbErr) {
    $app.logger().error('failed to create password reset token', 'error', String(dbErr))
    return e.json(200, genericSuccessResponse)
  }

  // Obter URL base do frontend
  var headers = e.requestInfo().headers || {}
  var origin = headers['origin'] || headers['referer'] || ''
  if (Array.isArray(origin)) origin = origin[0]
  if (origin && origin.endsWith('/')) origin = origin.slice(0, -1)

  var siteUrl = $secrets.get('SITE_URL') || origin || ''
  if (siteUrl && siteUrl.endsWith('/')) siteUrl = siteUrl.slice(0, -1)

  var resetLink = ''
  if (siteUrl) {
    resetLink = siteUrl + '/redefinir-senha?token=' + token
  } else {
    var proto = headers['x_forwarded_proto'] || 'https'
    if (Array.isArray(proto)) proto = proto[0]
    resetLink = proto + '://' + e.request.host + '/redefinir-senha?token=' + token
  }

  var apiKey = $secrets.get('RESEND_API_KEY')
  var verifiedSender =
    $secrets.get('VERIFIED_FROM_EMAIL') ||
    $secrets.get('SENDER_EMAIL') ||
    'contato@cred10mix.com.br'

  if (apiKey) {
    try {
      var emailSubject = 'Recuperação de Senha - CRED10MIX Corretora de Seguros'
      var emailText =
        'Olá ' +
        (userRecord.getString('name') || 'Usuário') +
        ',\n\n' +
        'Recebemos uma solicitação para redefinir a senha da sua conta no sistema CRED10MIX Corretora de Seguros.\n\n' +
        'Para criar uma nova senha, clique no link abaixo ou copie e cole no seu navegador:\n' +
        resetLink +
        '\n\n' +
        'Este link é válido por 1 hora. Se você não solicitou a alteração de senha, ignore esta mensagem.\n\n' +
        'Atenciosamente,\n' +
        'CRED10MIX Corretora de Seguros'

      $http.send({
        url: 'https://api.resend.com/emails',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: verifiedSender,
          to: [email],
          subject: emailSubject,
          text: emailText,
        }),
        timeout: 20,
      })
    } catch (mailErr) {
      $app
        .logger()
        .error('failed to send password reset email via Resend', 'error', String(mailErr))
    }
  }

  return e.json(200, genericSuccessResponse)
})
