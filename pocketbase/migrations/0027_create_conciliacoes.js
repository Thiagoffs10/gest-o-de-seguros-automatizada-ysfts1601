migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('users')

    const collection = new Collection({
      name: 'conciliacoes',
      type: 'base',
      listRule:
        "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'",
      viewRule:
        "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'",
      createRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'",
      updateRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'",
      deleteRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'",
      fields: [
        { name: 'mes', type: 'number', required: true },
        { name: 'ano', type: 'number', required: true },
        { name: 'data_fechamento', type: 'date' },
        { name: 'usuario_fechamento', type: 'text' },
        { name: 'usuario_id', type: 'relation', collectionId: usersCol.id, maxSelect: 1 },
        { name: 'resumo', type: 'text' },
        { name: 'pendencias', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_conciliacoes_mes_ano ON conciliacoes (mes, ano)'],
    })

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('conciliacoes')
    app.delete(collection)
  },
)
