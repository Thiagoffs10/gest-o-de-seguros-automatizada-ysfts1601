migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('policies')

    if (!col.fields.getByName('chassi')) {
      col.fields.add(new TextField({ name: 'chassi' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('policies')
    const field = col.fields.getByName('chassi')
    if (field) {
      col.fields.remove(field)
      app.save(col)
    }
  },
)
