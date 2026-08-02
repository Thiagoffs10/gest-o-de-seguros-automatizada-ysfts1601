migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('policies')

    if (!col.fields.getByName('forma_pagamento_repasse')) {
      col.fields.add(
        new SelectField({
          name: 'forma_pagamento_repasse',
          values: ['PIX', 'Transferência', 'Dinheiro', 'Cartão', 'Boleto', 'Outro'],
          maxSelect: 1,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('policies')
    const f = col.fields.getByName('forma_pagamento_repasse')
    if (f) col.fields.remove(f)
    app.save(col)
  },
)
