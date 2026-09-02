migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('policies')

    if (!col.fields.getByName('forma_pagamento')) {
      col.fields.add(
        new SelectField({
          name: 'forma_pagamento',
          values: ['Crédito', 'Débito em conta', 'Boleto'],
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('parcelas')) {
      col.fields.add(
        new NumberField({
          name: 'parcelas',
          onlyInt: true,
          min: 1,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('policies')
    const f1 = col.fields.getByName('forma_pagamento')
    if (f1) col.fields.remove(f1)
    const f2 = col.fields.getByName('parcelas')
    if (f2) col.fields.remove(f2)
    app.save(col)
  },
)
