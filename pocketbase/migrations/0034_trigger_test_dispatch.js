migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('custos_fixos')
    const record = new Record(col)
    record.set('descricao', '__TRIGGER_REAL_EMAIL_TEST__')
    record.set('valor', 1)
    record.set('data', '2026-09-02')
    record.set('categoria', 'Outros')
    record.set('tipo', 'Fixo')
    record.set('pago', true)
    record.set('recorrente', false)
    app.save(record)
  },
  (app) => {
    // down
  },
)
