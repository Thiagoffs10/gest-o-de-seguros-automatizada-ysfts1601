migrate(
  (app) => {
    app.db().newQuery("UPDATE users SET role = 'Admin' WHERE role = 'admin'").execute()
    app.db().newQuery("UPDATE users SET role = 'Operador' WHERE role = 'user'").execute()

    var usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    var roleField = usersCol.fields.getByName('role')
    roleField.values = ['Admin', 'Gerente', 'Operador', 'Visualizador']
    usersCol.listRule = "id = @request.auth.id || @request.auth.role = 'Admin'"
    usersCol.viewRule = "id = @request.auth.id || @request.auth.role = 'Admin'"
    usersCol.createRule = "@request.auth.role = 'Admin'"
    usersCol.updateRule = "id = @request.auth.id || @request.auth.role = 'Admin'"
    usersCol.deleteRule = "id = @request.auth.id || @request.auth.role = 'Admin'"
    app.save(usersCol)

    var collectionUpdates = [
      {
        name: 'clients',
        createRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Gerente'",
        updateRule:
          "@request.auth.role = 'Admin' || @request.auth.role = 'Gerente' || @request.auth.role = 'Operador'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      {
        name: 'policies',
        createRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Gerente'",
        updateRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Gerente'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      {
        name: 'payments',
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      {
        name: 'seguradoras',
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      {
        name: 'parceiros',
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      {
        name: 'communications',
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      {
        name: 'reminders',
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
    ]

    for (var i = 0; i < collectionUpdates.length; i++) {
      var u = collectionUpdates[i]
      var col = app.findCollectionByNameOrId(u.name)
      col.createRule = u.createRule
      col.updateRule = u.updateRule
      col.deleteRule = u.deleteRule
      app.save(col)
    }
  },
  (app) => {
    app.db().newQuery("UPDATE users SET role = 'admin' WHERE role = 'Admin'").execute()
    app.db().newQuery("UPDATE users SET role = 'user' WHERE role = 'Operador'").execute()

    var usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    var roleField = usersCol.fields.getByName('role')
    roleField.values = ['admin', 'user']
    usersCol.listRule = 'id = @request.auth.id || @request.auth.role = "admin"'
    usersCol.viewRule = 'id = @request.auth.id'
    usersCol.createRule = ''
    usersCol.updateRule = 'id = @request.auth.id'
    usersCol.deleteRule = 'id = @request.auth.id'
    app.save(usersCol)

    var dataCols = [
      'clients',
      'policies',
      'payments',
      'seguradoras',
      'parceiros',
      'communications',
      'reminders',
    ]
    for (var i = 0; i < dataCols.length; i++) {
      var col = app.findCollectionByNameOrId(dataCols[i])
      col.createRule = "@request.auth.id != ''"
      col.updateRule = "@request.auth.id != ''"
      col.deleteRule = "@request.auth.id != ''"
      app.save(col)
    }
  },
)
