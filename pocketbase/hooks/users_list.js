routerAdd(
  'GET',
  '/backend/v1/users',
  (e) => {
    const auth = e.auth
    if (!auth) return e.unauthorizedError('auth required')
    if (auth.getString('role') !== 'admin') return e.forbiddenError('admin only')

    var records = $app.findRecordsByFilter('users', "id != ''", '-created', 500, 0)

    var users = []
    for (var i = 0; i < records.length; i++) {
      var r = records[i]
      users.push({
        id: r.id,
        name: r.getString('name') || '',
        email: r.getString('email') || '',
        role: r.getString('role') || 'Operador',
        created: r.getString('created') || '',
        updated: r.getString('updated') || '',
      })
    }

    return e.json(200, users)
  },
  $apis.requireAuth(),
)
