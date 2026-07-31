migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('parceiros')

    if (!col.fields.getByName('tipo_documento')) {
      col.fields.add(
        new SelectField({
          name: 'tipo_documento',
          values: ['CPF', 'CNPJ'],
          maxSelect: 1,
        }),
      )
    }

    app.save(col)

    app
      .db()
      .newQuery("UPDATE parceiros SET tipo_documento = 'CPF' WHERE tipo_documento IS NULL")
      .execute()
  },
  (app) => {
    const col = app.findCollectionByNameOrId('parceiros')
    const field = col.fields.getByName('tipo_documento')
    if (field) {
      col.fields.remove(field)
      app.save(col)
    }
  },
)
