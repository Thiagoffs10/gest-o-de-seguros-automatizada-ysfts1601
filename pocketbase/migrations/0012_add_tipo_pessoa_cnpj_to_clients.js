migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('clients')

    if (!col.fields.getByName('tipo_pessoa')) {
      col.fields.add(
        new SelectField({
          name: 'tipo_pessoa',
          required: true,
          maxSelect: 1,
          values: ['PF', 'PJ'],
        }),
      )
    }

    if (!col.fields.getByName('cnpj')) {
      col.fields.add(new TextField({ name: 'cnpj' }))
    }

    app.save(col)

    try {
      const records = app.findRecordsByFilter('clients', '', 'created', 0, 0)
      for (let i = 0; i < records.length; i++) {
        if (!records[i].get('tipo_pessoa')) {
          records[i].set('tipo_pessoa', 'PF')
          app.saveNoValidate(records[i])
        }
      }
    } catch (_) {}
  },
  (app) => {
    const col = app.findCollectionByNameOrId('clients')

    if (col.fields.getByName('tipo_pessoa')) {
      col.fields.removeByName('tipo_pessoa')
    }
    if (col.fields.getByName('cnpj')) {
      col.fields.removeByName('cnpj')
    }

    app.save(col)
  },
)
