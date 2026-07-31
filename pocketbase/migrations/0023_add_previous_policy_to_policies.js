migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('policies')

    if (!col.fields.getByName('previous_policy')) {
      col.fields.add(
        new RelationField({
          name: 'previous_policy',
          collectionId: col.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('policies')
    const field = col.fields.getByName('previous_policy')
    if (field) {
      col.fields.remove(field)
      app.save(col)
    }
  },
)
