migrate(
  (app) => {
    const clientsCol = app.findCollectionByNameOrId('clients')
    const policiesCol = app.findCollectionByNameOrId('policies')
    const collection = new Collection({
      name: 'reminders',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['Renovação', 'Aniversário', 'Customizado'],
          maxSelect: 1,
        },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'policy',
          type: 'relation',
          collectionId: policiesCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'date', type: 'date', required: true },
        { name: 'message', type: 'text' },
        { name: 'sent', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_reminders_date ON reminders (date)',
        'CREATE INDEX idx_reminders_sent ON reminders (sent)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('reminders')
    app.delete(collection)
  },
)
