routerAdd(
  'GET',
  '/backend/v1/users',
  (e) => {
    const auth = e.auth
    if (!auth) return e.unauthorizedError('auth required')
    var role = auth.getString('role')
    if (role !== 'Admin' && role !== 'Administrador') return e.forbiddenError('admin only')

    var records = $app.findRecordsByFilter('users', '', '-created', 100, 0)
    var result = records.map(function (r) {
      return {
        id: r.id,
        name: r.getString('name'),
        email: r.getString('email'),
        role: r.getString('role'),
        created: r.getString('created'),
        updated: r.getString('updated'),
      }
    })

    return e.json(200, result)
  },
  $apis.requireAuth(),
)
