migrate(
  (app) => {
    const collection = new Collection({
      name: 'custos_fixos',
      type: 'base',
      listRule:
        "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'",
      viewRule:
        "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'",
      createRule:
        "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'",
      updateRule:
        "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'",
      deleteRule:
        "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador' || @request.auth.role = 'Gerente'",
      fields: [
        { name: 'descricao', type: 'text', required: true },
        { name: 'valor', type: 'number', required: true },
        { name: 'data', type: 'date', required: true },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          values: [
            'Contador',
            'Impostos',
            'Energia',
            'Aluguel',
            'Telecomunicação',
            'Marketing',
            'Outros',
          ],
          maxSelect: 1,
        },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_custos_fixos_data ON custos_fixos (data)',
        'CREATE INDEX idx_custos_fixos_categoria ON custos_fixos (categoria)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('custos_fixos')
    app.delete(collection)
  },
)
