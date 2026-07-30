routerAdd(
  'PUT',
  '/backend/v1/users/{id}',
  (e) => {
    const auth = e.auth
    if (!auth) return e.unauthorizedError('auth required')
    if (auth.getString('role') !== 'Admin') return e.forbiddenError('admin only')

    var id = e.request.pathValue('id')
    var body = e.requestInfo().body || {}

    var record
    try {
      record = $app.findRecordById('users', id)
    } catch (_) {
      return e.notFoundError('user not found')
    }

    if (body.name !== undefined && body.name !== null) {
      if (!body.name.trim()) return e.badRequestError('Nome nao pode ser vazio.')
      record.set('name', body.name.trim())
    }

    if (body.role !== undefined && body.role !== null) {
      var validRoles = ['Admin', 'Gerente', 'Operador', 'Visualizador']
      if (validRoles.indexOf(body.role) < 0) return e.badRequestError('Role invalido.')
      record.set('role', body.role)
    }

    if (body.password && body.password.length > 0) {
      if (body.password.length < 8)
        return e.badRequestError('A senha deve ter no minimo 8 caracteres.')
      if (body.password !== body.passwordConfirm)
        return e.badRequestError('As senhas nao conferem.')
      record.setPassword(body.password)
    }

    try {
      $app.save(record)
    } catch (err) {
      return e.json(400, { error: 'Erro ao atualizar usuario.' })
    }

    return e.json(200, {
      id: record.id,
      name: record.getString('name'),
      email: record.getString('email'),
      role: record.getString('role'),
      created: record.getString('created'),
      updated: record.getString('updated'),
    })
  },
  $apis.requireAuth(),
)
