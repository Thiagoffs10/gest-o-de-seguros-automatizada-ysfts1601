routerAdd('POST', '/backend/v1/auth/reset-password', (e) => {
  var body = e.requestInfo().body || {}
  var token = (body.token || '').trim()
  var password = body.password || ''
  var passwordConfirm = body.passwordConfirm || ''

  if (!token) {
    return e.badRequestError('Token de recuperação não informado.')
  }

  if (!password || password.length < 8) {
    return e.badRequestError('A senha deve ter no mínimo 8 caracteres.')
  }

  if (password !== passwordConfirm) {
    return e.badRequestError('As senhas não conferem.')
  }

  var resetRec = null
  try {
    resetRec = $app.findFirstRecordByFilter(
      'password_resets',
      'token = "' + token.replace(/"/g, '') + '" && used = false',
    )
  } catch (_) {
    resetRec = null
  }

  if (!resetRec) {
    return e.badRequestError('Link de recuperação inválido ou já utilizado.')
  }

  var expiresAtStr = resetRec.getString('expires_at')
  if (expiresAtStr) {
    var expiresTime = new Date(expiresAtStr.replace(' ', 'T') + 'Z').getTime()
    if (!isNaN(expiresTime) && Date.now() > expiresTime) {
      return e.badRequestError('Este link de recuperação expirou. Solicite um novo link.')
    }
  }

  var userId = resetRec.getString('user')
  var userRec = null
  try {
    userRec = $app.findRecordById('_pb_users_auth_', userId)
  } catch (_) {
    userRec = null
  }

  if (!userRec) {
    return e.badRequestError('Usuário não encontrado.')
  }

  try {
    userRec.setPassword(password)
    $app.save(userRec)

    resetRec.set('used', true)
    $app.saveNoValidate(resetRec)
  } catch (err) {
    $app.logger().error('failed to reset user password', 'error', String(err))
    return e.badRequestError('Erro ao atualizar a senha: ' + String(err))
  }

  return e.json(200, {
    success: true,
    message: 'Senha alterada com sucesso! Você já pode entrar com sua nova senha.',
  })
})
