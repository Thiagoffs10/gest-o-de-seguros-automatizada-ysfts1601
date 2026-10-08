migrate(
  (app) => {
    if (!app.hasTable('importacao_debug')) {
      const importacaoDebug = new Collection({
        name: 'importacao_debug',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'arquivo_nome', type: 'text' },
          { name: 'texto_bruto', type: 'text' },
          { name: 'objeto_parseado', type: 'json' },
          { name: 'app_version', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_importacao_debug_created ON importacao_debug (created DESC)',
          'CREATE INDEX idx_importacao_debug_arquivo ON importacao_debug (arquivo_nome)',
        ],
      })
      app.save(importacaoDebug)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('importacao_debug')
      app.delete(col)
    } catch (_) {}
  },
)
