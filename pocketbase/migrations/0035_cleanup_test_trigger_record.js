migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('custos_fixos')
      const rec = app.findFirstRecordByData(
        'custos_fixos',
        'descricao',
        '__TRIGGER_REAL_EMAIL_TEST__',
      )
      app.delete(rec)
    } catch (_) {}
  },
  (app) => {
    // down
  },
)
