routerAdd(
  'POST',
  '/backend/v1/users',
  (e) => {
    const auth = e.auth
    if (!auth) return e.unauthorizedError('auth required')
    var role = auth.getString('role')
    if (role !== 'Admin' && role !== 'Administrador') return e.forbiddenError('admin only')

    var body = e.requestInfo().body || {}
    if (!body.name || !body.name.trim()) return e.badRequestError('Nome obrigatorio.')
    if (!body.email || !body.email.trim()) return e.badRequestError('E-mail obrigatorio.')
    if (!body.password || body.password.length < 8)
      return e.badRequestError('A senha deve ter no minimo 8 caracteres.')
    if (body.password !== body.passwordConfirm) return e.badRequestError('As senhas nao conferem.')

    var validRoles = ['Admin', 'Administrador', 'Gerente', 'Operador', 'Visualizador']
    var userRole = body.role || 'Operador'
    if (validRoles.indexOf(userRole) < 0) return e.badRequestError('Role invalido.')

    var collection = $app.findCollectionByNameOrId('users')
    var record = new Record(collection)

    record.set('name', body.name.trim())
    record.setEmail(body.email.trim())
    record.setPassword(body.password)
    record.setVerified(true)
    record.set('role', userRole)

    try {
      $app.save(record)
    } catch (err) {
      return e.json(400, { error: 'Erro ao criar usuario. E-mail pode ja estar em uso.' })
    }

    return e.json(201, {
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
