migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('policies')
    if (!col.fields.getByName('data_cancelamento')) {
      col.fields.add(new DateField({ name: 'data_cancelamento' }))
    }
    if (!col.fields.getByName('motivo_cancelamento')) {
      col.fields.add(new TextField({ name: 'motivo_cancelamento' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('policies')
    if (col.fields.getByName('data_cancelamento')) {
      col.fields.removeByName('data_cancelamento')
    }
    if (col.fields.getByName('motivo_cancelamento')) {
      col.fields.removeByName('motivo_cancelamento')
    }
    app.save(col)
  },
)
