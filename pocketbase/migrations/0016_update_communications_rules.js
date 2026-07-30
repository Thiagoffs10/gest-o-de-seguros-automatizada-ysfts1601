migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('communications')
    col.createRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    col.updateRule =
      "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'"
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('communications')
    col.createRule = "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'"
    col.updateRule = "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'"
    app.save(col)
  },
)
