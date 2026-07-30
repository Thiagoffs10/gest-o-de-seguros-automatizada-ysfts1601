routerAdd(
  'POST',
  '/backend/v1/users',
  (e) => {
    const auth = e.auth
    if (!auth) return e.unauthorizedError('auth required')
    if (auth.getString('role') !== 'admin') return e.forbiddenError('admin only')

    const body = e.requestInfo().body || {}

    if (!body.name || !body.name.trim()) return e.badRequestError('Nome e obrigatorio.')
    if (!body.email || !body.email.trim()) return e.badRequestError('E-mail e obrigatorio.')
    if (!body.password || body.password.length < 8)
      return e.badRequestError('A senha deve ter no minimo 8 caracteres.')
    if (body.password !== body.passwordConfirm) return e.badRequestError('As senhas nao conferem.')

    var emailExists = false
    try {
      $app.findAuthRecordByEmail('users', body.email)
      emailExists = true
    } catch (_) {}

    if (emailExists) return e.badRequestError('Este e-mail ja esta cadastrado.')

    var role = body.role === 'admin' ? 'admin' : 'user'

    var usersCol = $app.findCollectionByNameOrId('users')
    var record = new Record(usersCol)
    record.setEmail(body.email)
    record.setPassword(body.password)
    record.setVerified(true)
    record.set('name', body.name.trim())
    record.set('role', role)

    try {
      $app.save(record)
    } catch (err) {
      return e.json(400, { error: 'Erro ao criar usuario.' })
    }

    return e.json(201, {
      id: record.id,
      name: record.getString('name'),
      email: record.getString('email'),
      role: record.getString('role'),
      created: record.getString('created'),
    })
  },
  $apis.requireAuth(),
)
