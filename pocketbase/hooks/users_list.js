routerAdd(
  'GET',
  '/backend/v1/users',
  (e) => {
    const auth = e.auth
    if (!auth) return e.unauthorizedError('auth required')
    var role = auth.getString('role')
    if (role !== 'Admin' && role !== 'Administrador') return e.forbiddenError('admin only')

    // Multi-tenant: usuário com organização vê só os usuários dela; admin vê todos
    var org = auth.getString('organization') || ''
    var filterStr = ''
    var params = {}
    if (org) {
      filterStr = 'organization = {:org}'
      params['org'] = org
    }
    var records = $app.findRecordsByFilter('users', filterStr, '-created', 500, 0, params)
    var result = records.map(function (r) {
      return {
        id: r.id,
        name: r.getString('name'),
        email: r.getString('email'),
        role: r.getString('role'),
        organization: r.getString('organization') || '',
        created: r.getString('created'),
        updated: r.getString('updated'),
      }
    })

    return e.json(200, result)
  },
  $apis.requireAuth(),
)
