migrate(
  (app) => {
    const collection = new Collection({
      name: 'tipos_seguro',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'",
      updateRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'",
      deleteRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'ativo', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_tipos_seguro_nome ON tipos_seguro (nome)'],
    })
    app.save(collection)

    const tipos = [
      'Auto',
      'Vida',
      'Residencial',
      'Empresarial',
      'Saúde',
      'Condomínio',
      'Viagem',
      'Outros',
    ]

    for (const t of tipos) {
      try {
        app.findFirstRecordByData('tipos_seguro', 'nome', t)
      } catch (_) {
        const record = new Record(collection)
        record.set('nome', t)
        record.set('ativo', true)
        app.save(record)
      }
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('tipos_seguro')
    app.delete(collection)
  },
)
