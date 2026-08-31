migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('password_resets')
      return
    } catch (_) {}

    const collection = new Collection({
      name: 'password_resets',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'email', type: 'email', required: true },
        { name: 'token', type: 'text', required: true },
        { name: 'expires_at', type: 'date', required: true },
        { name: 'used', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_pwd_resets_token ON password_resets (token)',
        'CREATE INDEX idx_pwd_resets_email ON password_resets (email)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('password_resets')
      app.delete(collection)
    } catch (_) {}
  },
)
