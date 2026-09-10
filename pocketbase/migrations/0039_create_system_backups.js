migrate(
  (app) => {
    const collection = new Collection({
      name: 'system_backups',
      type: 'base',
      listRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'",
      viewRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'",
      createRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'",
      updateRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'",
      deleteRule: "@request.auth.role = 'Admin' || @request.auth.role = 'Administrador'",
      fields: [
        {
          name: 'backup_type',
          type: 'select',
          values: ['manual', 'daily_auto', 'pre_restore'],
          required: true,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          values: ['completed', 'failed', 'running'],
          required: true,
          maxSelect: 1,
        },
        { name: 'file_name', type: 'text', required: true },
        { name: 'total_records', type: 'number' },
        { name: 'summary_json', type: 'json' },
        { name: 'data_json', type: 'json' },
        {
          name: 'backup_file',
          type: 'file',
          maxSelect: 1,
          maxSize: 52428800,
          mimeTypes: ['application/json', 'text/plain'],
        },
        { name: 'checksum', type: 'text' },
        { name: 'created_by', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_system_backups_created ON system_backups (created DESC)',
        'CREATE INDEX idx_system_backups_type ON system_backups (backup_type)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('system_backups')
      app.delete(col)
    } catch (_) {}
  },
)
