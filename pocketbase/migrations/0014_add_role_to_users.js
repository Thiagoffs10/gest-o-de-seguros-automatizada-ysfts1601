migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!col.fields.getByName('role')) {
      col.fields.add(
        new SelectField({
          name: 'role',
          required: true,
          values: ['admin', 'user'],
          maxSelect: 1,
        }),
      )
    }

    col.listRule = 'id = @request.auth.id || @request.auth.role = "admin"'

    app.save(col)

    var users = app.findRecordsByFilter('users', "id != ''", '', 1000, 0)
    for (var i = 0; i < users.length; i++) {
      var u = users[i]
      if (!u.getString('role')) {
        u.set('role', 'user')
        app.save(u)
      }
    }

    try {
      var master = app.findAuthRecordByEmail('_pb_users_auth_', 'thiaguinhoffs@gmail.com')
      master.set('role', 'admin')
      app.save(master)
    } catch (_) {}
  },
  (app) => {
    const col = app.findCollectionByNameOrId('_pb_users_auth_')
    col.listRule = 'id = @request.auth.id'
    app.save(col)
  },
)
