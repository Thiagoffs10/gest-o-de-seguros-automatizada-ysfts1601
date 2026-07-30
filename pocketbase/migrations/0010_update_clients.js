migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('clients')

    if (!col.fields.getByName('cpf')) {
      col.fields.add(new TextField({ name: 'cpf' }))
    }
    if (!col.fields.getByName('client_code')) {
      col.fields.add(new NumberField({ name: 'client_code' }))
    }
    if (!col.fields.getByName('cep')) {
      col.fields.add(new TextField({ name: 'cep' }))
    }
    if (!col.fields.getByName('rua')) {
      col.fields.add(new TextField({ name: 'rua' }))
    }
    if (!col.fields.getByName('numero')) {
      col.fields.add(new TextField({ name: 'numero' }))
    }
    if (!col.fields.getByName('bairro')) {
      col.fields.add(new TextField({ name: 'bairro' }))
    }
    if (!col.fields.getByName('cidade')) {
      col.fields.add(new TextField({ name: 'cidade' }))
    }
    if (!col.fields.getByName('estado')) {
      col.fields.add(new TextField({ name: 'estado' }))
    }

    app.save(col)

    try {
      const records = app.findRecordsByFilter('clients', '', 'created', 0, 0)
      for (let i = 0; i < records.length; i++) {
        if (!records[i].get('client_code')) {
          records[i].set('client_code', i + 1)
          app.save(records[i])
        }
      }
    } catch (_) {}
  },
  (app) => {},
)
