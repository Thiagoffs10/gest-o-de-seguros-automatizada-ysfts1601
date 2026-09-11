migrate(
  (app) => {
    const seguradorasCol = app.findCollectionByNameOrId('seguradoras')
    const tiposSeguroCol = app.findCollectionByNameOrId('tipos_seguro')

    // Criação da collection produtos: produto comercial específico da seguradora,
    // que pode ser relacionado a uma seguradora e a um ramo (tipo de seguro).
    const collection = new Collection({
      name: 'produtos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        {
          name: 'seguradora',
          type: 'relation',
          collectionId: seguradorasCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'ramo',
          type: 'relation',
          collectionId: tiposSeguroCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'codigo_comercial', type: 'text' },
        { name: 'descricao', type: 'text' },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_produtos_nome ON produtos (nome)',
        'CREATE INDEX idx_produtos_seguradora ON produtos (seguradora)',
        'CREATE INDEX idx_produtos_ramo ON produtos (ramo)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('produtos')
      app.delete(col)
    } catch (_) {}
  },
)
