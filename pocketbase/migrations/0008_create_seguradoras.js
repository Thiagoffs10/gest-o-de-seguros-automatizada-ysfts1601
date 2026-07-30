migrate(
  (app) => {
    const collection = new Collection({
      name: 'seguradoras',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'imposto_percentual', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_seguradoras_nome ON seguradoras (nome)'],
    })
    app.save(collection)

    const companies = [
      { nome: 'Porto Seguro', imposto_percentual: 5 },
      { nome: 'Azul', imposto_percentual: 4 },
      { nome: 'Itaú', imposto_percentual: 5 },
      { nome: 'Mapfre', imposto_percentual: 4 },
      { nome: 'Bradesco', imposto_percentual: 5 },
      { nome: 'HDI', imposto_percentual: 4 },
      { nome: 'Tokio Marine', imposto_percentual: 5 },
      { nome: 'Yelum', imposto_percentual: 3 },
      { nome: 'Allianz', imposto_percentual: 5 },
    ]

    for (const c of companies) {
      try {
        app.findFirstRecordByData('seguradoras', 'nome', c.nome)
      } catch (_) {
        const record = new Record(collection)
        record.set('nome', c.nome)
        record.set('imposto_percentual', c.imposto_percentual)
        app.save(record)
      }
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('seguradoras')
    app.delete(collection)
  },
)
