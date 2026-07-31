migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('custos_fixos')

    if (!col.fields.getByName('tipo')) {
      col.fields.add(
        new SelectField({
          name: 'tipo',
          values: ['Fixo', 'Variável'],
          maxSelect: 1,
        }),
      )
    }

    app.save(col)

    app.db().newQuery("UPDATE custos_fixos SET tipo = 'Fixo' WHERE tipo IS NULL").execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('custos_fixos')
    const field = col.fields.getByName('tipo')
    if (field) {
      col.fields.remove(field)
      app.save(col)
    }
  },
)
