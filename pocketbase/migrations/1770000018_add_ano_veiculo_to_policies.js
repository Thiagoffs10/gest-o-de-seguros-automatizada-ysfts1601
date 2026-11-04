migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('policies')

    if (!col.fields.getByName('ano_fabricacao')) {
      col.fields.add(
        new NumberField({
          name: 'ano_fabricacao',
          onlyInt: true,
          min: 1900,
          max: 2100,
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('ano_modelo')) {
      col.fields.add(
        new NumberField({
          name: 'ano_modelo',
          onlyInt: true,
          min: 1900,
          max: 2100,
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const pol = app.findCollectionByNameOrId('policies')
      const f1 = pol.fields.getByName('ano_fabricacao')
      if (f1) pol.fields.remove(f1)
      const f2 = pol.fields.getByName('ano_modelo')
      if (f2) pol.fields.remove(f2)
      app.save(pol)
    } catch (_) {}
  },
)
