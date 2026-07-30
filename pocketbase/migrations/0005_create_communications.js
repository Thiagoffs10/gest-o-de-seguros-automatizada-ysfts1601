migrate(
  (app) => {
    const clientsCol = app.findCollectionByNameOrId('clients')
    const collection = new Collection({
      name: 'communications',
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
          values: ['Email', 'WhatsApp'],
          maxSelect: 1,
        },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'subject', type: 'text' },
        { name: 'body', type: 'text' },
        { name: 'recipient_email', type: 'email' },
        { name: 'recipient_phone', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Rascunho', 'Enviado', 'Falhou'],
          maxSelect: 1,
        },
        { name: 'sent_date', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('communications')
    app.delete(collection)
  },
)
